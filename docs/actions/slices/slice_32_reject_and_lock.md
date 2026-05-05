# Slice 32 — Reject and Permanent Lock

**Status:** Complete  
**Date:** 2026-05-05  
**Branch:** dev

---

## 1. Files Changed

| File | Change |
|---|---|
| `src/app/actions/estimate-actions.ts` | Added staged-active guard to `setActiveEstimate` |
| `src/app/actions/proposal-actions.ts` | Removed `unlockProposal`; added `rejectProposal` |
| `src/app/actions/document-actions.ts` | `sendProposal` now requires staged status; adds `estimates.status = 'sent'` after RPC |
| `src/components/patterns/proposal/ProposalBuilderOrchestrator.tsx` | Removed `unlockProposal` import, handler, and Unlock button |
| `src/components/patterns/estimate/EstimateSelector.tsx` | Added Copy-only branch for rejected estimates |
| `docs/actions/current.md` | Updated to reflect all slice 32 changes |
| `docs/actions/slices/slice_32_reject_and_lock.md` | This report |

---

## 2. Staged-Active Guard (`setActiveEstimate`)

A guard was added to `setActiveEstimate` before the RPC call:

```typescript
const { data: stagedOther } = await auth.supabase
  .from('estimates')
  .select('id')
  .eq('job_id', jobId)
  .eq('status', 'staged')
  .neq('id', estimateId)
  .limit(1)

if (stagedOther && stagedOther.length > 0) {
  return { error: 'Cannot activate another estimate while one is staged.' }
}
```

**Rationale:** A job must not simultaneously have a staged estimate waiting for send and a separate active estimate being edited. The only path from staged back to active is `unstageEstimate`.

This is an app-layer guard only. The `set_active_estimate` RPC does not enforce this rule — if called directly it would allow the violation. No DB change was made.

---

## 3. `unlockProposal` Removed

The `unlockProposal` server action was deleted from `proposal-actions.ts`.

**What it did:** Set `proposal_structures.proposal_status = 'draft'` and cleared `locked_at` on both the estimate and proposal structure. This allowed sent proposals to be reverted to draft and re-edited.

**Why removed:** Sent estimates must be permanently locked. Allowing unlock means a sent proposal could be mutated post-delivery, violating the proposal as an audit artifact. The correct path for a rejected/revised proposal is to duplicate the estimate and start fresh.

**UI impact:** The Unlock button in `ProposalBuilderOrchestrator.tsx` was removed. The handler `handleUnlock` and the `unlockProposal` import were both deleted. The locked-notice hint text that said "Click Unlock to revert to draft" was updated to neutral copy. No design decision gap — the direction is clear: unlock is not allowed.

---

## 4. `rejectProposal` Server Action (new)

Added to `proposal-actions.ts` after `voidProposal`:

- Permission: `manage` (`can_assign` → DB)
- Input: `estimateId`, `jobId`
- Guard: `estimates.status` must be `'sent'`; all other statuses are rejected with a clear error
- Write: `UPDATE estimates SET status = 'rejected', updated_at = now()`
- Does NOT touch `proposal_structures`
- Does NOT unlock the estimate
- Does NOT mutate worksheet rows or pricing
- Revalidates proposal paths and worksheet path

**Why `proposal_structures` is not updated:** `ProposalStatus = 'draft' | 'sent' | 'signed' | 'voided'` — it does not include `'rejected'`. Writing `'rejected'` to `proposal_structures.proposal_status` would be a TypeScript error and would require a DB type extension. The `estimates` table is the authoritative status source. A rejected estimate's proposal structure correctly remains at `'sent'` — the proposal was sent; the client rejected it. The estimates record reflects the business outcome.

---

## 5. Send Path Status Alignment (`sendProposal`)

**Before:** `sendProposal` found the estimate by `status === 'active'`.  
**After:** `sendProposal` finds the estimate by `status === 'staged'`.

**RPC behavior confirmed (inspected via DB):** The `send_proposal` RPC does NOT check `estimates.status`. It only checks:
1. Estimate exists for the given job
2. `proposal_structures.proposal_status === 'draft'`

So staged estimates pass through the RPC without modification to the estimates status check. The RPC sets `locked_at`, `locked_by`, `locked_reason` on the estimate and transitions `proposal_structures.proposal_status` to `'sent'`, but does NOT set `estimates.status = 'sent'`.

**Post-RPC status write:** After the RPC succeeds, `sendProposal` adds:

```typescript
const { error: statusErr } = await auth.supabase
  .from('estimates')
  .update({ status: 'sent', updated_at: new Date().toISOString() })
  .eq('id', estimateId)
  .eq('job_id', jobId)

if (statusErr) return { error: statusErr.message }
```

This ensures `estimates.status = 'sent'` as the final state.

---

## 6. UI Changes (`EstimateSelector.tsx`)

Added a `rejected` branch to the estimate button logic:

```jsx
} : est.status === 'rejected' ? (
  <Btn onClick={() => act(() => duplicateEstimate(est.id, jobId))} disabled={isPending}>Copy</Btn>
) : (
```

Rejected estimates show only Copy. Use, Stage, Unstage, Rename, and Archive are all hidden.

---

## 7. Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass — no errors |
| `send_proposal` RPC status check | Verified via DB inspection — checks `proposal_structures.proposal_status`, not `estimates.status` |

---

## 8. Risks / Follow-up

**Post-RPC estimates.status consistency gap:** The `send_proposal` RPC commits atomically (lock estimate + transition proposal to sent + insert snapshot). The subsequent `UPDATE estimates SET status = 'sent'` is outside that transaction. If this UPDATE fails after the RPC commits, the estimate is left as `staged` with `locked_at` set and `proposal_structures.proposal_status = 'sent'`. Recovery would require a manual data fix. Mitigation: add `UPDATE estimates SET status = 'sent'` inside the `send_proposal` RPC (deferred; requires DB change).

**`createProposalSnapshot` still requires active status:** The `createProposalSnapshot` action in `document-actions.ts` looks for `e.status === 'active'`. With the new flow where send requires staged, `createProposalSnapshot` would fail for staged estimates. This action is not in the primary send path but is a known inconsistency.

**`rejectProposal` not wired in UI:** The action exists server-side but no UI calls it. A reject button in the proposal builder or a dedicated proposal review screen is a future slice.

**`proposal_structures.proposal_status` diverges from `estimates.status` for rejected estimates:** After rejection, `estimates.status = 'rejected'` but `proposal_structures.proposal_status` remains `'sent'`. UI that reads `proposal_status` to determine current state will not see the rejection. Code that needs to reflect rejection must read `estimates.status`. Addressed in known gaps in `current.md`.

**`unstageEstimate` RPC compatibility:** As noted in Slice 31, the `set_active_estimate` RPC may have internal status guards that reject staged estimates. This remains untested at runtime.
