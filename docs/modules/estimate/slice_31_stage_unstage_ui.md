# Slice 31 — Stage Flow Tightened to Active-Only with Unstage and Doc Correction

**Status:** Complete  
**Date:** 2026-05-04  
**Branch:** dev

---

## 1. Files Changed

| File | Change |
|---|---|
| `src/app/actions/estimate-actions.ts` | Tightened `stageEstimate` to active-only; added `unstageEstimate` action |
| `src/components/patterns/estimate/EstimateSelector.tsx` | Imported `stageEstimate` and `unstageEstimate`; wired Stage/Unstage buttons by status |
| `docs/actions/current.md` | Corrected staging rule; added `unstageEstimate`; added lifecycle forward/reverse paths; updated action guard table and next-work list |
| `docs/actions/slices/slice_30_stage_estimate_action.md` | Appended post-slice correction section |
| `docs/actions/slices/slice_31_stage_unstage_ui.md` | This report |

---

## 2. Stage Rule Correction

`stageEstimate` previously allowed `draft → staged` in addition to `active → staged`.

**Corrected rule:** only `active → staged` is permitted.

```
active → staged   ✓
draft  → staged   ✗
```

The guard in `stageEstimate` was changed from:
```typescript
if (estimate.status !== 'draft' && estimate.status !== 'active') { ... }
```
to:
```typescript
if (estimate.status !== 'active') { ... }
```

Error message updated accordingly: "Only the active estimate can be staged."

---

## 3. `unstageEstimate` Server Action (new)

Added to `estimate-actions.ts` after `stageEstimate`:

- Permission: `edit` (`can_manage` → DB)
- Input: `estimateId`, `jobId`
- Guards:
  - Status must be `'staged'`; returns error otherwise
  - `locked_at` must be null; returns error if locked
- Write: calls `set_active_estimate` RPC to atomically promote the estimate to `active` and demote any other active estimate for the same job
- Does NOT touch proposal records
- Revalidates worksheet path on success

Using the RPC rather than a direct UPDATE preserves atomicity: if another estimate became active during the staging window, the RPC demotes it cleanly before restoring this estimate.

---

## 4. UI Behavior (`EstimateSelector.tsx`)

Imported `stageEstimate` and `unstageEstimate` from `estimate-actions`.

Button rules by status:

| Status   | Use | Stage | Unstage | Rename | Copy | Archive |
|----------|-----|-------|---------|--------|------|---------|
| `active` | —   | ✓     | —       | ✓      | ✓    | ✓ (confirm) |
| `staged` | —   | —     | ✓       | —      | ✓    | — |
| `draft`  | ✓   | —     | —       | ✓      | ✓    | ✓ (confirm) |
| other    | ✓   | —     | —       | ✓      | ✓    | ✓ (confirm) |

Implementation: staged estimates render a separate button branch (`est.status === 'staged'`) showing Unstage + Copy only. Active estimates show the existing button set with Stage added. All other non-archived estimates follow the prior behavior unchanged.

---

## 5. Documentation Updates

### `docs/actions/current.md`

- Corrected `stageEstimate` description from `draft|active → staged` to `active → staged`
- Added `unstageEstimate` to the action description bullets
- Added explicit lifecycle paths:
  - Forward: `draft → active → staged → sent`
  - Reverse: `staged → active` (unstage), `archived → draft` (restore)
- Added `unstageEstimate` row to the action permission guard table
- Removed "Stage UI wiring" from next recommended work (now complete)
- Updated summary

### `docs/actions/slices/slice_30_stage_estimate_action.md`

Appended Section 6 — Post-Slice Correction explaining:
- The `draft → staged` allowance was incorrect
- The correction to active-only
- The unstage flow introduced in Slice 31

### `docs/design/module_structure`

No changes needed. Staging rules are not referenced in that document.

---

## 6. Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass — no errors |

---

## 7. Risks / Follow-up

**`set_active_estimate` RPC internal guards unknown:** The RPC may have an internal status check that rejects non-draft estimates. If so, `unstageEstimate` will return a DB error at runtime. This would require either a dedicated `unstage_estimate` RPC or removing the internal guard. No action taken here; the action-level guard is correct.

**`staged` estimates in the header trigger:** The dropdown header shows `active?.title ?? 'No active estimate'`. When the active estimate is staged, `active` will be `undefined` and the button shows "No active estimate." This is expected — staged estimates are no longer the active working estimate. No fix needed.

**Archive confirmation state on staged estimates:** `confirmArchiveId` could theoretically hold a staged estimate's ID if the estimate was staged while the confirmation was open. In this case the confirmation would render, but the Archive button is gated server-side via `NON_ARCHIVABLE_STATUSES`. The server action will return an error and the error flash will show. Acceptable.
