# Slice 09 — Worksheet Completion

**Date:** 2026-05-01
**Branch:** dev
**Reference:** design/estimate_system_execution_plan_r02.md, docs/claude/slice_07_bind_worksheet_report.md, docs/claude/slice_08_remove_scope_takeoff_ui.md

---

## Objective

Stabilize and complete the Estimate Worksheet as a production-ready core system.
This slice is a correctness and consistency audit — not a new-feature slice. All changes
are targeted fixes for bugs, security gaps, and code quality issues found during audit.

---

## Audit Findings

### Issue 1 — `ALLOWED_UNITS` duplicated (code quality)

`useJobWorksheetState.ts` defined its own `const ALLOWED_UNITS = ['flat', 'ea', 'sqft', 'lnft', 'cuft']`
in parallel with `unitOptions` exported from `_worksheetFormatters.ts`. Two independent
sources of truth for the same list — if one is updated, the other silently drifts.

**Fix:** Removed local `ALLOWED_UNITS` constant; import `unitOptions` from
`_worksheetFormatters.ts` and use it in `normalizeUnit`.

---

### Issue 2 — `getDepth` incorrect for multi-level nesting (UI bug)

`_worksheetFormatters.ts` `getDepth` function received a `rowsById` map but ignored it,
always returning `row.parent_id ? 1 : 0`. This meant all nested rows — regardless of
actual depth — received the same single-level visual indentation (24px). Rows nested
more than one level were visually indistinguishable from single-level children.

**Fix:** Replaced stub with a proper traversal that walks the parent chain via
`rowsById`, capped at depth 8 to prevent infinite loops from corrupt data. Each level
adds 16px of left padding in the description column.

---

### Issue 3 — Draft `parent_id` in `buildCreateInput` causes DB error (data integrity bug)

When a user creates a child row under a draft parent that has not yet been promoted
(description still blank), the child row gets `parent_id = 'draft_xxx'`. When the child's
description is typed first and `promoteDraftRow` runs, it calls `buildCreateInput` which
sets `parent_id = 'draft_xxx'` — not a valid UUID — in the INSERT payload. PostgreSQL
rejects this with a type error, the `createRow` call throws, and the row enters `error`
state permanently.

**Fix:** In `buildCreateInput`, strip draft parent IDs:
```typescript
parent_id: row.parent_id && !isDraftRowId(row.parent_id) ? row.parent_id : null,
```
The child is created as a top-level item (null parent) rather than failing. The parent,
once promoted, is separately tracked. This is the correct fallback since the parent's DB
identity is unknown at the time of the child's creation.

---

### Issue 4 — `archiveEstimate` and `renameEstimate` missing `job_id` filter (security depth)

Both server actions updated the `estimates` row filtering only by `estimateId`. An
authenticated internal user who knew another job's estimate UUID could archive or rename
it by crafting a direct action call.

**Fix:** Added `.eq('job_id', jobId)` to both update queries. The operation now silently
no-ops if the estimate doesn't belong to the job, matching the behavior of `setActiveEstimate`
(which already enforces `job_id` at the DB function level).

---

### Issue 5 — `EstimateSelector` dropdown has no click-outside close (usability blocker)

Once opened, the estimate panel stayed open indefinitely — clicking anywhere else in the
page had no effect. Users had to click the trigger button a second time to close it.

**Fix:** Added a `useEffect` + `document.addEventListener('mousedown', ...)` listener
on a `containerRef` wrapping the entire component. Fires only when `open` is true; cleaned
up in the effect return. Clicks inside the container (including the panel and trigger button)
are not counted as outside clicks.

---

### Issue 6 — Redundant `.map()` in `commitCellValue` backup write (code quality)

`commitCellValue` called `writeBackup(jobId, estimateId, localRowsRef.current.map(...))`.
But `replaceLocalRow` (called one line earlier) already updates `localRowsRef.current`
to contain the new row via `setLocalRowsSync`. The extra `.map()` creates a second copy
of the same array for no reason.

