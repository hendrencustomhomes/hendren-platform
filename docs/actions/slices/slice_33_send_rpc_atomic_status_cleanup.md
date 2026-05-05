# Slice 33 — Send RPC Atomic Status Cleanup

**Status:** Complete  
**Date:** 2026-05-05  
**Branch:** dev

---

## 1. Context

The `send_proposal` Supabase RPC was updated in the live database (migration `20260505001007`) to atomically set `estimates.status = 'sent'` inside the same Postgres transaction that:

1. Enforces `estimates.status = 'staged'` as a precondition
2. Locks the estimate (`locked_at`, `locked_by`, `locked_reason`)
3. Sets `estimates.status = 'sent'`
4. Upserts `proposal_structures.proposal_status = 'sent'`
5. Inserts the immutable `proposal_documents` snapshot

Prior to that DB migration, the TypeScript `sendProposal` action performed a separate `UPDATE estimates SET status = 'sent'` after the RPC returned. This created a consistency gap: if the RPC committed but the post-RPC UPDATE failed, the estimate would remain in `staged` with `locked_at` set and `proposal_structures.proposal_status = 'sent'` — an irrecoverable inconsistency requiring a manual data fix.

This slice closes the app-side of that gap: removes the dead post-RPC status update, adds the migration file to source control, and updates all relevant documentation.

---

## 2. Files Changed

| File | Change |
|---|---|
| `supabase/migrations/20260505001007_make_send_proposal_set_estimate_sent.sql` | **New** — migration file matching the already-applied DB migration verbatim |
| `src/app/actions/document-actions.ts` | Removed post-RPC `UPDATE estimates SET status = 'sent'`; updated RPC comment |
| `docs/actions/current.md` | Updated `sendProposal` description; resolved known gap; updated `send_proposal` DB note; updated completed work |
| `docs/actions/slices/slice_33_send_rpc_atomic_status_cleanup.md` | **New** — this report |

---

## 3. Migration File Added

**Path:** `supabase/migrations/20260505001007_make_send_proposal_set_estimate_sent.sql`

This file was not previously in source control. The migration had already been applied to the live `hendren-platform` database (confirmed via `supabase_migrations.schema_migrations` version `20260505001007`). Adding the file now brings the repo into sync with the live DB state.

The file contains:
- The full `CREATE OR REPLACE FUNCTION public.send_proposal(...)` body as applied
- Rollback notes in comments
- `COMMENT ON FUNCTION` describing the atomic behavior

**Key changes vs the prior function (20260502140430):**

| Aspect | Before | After |
|---|---|---|
| `estimates.status` in RPC | Not touched | Set to `'sent'` atomically in the estimate UPDATE |
| Estimate status precondition | None at DB layer | Raises if `estimates.status ≠ 'staged'` |
| Variable names | `v_current_status TEXT` | `v_proposal_status TEXT`, `v_estimate_status estimate_status` |
| All other behavior | — | Unchanged |

---

## 4. Code Cleanup — `sendProposal`

**Before (dead code removed):**

```typescript
// The send_proposal RPC sets locked_at on the estimate but does not update estimates.status.
// Update it to 'sent' here so the estimate lifecycle reflects the final state.
const { error: statusErr } = await auth.supabase
  .from('estimates')
  .update({ status: 'sent', updated_at: new Date().toISOString() })
  .eq('id', estimateId)
  .eq('job_id', jobId)

if (statusErr) return { error: statusErr.message }
```

**After:**

Block removed entirely. The RPC comment was updated to accurately describe the full atomic behavior:

```typescript
// Single atomic RPC: enforces staged status, locks estimate, sets estimates.status = 'sent',
// transitions proposal_structures to sent, and inserts the snapshot document.
// Any failure inside the Postgres function rolls back all writes.
// estimates.status = 'sent' is now set inside the RPC — no post-RPC status update needed.
const { data: documentId, error: rpcErr } = await auth.supabase.rpc('send_proposal', { ... })
```

**What was preserved:**
- `manage` permission guard
- `staged` status pre-check (app-layer, before hitting the RPC)
- Validation via `validateEstimateForSend`
- Snapshot JSON construction
- All four `revalidatePath` calls

---

## 5. Documentation Updates — `current.md`

Three targeted edits:

**Estimate/Proposal section** — `sendProposal` line updated:
- Before: `sendProposal requires staged status; RPC sets locked_at; action then sets estimates.status = 'sent'`
- After: describes full atomic behavior and that no post-RPC update occurs

**Known gaps section** — consistency gap entry resolved:
- Before: described the gap as an open risk requiring DB change
- After: notes the gap is closed via migration `20260505001007`

**DB enforcement section** — `send_proposal` RPC note expanded:
- Now mentions the atomic status set and the staged precondition enforcement at the DB layer

---

## 6. Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass — no errors |
| Migration file exists at correct path | ✅ `supabase/migrations/20260505001007_make_send_proposal_set_estimate_sent.sql` |
| Post-RPC `UPDATE estimates` removed from `sendProposal` | ✅ Confirmed via `grep` — zero matches |
| Staged pre-check preserved in `sendProposal` | ✅ `e.status === 'staged'` guard present |
| `manage` guard preserved | ✅ `requireModuleAccess(..., 'manage')` present |
| Validation call preserved | ✅ `validateEstimateForSend` still called |
| All `revalidatePath` calls preserved | ✅ Four paths revalidated |

---

## 7. Risks / Follow-up

**⚠️ The `staged` guard is now enforced at BOTH app and DB layers.**

The app-layer check (`stagedEstimate` find) and the DB-layer guard (`estimates.status ≠ 'staged'` raises) are now redundant but not conflicting. The app layer will catch the case first and return a typed error. If the app check is ever removed, the DB guard still catches it. This is defense-in-depth — no action needed, but document it.

**Error message divergence if DB guard triggers directly:**

If `send_proposal` is called outside the app (e.g., via direct Supabase client, edge function, or test) with a non-staged estimate, the caller will receive a Postgres exception: `Cannot send: estimate status is 'X' (must be 'staged')`. This message is not currently mapped to a user-facing copy string. Any direct RPC callers outside `sendProposal` should expect this error.

**`createProposalSnapshot` still requires `active` status:**

The `createProposalSnapshot` action in `document-actions.ts` looks for `e.status === 'active'`. The primary send path no longer uses it, but if it is invoked against a staged estimate it will return `No active estimate found for the given estimate ID`. This is an existing known gap — not introduced or widened by this slice.

**Migration file was added retroactively:**

The migration was applied directly to the live DB before the file was committed to the repo. Supabase CLI's `db pull` or `migration repair` would reflect this correctly since the version is recorded in `supabase_migrations.schema_migrations`. However, any automated migration diff tooling that compares local files to remote state should now show clean. If the repo uses `supabase db push` in CI, the file must be present before the next push to avoid re-application.

**Slice 32 report note:**

`slice_32_reject_and_lock.md` section 5 and section 8 describe the post-RPC status write and the consistency gap as the then-current state. Those notes are historically accurate for that slice and have not been modified. The resolution is documented here and in `current.md`.
