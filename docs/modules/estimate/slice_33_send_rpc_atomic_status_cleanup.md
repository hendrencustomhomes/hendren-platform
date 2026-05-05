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

This slice closes the app-side of that gap: removes the dead post-RPC status update and updates all relevant documentation.

---

## 2. Files Changed

| File | Change |
|---|---|
| `src/app/actions/document-actions.ts` | Removed post-RPC `UPDATE estimates SET status = 'sent'`; updated RPC comment |
| `docs/actions/current.md` | Updated `sendProposal` description; resolved known gap; updated `send_proposal` DB note; updated completed work |
| `docs/actions/slices/slice_33_send_rpc_atomic_status_cleanup.md` | **Updated** — migration file reference removed |

---

## 3. Database Change (Supabase Direct)

The RPC update was applied directly in Supabase (not via repo migration files):

- Function: `public.send_proposal`
- Version reference: `20260505001007`

Key changes:
- `estimates.status = 'sent'` is now set atomically inside the RPC
- `estimates.status = 'staged'` is enforced as a precondition

---

## 4. Code Cleanup — `sendProposal`

**Removed dead post-RPC update:**

```typescript
UPDATE estimates SET status = 'sent'
```

Replaced with accurate RPC comment describing atomic behavior.

Preserved:
- permission guards
- staged pre-check
- validation
- snapshot creation
- revalidation

---

## 5. Documentation Updates — `current.md`

- Updated send behavior to reflect atomic RPC
- Removed consistency gap

---

## 6. Validation Results

- TypeScript: PASS
- No post-RPC status update remains
- Staged guard preserved

---

## 7. Risks / Follow-up

- Dual-layer staged guard (app + DB) is intentional
- Direct RPC callers must handle DB error messaging
- `createProposalSnapshot` still expects `active`

---

## 8. Note

Initial version of this slice incorrectly added a repo migration file. This has been corrected — all SQL changes are applied directly in Supabase and not committed to the repo.
