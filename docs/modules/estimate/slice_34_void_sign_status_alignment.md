# Slice 34 — Sign and Void Estimate Status Alignment

**Date:** 2026-05-05  
**Branch:** dev  
**File:** `src/app/actions/proposal-actions.ts`

---

## Problem

`signProposal` and `voidProposal` only updated `proposal_structures.proposal_status`. They did not write to `estimates.status`, leaving `estimates` (the authoritative status source) stale after these transitions.

Additionally, `voidProposal` contained a block that cleared `locked_at`, `locked_by`, and `locked_reason` on the estimate when voiding from `'sent'`. This was wrong: `voided` is a terminal locked state; the estimate must remain locked after voiding, regardless of the prior status.

---

## Changes

### `signProposal`

- After updating `proposal_structures.proposal_status = 'signed'`, now also updates `estimates.status = 'signed'`.
- Added `revalidatePath` for the worksheet route (consistent with `voidProposal` and `rejectProposal`).
- Extracted `now` to a shared constant so both writes use the same timestamp.

### `voidProposal`

- After updating `proposal_structures.proposal_status = 'voided'`, now also updates `estimates.status = 'voided'`.
- Removed the conditional block that cleared `locked_at / locked_by / locked_reason` when voiding from `'sent'`. Voided estimates are permanently locked.
- Updated the function-level comment to reflect that the estimate stays locked.

---

## Invariants preserved

- `estimates.status` is always the authoritative lifecycle state.
- Both transitions (`signed`, `voided`) are terminal and locked; no unlock is performed.
- `rejectProposal` was already writing to `estimates.status` correctly — not changed.
- `proposal_structures.proposal_status` remains a secondary artifact that mirrors the estimate status for sent/signed/voided; it does not include `'rejected'` (rejection is estimate-only).
- No DB enum or RLS changes needed — `'signed'` and `'voided'` were already valid `estimate_status` values.

---

## Files changed

- `src/app/actions/proposal-actions.ts` — `signProposal` and `voidProposal` only

---

## No stop conditions triggered

- `EstimateStatus` already includes `'signed'` and `'voided'`.
- DB enum already includes both values (confirmed post-Slice 30 enum update).
- TypeScript check clean (`npx tsc --noEmit` — no errors).
