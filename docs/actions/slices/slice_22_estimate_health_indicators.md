# Slice 22 — Estimate Health Indicators

**Status:** Completed
**Date:** 2026-05-03
**Branch:** dev

---

## 1. What Was Done

Added read-only estimate health indicators to the worksheet page. Users can now see a compact summary of pricing completeness risks before any proposal send validation exists.

Visibility only. Nothing blocks editing, exporting, importing, proposal building, or sending.

---

## 2. Files Changed

| File | Change |
|---|---|
| `src/components/patterns/estimate/EstimateHealthSummary.tsx` | **New** — dedicated component owning health calculation and display |
| `src/components/patterns/estimate/JobWorksheetPageOrchestrator.tsx` | Import and render `EstimateHealthSummary` between header card and table |
| `docs/actions/slices/slice_22_estimate_health_indicators.md` | This report |

---

## 3. What Changed

### `EstimateHealthSummary.tsx` (new)

Single-responsibility component:

- Accepts `rows: JobWorksheetRow[]`
- Filters out draft rows (ids starting with `draft_`) before counting
- `computeHealth()` private function derives five counts:

| Count | Rule |
|---|---|
| `total` | All non-draft rows |
| `linked` | Rows where `pricing_source_row_id !== null` |
| `unpriced` | Non-note rows where `pricing_type === 'unpriced'` |
| `missingQty` | Non-note rows where quantity is null, empty, NaN, or zero |
| `excluded` | Rows where `scope_status === 'excluded'` |

- Renders a horizontal row of pill badges
- Warning pills (amber/red tint) for `unpriced` and `missingQty` when count > 0
- Neutral pills for `total`, `linked`, `excluded`
- `unpriced` and `missingQty` pills are omitted entirely when count is 0 (no false alarms)
- `excluded` pill is omitted when count is 0
- Returns `null` when `total === 0` (empty worksheet shows nothing)
- Inline style conventions match existing patterns in this module

### `JobWorksheetPageOrchestrator.tsx`

Two-line change:
1. Added `import { EstimateHealthSummary } from './EstimateHealthSummary'`
2. Added `<EstimateHealthSummary rows={localRows} />` as a grid item between the header card and `JobWorksheetTableAdapter`

`localRows` is the already-live client state from `useJobWorksheetState` — no new data loading. The summary updates reactively as rows change.

---

## 4. Validation Results

- `npx tsc --noEmit` — 0 errors
- No changes to shared UI components
- `useJobWorksheetState`, `useJobWorksheetPersistence`, adapters, and persistence unchanged
- Proposal system untouched

---

## 5. Risks / Follow-up

1. **`missingQty` includes assemblies** — Assembly rows (`row_kind === 'assembly'`) are grouping parents whose quantity may legitimately be null when children provide the totals. A future slice could exclude `row_kind === 'assembly'` from the missing-qty check if it produces noise.

2. **No `missingUnitPrice` indicator** — Rows with `pricing_type !== 'unpriced'` but `unit_price === null` are not separately flagged. The `unpriced` count covers the clearest case. A follow-up could add this once the team determines whether zero-price manual rows warrant a distinct warning.

3. **Excluded count is informational only** — Excluded rows surface in the count but carry no recommendation. Context for when exclusion is intentional vs. accidental requires proposal-layer or scope-review UI that is out of scope here.

4. **Health summary not shown when worksheet is empty** — By design; `total === 0` returns null. If the orchestrator later shows an empty-state UI, health indicators are irrelevant anyway.

---

## 6. Intentionally Not Changed

- `JobWorksheetTableAdapter` — adapter layer untouched
- `_worksheetFormatters.ts` — no health logic placed in formatters
- `EditableDataTable` — shared UI layer untouched
- `useJobWorksheetState` / `useJobWorksheetPersistence` — no state or persistence changes
- `page.tsx` (worksheet route) — route file untouched; no new props threaded through
- Estimate status/lock semantics — no duplication of editability logic
- Proposal system — no changes
- Schema, migrations, RLS, server actions — no changes
- Blocking behavior — none added; all indicators are informational
