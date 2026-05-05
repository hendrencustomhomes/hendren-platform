# Slice 19 — Estimate Lock / Status Guardrails

**Status:** Completed
**Date:** 2026-05-03
**Branch:** dev

---

## 1. What Was Enforced

### Editability rule

An estimate is editable when ALL of the following are true:
- `status` is `'draft'` or `'active'`
- `locked_at` is `null`

An estimate is NOT editable when:
- `status` is `'approved'` or `'archived'`, OR
- `locked_at` is set (proposal has been sent or signed)

### Single source of truth

`isEstimateEditable(estimate)` in `src/lib/estimateTypes.ts` is the canonical implementation of this rule. All enforcement points import and call this function — no duplicate logic.

---

## 2. Files Changed

| File | Change |
|---|---|
| `src/lib/estimateTypes.ts` | Added `isEstimateEditable()` export |
| `src/app/jobs/[id]/worksheet/page.tsx` | Updated `isLocked` derivation to use `isEstimateEditable` (was only checking `locked_at`) |
| `src/app/actions/estimate-actions.ts` | Added status/lock guard to `renameEstimate` |
| `src/app/actions/worksheet-pricing-actions.ts` | Added estimate status/lock guard to `linkRowToPricing` and `unlinkRowFromPricing` |
| `src/components/patterns/estimate/JobWorksheetPageOrchestrator.tsx` | Pass `isEditable={!isLocked}` to `JobWorksheetTableAdapter` |
| `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx` | Added `isEditable` prop; wired to `canManage` on `EditableDataTable` |

---

## 3. What Changed Per File

### `src/lib/estimateTypes.ts`
```typescript
export function isEstimateEditable(estimate: Pick<Estimate, 'status' | 'locked_at'>): boolean {
  return (estimate.status === 'draft' || estimate.status === 'active') && !estimate.locked_at
}
```
Accepts any object with `status` and `locked_at` — can be used by both page-level code and server actions with partial selects.

### `src/app/jobs/[id]/worksheet/page.tsx`
Before: `const isLocked = !!(activeEstimate as any)?.locked_at`
After: `const isLocked = !activeEstimate || !isEstimateEditable(activeEstimate)`

Now also catches `approved` and `archived` status, not just `locked_at`.

### `src/app/actions/estimate-actions.ts` — `renameEstimate`
Fetches estimate status + locked_at before applying the title update. Returns `'Estimate is locked and cannot be modified'` if not editable. This is a sequential fetch (status check then update) to avoid misleading errors.

### `src/app/actions/worksheet-pricing-actions.ts` — `linkRowToPricing`
Added `estimates` fetch to existing Round 1 parallel block alongside `pricing_rows` and `job_worksheet_items`. Validates `isEstimateEditable` before proceeding to Round 2 (header + permission checks).

### `src/app/actions/worksheet-pricing-actions.ts` — `unlinkRowFromPricing`
Added `estimates` fetch to the existing parallel fetch block alongside `job_worksheet_items`. Validates `isEstimateEditable` before writing.

### `src/components/patterns/estimate/JobWorksheetPageOrchestrator.tsx`
Added `isEditable={!isLocked}` prop to `JobWorksheetTableAdapter`. No other change.

### `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx`
Added `isEditable?: boolean` to `AdapterProps` (defaults to `true`). Changed `canManage` on `EditableDataTable` from the hardcoded shorthand `canManage` (i.e. `canManage={true}`) to `canManage={isEditable}`. `EditableDataTable` wraps its content in `<fieldset disabled={!canManage}>` — this disables all interactive elements (cells, Link/Unlink/Delete buttons) in one place.

---

## 4. Where Server-Side Locking Is Enforced

| Action | Guard added |
|---|---|
| `linkRowToPricing` | Yes — estimate status + locked_at checked before any mutation |
| `unlinkRowFromPricing` | Yes — estimate status + locked_at checked before any mutation |
| `renameEstimate` | Yes — estimate status + locked_at checked before title update |
| `importEstimate` | Not needed — always creates a new `draft` estimate |
| `createEstimate` | Not needed — always creates a new `draft` estimate |
| `duplicateEstimate` | Not needed — reads source (any status OK), creates new `draft` |
| `setActiveEstimate` | Not needed — status transition, not a row data mutation |
| `archiveEstimate` | Not needed — status transition with existing guard |

---

## 5. Where UI Gating Is Applied

| Location | Effect |
|---|---|
| `worksheet/page.tsx` | `isLocked = !isEstimateEditable(activeEstimate)` — now covers `approved`/`archived` in addition to `locked_at` |
| `JobWorksheetPageOrchestrator` | Already hides "Add row", "Import CSV" when `isLocked`; now also passes `isEditable={!isLocked}` to adapter |
| `JobWorksheetTableAdapter` + `EditableDataTable` | `canManage={isEditable}` disables the entire table fieldset: all cells, Link/Unlink buttons, and Delete buttons are disabled when `isEditable=false` |

The persistence hook (`useJobWorksheetPersistence`) is client-side Supabase and does not receive server-side enforcement in this slice. The UI gating is the primary protection for persistence hook mutations (persistRow, createRow, deleteRow, persistSortOrders). The disabled fieldset prevents any of those callbacks from being triggered via UI interaction.

---

## 6. Validation Results

- `npx tsc --noEmit` — 0 errors
- No broken imports
- `isEstimateEditable` used at exactly 4 callsites: the page, two server actions, and the estimate action — no duplication

---

## 7. Risks / Follow-up

1. **Persistence hook not server-enforced** — `useJobWorksheetPersistence` calls Supabase directly. A client bypassing the UI could still write to `job_worksheet_items` on a locked estimate. A future slice should add RLS policies or convert these operations to server actions.

2. **`approved` status is unused in current flows** — No action currently transitions an estimate to `approved`. The guard is in place for when that flow is added (it will work without code changes).

3. **`setActiveEstimate` can activate a locked estimate** — The RPC `set_active_estimate` can set `locked_at`-bearing estimates to `active`. This is a scheduling-level operation and not guarded here. Worth reviewing if `locked_at` semantics evolve.

4. **`EstimateSelector` allows renaming via double-click on any estimate** — The selector calls `renameEstimate` for any estimate regardless of status. The server-side guard now returns an error, which `EstimateSelector.showError` will display. No UI-level disabling was added to the selector in this slice.

---

## 8. Intentionally Not Changed

- Proposal system — no changes to proposal-actions, document-actions, or any proposal route
- `useJobWorksheetPersistence` — client-side Supabase calls not converted (scope boundary)
- `archiveEstimate` — already has its own guard, not modified
- `duplicateEstimate` — reads only from source estimate; new estimate is always draft
- `EstimateSelector` rename UI — server returns error; no UI-level disable added (would require status-aware prop threading through EstimateSelector which is a separate concern)
- RLS policies — not audited or modified (no schema changes)
