# Slice 09.5 — Worksheet Write-Path Hardening

**Date:** 2026-05-01
**Branch:** dev
**Reference:** design/estimate_system_execution_plan_r02.md, docs/claude/slice_09_worksheet_completion.md

---

## Objective

Ensure all worksheet write operations are scoped to `estimate_id` in addition to row
`id`. Before this slice, UPDATE and DELETE queries on `job_worksheet_items` filtered
only on `id`. An authenticated internal user who could supply an arbitrary row UUID could
mutate a row belonging to a different estimate. This slice closes that gap with the
minimal localized change: thread `estimateId` into the persistence hook.

---

## Write-Path Audit

| Function | Operation | Before | After |
|---|---|---|---|
| `createRow` | INSERT | `estimate_id` in payload | unchanged — INSERT already scoped via payload |
| `restoreRows` | INSERT | `estimate_id` in each row object | unchanged — INSERT already scoped via row data |
| `persistRow` | UPDATE | `.eq('id', rowId)` only | `.eq('id', rowId).eq('estimate_id', estimateId)` |
| `deleteRow` | DELETE | `.eq('id', rowId)` only | `.eq('id', rowId).eq('estimate_id', estimateId)` |
| `persistSortOrders` | UPDATE ×N | `.eq('id', update.id)` only | `.eq('id', update.id).eq('estimate_id', estimateId)` |

INSERT operations (`createRow`, `restoreRows`) were already correctly scoped — the
`estimate_id` is embedded in the insert payload itself, enforced by the DB NOT NULL + FK
constraint. No change needed there.

---

## Files Changed

### `src/components/patterns/estimate/_hooks/useJobWorksheetPersistence.ts`

**Signature change:**
```typescript
// Before
export function useJobWorksheetPersistence()

// After
export function useJobWorksheetPersistence(estimateId: string)
```

**`persistRow` — before:**
```typescript
.update(patch)
.eq('id', rowId)
.select('*')
.single()
```

**`persistRow` — after:**
```typescript
.update(patch)
.eq('id', rowId)
.eq('estimate_id', estimateId)
.select('*')
.single()
```

**`deleteRow` — before:**
```typescript
.delete()
.eq('id', rowId)
```

**`deleteRow` — after:**
```typescript
.delete()
.eq('id', rowId)
.eq('estimate_id', estimateId)
```

**`persistSortOrders` — before (per-row):**
```typescript
.update({ sort_order: update.sort_order })
.eq('id', update.id)
.select('id, sort_order')
.single()
```

**`persistSortOrders` — after (per-row):**
```typescript
.update({ sort_order: update.sort_order })
.eq('id', update.id)
.eq('estimate_id', estimateId)
.select('id, sort_order')
.single()
```

### `src/components/patterns/estimate/JobWorksheetPageOrchestrator.tsx`

**Before:**
```typescript
const { persistRow, createRow, restoreRows, deleteRow, persistSortOrders } = useJobWorksheetPersistence()
```

**After:**
```typescript
const { persistRow, createRow, restoreRows, deleteRow, persistSortOrders } = useJobWorksheetPersistence(activeEstimateId)
```

`activeEstimateId` is already available in the orchestrator as a prop. No new prop
threading required — the orchestrator already receives it from the server component and
passes it to `useJobWorksheetState`.

---

## How `estimateId` Stays Current During Estimate Switches

When the user switches estimates:

1. `setActiveEstimate` server action calls `revalidatePath`, triggering a server
   re-render of the worksheet page.
2. The orchestrator component re-renders with the new `activeEstimateId` prop.
3. `useJobWorksheetPersistence(activeEstimateId)` is called again — the new `estimateId`
   is captured in the closure of all returned functions.
4. `useJobWorksheetState` is re-called with the new persistence functions; the init
   effect resets all state for the new estimate.

Any in-flight async calls from the old estimate complete with the old `estimateId` in
their closures. Because those calls target row IDs that don't exist in the new estimate's
local state, they resolve harmlessly (no-op or their state updates reference stale IDs
that are no longer in `localRows`).

---

## Behavior After a Mismatch

If a write is attempted with a mismatched `estimate_id` (e.g., an in-flight operation
that started before an estimate switch), the DB query returns 0 rows affected. The
`.single()` call then returns `error` or `!data`, causing the persistence function to
throw. The state hook's `catch` block sets `rowState = 'error'` for that row and writes
a local backup. No silent data mutation occurs.

---

## All Write Paths Now Scoped

| Path | Scoping mechanism |
|---|---|
| Create row | `estimate_id` in INSERT payload (FK-enforced) |
| Edit row | `.eq('id').eq('estimate_id')` |
| Delete row | `.eq('id').eq('estimate_id')` |
| Reorder rows | `.eq('id').eq('estimate_id')` per row |
| Undo-restore rows | `estimate_id` in INSERT payload (from saved row objects) |
| Duplicate rows | `estimate_id` set to new estimate's ID in INSERT payload |

No write operation can succeed unless both the row `id` and the `estimate_id` match the
hook's current scope.

---

## Validation Run

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass — 12.4s |
| TypeScript | Pass — 12.4s |
| Static prerender | Pre-existing Supabase env-var failure — unrelated |

---

## Edge Cases

**`persistRow` returns `!data` on mismatch:** The `.single()` modifier returns an error
when zero rows are matched. A mismatched `estimate_id` produces zero matches → throws →
row shows `error` state. This is the correct behavior: the user sees a save failure and
can reload.

**`persistSortOrders` partial failure:** Each sort-order update is a separate query
(already was before this change). If one fails due to mismatch, `failed.error` is thrown.
The sort-order state is already committed locally; on reload it will re-sync from the
server. This is the same behavior as before — no regression.

**`deleteRow` on an already-deleted row:** Returns 0 rows affected; no error is thrown
by `supabase.delete()` for zero matches (unlike `.single()`). The local state has already
removed the row, so the UI is consistent regardless.

---

## Intentionally Not Changed

- Read paths (SELECT queries) — not in scope
- `estimate-actions.ts` server actions — already had `job_id` filters added in Slice 09
- `restoreRows` and `createRow` INSERT operations — already scoped via payload
- `useJobWorksheetState` — no changes needed; persistence functions are injected
- UI components — no changes
- RLS policies — unchanged; `estimate_id` scoping is defense-in-depth at the query layer