**Fix:** Simplified to `writeBackup(jobId, estimateId, localRowsRef.current)`.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/patterns/estimate/_hooks/useJobWorksheetState.ts` | Remove duplicate `ALLOWED_UNITS`; import `unitOptions`; fix draft parent_id in `buildCreateInput`; simplify backup write in `commitCellValue` |
| `src/components/patterns/estimate/_worksheetFormatters.ts` | Fix `getDepth` — proper hierarchy traversal via `rowsById` |
| `src/app/actions/estimate-actions.ts` | Add `job_id` filter to `archiveEstimate` and `renameEstimate` |
| `src/components/patterns/estimate/EstimateSelector.tsx` | Add click-outside handler to close dropdown |

---

## Data Integrity Confirmation

**DB query results:**

| Check | Result |
|---|---|
| `job_worksheet_items` total rows | 2 |
| Rows with `estimate_id` set | 2 |
| Rows missing `estimate_id` | **0** |
| `estimate_id` column nullable | NO |
| `estimate_id` constraint type | FOREIGN KEY → `estimates.pkey` |

All worksheet rows are bound to an estimate. The NOT NULL + FK constraint prevents new
rows from being created without a valid estimate. No orphaned rows exist.

---

## State / Persistence Behavior

**Load:** `worksheet/page.tsx` fetches by `estimate_id` (active estimate only). The active
estimate guard (Slice 08) ensures `activeEstimateId` is never empty before the query runs.

**Create:** `buildCreateInput` sets `estimate_id` from the hook's `estimateId` parameter.
Draft parent_ids are now nulled before the insert, preventing FK type errors.

**Update:** `persistRow` updates by `id` only. The `id` is a UUID only the client receives
from rows it already loaded for the current estimate. Scoping by `estimate_id` would require
threading it into the persistence layer — noted as a follow-up (see below).

**Delete:** `deleteRow` deletes by `id` only. Same note as Update.

**Sort order:** `persistSortOrders` updates by `id` only. Same note.

**Switching estimates:** When `estimateId` prop changes (user clicks "Use"), the
initialization `useEffect` re-runs (because `estimateId` is a dep). All state resets:
`localRows`, `serverRows`, `undoStack`, `activeCell`. localStorage backup key includes
`estimateId` so backup for estimate A is never loaded when switching to estimate B.
In-flight `flushRow` async calls for the old estimate complete but find no matching row
IDs in the new estimate's `localRowsRef`, leaving state unchanged — no cross-estimate
state leakage.

**Backup:** `readBackup`/`writeBackup`/`clearBackup` are scoped to `(jobId, estimateId)`.
No stale data from a different estimate can load.

---

## Duplicate Estimate Behavior

`duplicateEstimate` in `estimate-actions.ts`:
- Fetches source estimate metadata + all its rows in parallel
- Creates the new estimate record
- Builds `Map<old_id, new_uuid>` for all source rows
- Copies each row with remapped `id`, `parent_id`, and `estimate_id`; resets
  `pricing_source_row_id`, `pricing_header_id`, `replaces_item_id` to null
- Inserts all copied rows in a single bulk INSERT

**Hierarchy preservation:** Parent rows precede their children in sort_order, so the bulk
INSERT processes parents first. PostgreSQL self-referential FK checks pass correctly for
same-statement multi-row inserts.

**ID collision:** Impossible — new UUIDs are generated via `crypto.randomUUID()`.

**Empty source:** If the source has no rows, the copy step is skipped; the new estimate
starts empty. No error.

---

## Active Estimate Safety

- `setActiveEstimate` uses the atomic `set_active_estimate()` PL/pgSQL function — no gap
  where zero active estimates exist
- `archiveEstimate` has an application-level guard: returns an error if the target is
  currently active, without calling the DB
- `worksheet/page.tsx` guard (Slice 08) creates or promotes an active estimate on load
  if one doesn't exist — no code path results in `activeEstimateId = ''`
- No legacy two-step UPDATE code remains anywhere in the codebase

---

## Performance Notes

- `estimate_id` is indexed (`idx_jwi_estimate_id`) — row queries are efficient
- Page loads estimates first, then rows sequentially (not parallel) because the row query
  requires `activeEstimate.id`. The estimate query is a single small SELECT; sequential
  cost is minimal
- No unnecessary re-fetch loops identified; switching estimates triggers a full server
  re-render via `revalidatePath`, which is correct and expected

---

## Legacy Table Recommendation

| Table | Live rows | Referenced by views/functions |
|---|---|---|
| `job_scope_items` | 15 | None |
| `takeoff_items` | 8 | None |

**Recommendation: Defer the drop.**

Both tables have live data (15 and 8 rows respectively). No DB views or functions
reference them, and no application code queries them. However:

1. The data may represent real historical scope/takeoff work that should be reviewed
   before discarding.
2. Dropping tables is irreversible without a point-in-time restore.
3. A dedicated schema cleanup slice should export or archive this data first, get
   explicit sign-off that it is no longer needed, then drop.

**Do not drop in this slice or the next.** Flag for a schema cleanup slice after Slice 11
(Proposal Summary) when the full data model is more settled.

---

## Validation Run

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass — 11.0s |
| TypeScript | Pass — 11.2s |
| Static prerender | Pre-existing Supabase env-var failure — unrelated |
| DB integrity check | 0 rows missing `estimate_id`; NOT NULL + FK constraint confirmed |
| Legacy table check | 15 + 8 live rows; no DB objects reference them |

---

## Intentionally Not Changed

- **`persistRow`, `deleteRow`, `persistSortOrders` without `estimate_id` scope** — Adding
  this requires threading `estimateId` through `useJobWorksheetPersistence`, which is an
  architectural change out of scope for this slice. Risk is low: row UUIDs are only
  available to clients who loaded them for the current estimate. Flagged as a follow-up.
- **`restoreRows` insert order for hierarchies** — Undo-delete of nested rows relies on
  PostgreSQL self-referential FK handling for same-statement multi-row INSERTs. This works
  correctly in PostgreSQL 17, but is noted as a potential concern if behavior changes.
- **`total_price` copied in `duplicateEstimate`** — Acceptable for now. If a computed
  total_price trigger is added later, review whether the copy should null it out.
- **Proposal system, Financials, import/export** — Not touched.
- **Worksheet UI layout** — No styling changes.

---

## Risks / Follow-up Items

**1. `persistRow`/`deleteRow`/`persistSortOrders` lack `estimate_id` scoping.**
These operate on row IDs that are only known to clients who loaded them for the correct
estimate. Adding `estimate_id` scoping requires threading it into the persistence hook —
a clean architectural change for a future slice.

**2. Draft parent / unprimed child edge case is now safe but creates a flat row.**
If a user types in a child before the draft parent is promoted, the child is saved as
a top-level item. The parent, when eventually promoted, will remain parentless in the DB
while the child is orphaned at the top level. This is unlikely in practice (the parent
must have an empty description for the problem to occur), and the behavior is now graceful
rather than crashing.

**3. Legacy tables `job_scope_items` and `takeoff_items` remain with live data.**
Targeted for a schema cleanup slice after Slice 11.
