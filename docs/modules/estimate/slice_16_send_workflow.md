# Slice 16 — Send Workflow (Atomic + Controlled)

**Date:** 2026-05-02
**Branch:** claude/audit-worksheet-stability-nIwtF → dev
**Reference:** design/estimate_system_execution_plan_r02.md, docs/slices/slice_15_document_snapshot_send_foundation.md

---

## Objective

Make the "send proposal" operation atomic: a proposal can never reach `sent` status
without a corresponding immutable document snapshot. A snapshot failure must prevent
the lock entirely — no partial writes, no sent state without a record.

---

## The Problem with Slice 12.5 + 15

After Slice 15, the "send" path was split across two separate actions:

| Old path | Problem |
|---|---|
| Builder "Mark as sent" → `lockProposal()` | Locks proposal + estimate, no document created |
| Preview "Create snapshot" → `createProposalSnapshot()` | Creates document, no status change |

A user could lock the proposal and never create a snapshot. Or they could forget. The
two steps had no enforcement relationship. `lockProposal` remains in the codebase and
could still be called from code, but the UI path is now replaced.

---

## Approach: Postgres Function via RPC

True atomicity in Supabase requires a PostgreSQL function called via `.rpc()`.
The JS client does not support multi-statement transactions directly.

The `send_proposal` function runs inside a single Postgres transaction:
1. Validates estimate belongs to the job
2. Locks the `proposal_structures` row (`FOR UPDATE`) to prevent concurrent sends
3. Validates `proposal_status = 'draft'`
4. `UPDATE estimates SET locked_at = ...`
5. `UPSERT proposal_structures SET proposal_status = 'sent', locked_at = ...`
6. `INSERT INTO proposal_documents (...) RETURNING id`
7. Returns the new document UUID

If step 6 (snapshot INSERT) fails for any reason, Postgres rolls back steps 4 and 5.
It is impossible for the proposal/estimate to be locked without a document row existing.

**`snapshot_json` is computed in TypeScript** before the RPC call because `applyStructure`
is application logic that cannot run inside Postgres. The computed JSON is passed as a
parameter to the RPC. This is the correct Supabase pattern for atomic writes that depend
on application-layer computation.

---

## Files Added / Changed

| File | Change |
|---|---|
| DB migration `create_send_proposal_function` | New `send_proposal` Postgres function |
| `src/app/actions/document-actions.ts` | Added `sendProposal` server action |
| `src/components/patterns/proposal/ProposalBuilderOrchestrator.tsx` | Removed `lockProposal` import + `handleLock`; added `sendProposal` + `useRouter` + `handleSend`; "Mark as sent" → "Send proposal" |
| `docs/slices/slice_16_send_workflow.md` | This file |

`lockProposal` remains in `proposal-actions.ts` (not deleted) but is no longer imported
or called from any UI path.

---

## `send_proposal` Postgres Function

```sql
CREATE OR REPLACE FUNCTION public.send_proposal(
  p_estimate_id   UUID,
  p_job_id        UUID,
  p_user_id       UUID,
  p_snapshot_json JSONB,
  p_title         TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER ...
```

Validations (raise exception = full rollback):
- Estimate must belong to the given job
- `proposal_status` must be `'draft'` (row locked with `FOR UPDATE`)

Writes (all-or-nothing):
1. `UPDATE estimates` — sets `locked_at`, `locked_by`, `locked_reason`
2. `UPSERT proposal_structures` — sets `proposal_status = 'sent'`, `locked_at`, etc.
3. `INSERT proposal_documents` — `doc_status = 'sent'`, full `snapshot_json`

Returns: new `proposal_documents.id` (UUID)

---

## `sendProposal` Server Action

Located in `src/app/actions/document-actions.ts`.

**Steps:**
1. Auth guard
2. Load job name
3. Load active estimate (verifies `e.id === estimateId && e.status === 'active'`)
4. Parallel load: worksheet rows + proposal structure record
5. Pre-check: `proposal_status` must be `'draft'` (early error before expensive computation)
6. Compute `snapshot_json` using derive/reconcile/`applyStructure` pipeline
   - Draft proposal → always `reconcileStructure` (never frozen)
   - `snapshot_json.proposal_status = 'sent'` (represents the post-send state)
7. Call `auth.supabase.rpc('send_proposal', { ... })` — atomic DB transaction
8. On RPC error: return `{ error }` — no state was changed
9. On success: revalidate all proposal/worksheet paths, return `{ documentId }`

**Guarantees:**
- Cannot return `{ documentId }` unless the proposal is locked, estimate is locked,
  and the document row exists
- Cannot leave proposal locked without a document (DB transaction ensures this)
- Does not call `lockProposal` or `createProposalSnapshot` — those paths are bypassed

---

## Orchestrator Changes

`ProposalBuilderOrchestrator.tsx`:

| Before | After |
|---|---|
| `import { lockProposal, ... }` | Removed — `lockProposal` no longer imported |
| `handleLock()` calls `lockProposal` | Removed |
| "Mark as sent" button | Replaced with "Send proposal" button |
| On success: page revalidates in place | On success: `router.push(…/documents/${documentId})` |

`useRouter` added to support the post-send redirect to the new document view.

---

## Reachability Audit

| Path | Status |
|---|---|
| Builder "Send proposal" → `sendProposal()` | Active — atomic |
| Builder "Mark as sent" → `lockProposal()` | **Removed from UI** |
| Preview "Create snapshot" → `createProposalSnapshot()` | Retained — for draft snapshots only |
| Direct server call to `lockProposal()` | Still exported but no UI path; not reachable from app UI |

---

## State Transition Guarantees

After Slice 16, the following invariant holds at the DB level:

> Any `proposal_structures` row with `proposal_status = 'sent'` will always have a
> corresponding `proposal_documents` row with `doc_status = 'sent'` created in the
> same transaction, with `created_at` matching `proposal_structures.locked_at`.

This invariant is enforced by the Postgres function, not by application logic.

---

## Validation Run

| Check | Result |
|---|---|
| Compilation (Turbopack) | Pass — 15.9s |
| TypeScript | Pass — 15.1s |
| `send_proposal` function applied to DB | Pass |
| `lockProposal` removed from orchestrator imports | Verified — grep confirms |
| "Mark as sent" button removed from UI | Verified |
| Pre-existing prerender error | Supabase env-var — unrelated |

---

## Limitations

1. **`lockProposal` not deleted**: It remains in `proposal-actions.ts`. A sufficiently
   determined developer could still call it directly. A future hardening pass could
   delete `lockProposal` or add a guard that checks for an existing sent document.

2. **Snapshot computed pre-RPC**: The `snapshot_json` is computed in TypeScript just
   before the RPC call. If the Supabase connection drops between computation and RPC,
   the snapshot may not reflect any changes made in that gap (extremely unlikely for
   a draft proposal). This is an acceptable trade-off; the alternative would require
   running `applyStructure` inside Postgres.

3. **No undo for send**: Once `sendProposal` succeeds, the proposal is locked. The
   existing `unlockProposal` action (sent→draft) remains available from the builder
   but it does not void the snapshot document. A future slice should handle the case
   where a user unlocks a sent proposal — what happens to the existing sent document?

4. **Single active estimate assumed**: `sendProposal` finds the active estimate by
   matching both `job_id` and `estimate_id`. Change order estimates have their own
   `estimateId` and would each require their own send flow (not yet built).
