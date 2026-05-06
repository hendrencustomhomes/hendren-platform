# Slice 43B — Repo Cleanup After Legacy Pricing Column Removal

Status: complete
Branch: `dev`
Date: 2026-05-06

---

## Goal

Slice 43A executed the migration that dropped `job_worksheet_items.unit_price`
and `job_worksheet_items.total_price` from the live database. Slice 43B is the
matching repo-side cleanup: remove the corresponding type fields, draft row
defaults, and stale column key, while preserving every other `unit_price`
reference (different table, different domain, or external CSV terminology).

---

## Audit

`grep -rn "unit_price\|total_price" src/` returns 51 lines. Each was classified
into one of the categories below.

### A. `pricing_rows.unit_price` — pricing module source field (KEEP)

These are reads or writes on the `pricing_rows` table (a different table from
`job_worksheet_items`, with its own legitimate `unit_price` column). They are
the source of truth for pricing data and are intentionally separate from the
worksheet resolver model.

- `src/app/actions/worksheet-pricing-actions.ts:29,147,223,351,357`
- `src/lib/pricing/revisions.ts:53`
- `src/lib/pricing/rows.ts:13,122,153`
- `src/lib/pricing/types.ts:51,135,147`
- `src/components/patterns/pricing/**` (all references)
- `src/components/patterns/estimate/PricingLinkModal.tsx:142,144`
- `src/app/more/catalog/_components/CatalogDetailPage.tsx:33,133,431`

### B. `ProposalLineItem.unit_price` / `ProposalSnapshotItem.unit_price` — resolved value in proposal output (KEEP)

These are fields on the in-memory proposal types, populated by `resolveUnitCost`
in `applyStructure` / `buildProposalSummary`. Renaming would require a snapshot
schema migration (out of scope per hard constraints).

- `src/lib/proposalSummary.ts:14,66`
- `src/lib/proposalStructure.ts:118,165`
- `src/lib/proposalSnapshot.ts:18`
- `src/app/actions/document-actions.ts:122,237`
- `src/app/jobs/[id]/proposal/page.tsx:57`
- `src/app/jobs/[id]/proposal/preview/page.tsx:271`
- `src/app/jobs/[id]/proposal/pdf/page.tsx:170`
- `src/app/jobs/[id]/proposal/documents/[documentId]/page.tsx:144`

### C. CSV external label (KEEP — intentional external-facing terminology)

`unit_price` is the external CSV column header label. The parsed value is
written to `unit_cost_manual`; no DB column named `unit_price` is ever
written. Renaming the CSV header would break exports and external imports.

- `src/lib/worksheetCsv.ts:9` (`WORKSHEET_CSV_HEADERS`)
- `src/lib/worksheetCsv.ts:108` (`get(raw, 'unit_price')`)
- `src/components/patterns/estimate/JobWorksheetPageOrchestrator.tsx:88` (CSV export header line)

### D. Worksheet UI editable cell key — UI/state terminology mapped to resolver (KEEP — intentional)

`'unit_price'` is the editable cell key used by the worksheet UI. The state
hook (`useJobWorksheetState.ts:82`) translates `'unit_price'` commits into
writes against `unit_cost_manual` (manual rows) or `unit_cost_override` /
`unit_cost_is_overridden` (linked rows). It is UI terminology only — there
is no DB column of this name and nothing writes to one. Renaming would
require coordinated changes across the table adapter, mobile view, state
hook, and confirm-dialog interception logic, with no business benefit.

- `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx:57,63,94,239,245,414`
- `src/components/patterns/estimate/JobWorksheetMobileView.tsx:91`
- `src/components/patterns/estimate/_hooks/useJobWorksheetState.ts:82`

### E. Removed legacy DB column assumptions (DELETED)

Three repo-side artifacts assumed the legacy DB columns existed. All three
have been removed in this slice.

- `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx:43–45` —
  `JobWorksheetRow` type fields `unit_price: number | string | null` and
  `total_price: number | string | null`. **Removed.**
- `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx:103` —
  static column `key:'total_price'`. **Renamed to `key:'row_total'`.** The
  `getValue` implementation already read from `rowTotal(row)`, so behavior
  is unchanged; only the column identifier string is updated.
- `src/components/patterns/estimate/_hooks/useJobWorksheetState.ts:325–326` —
  draft row default `unit_price: null, total_price: null`. **Removed.** The
  draft row no longer needs to satisfy these type fields.

---

## Cleanup Performed

### `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx`

1. Removed `unit_price` and `total_price` fields (and the legacy comment) from
   the `JobWorksheetRow` type definition.
2. Renamed the static Total column key from `'total_price'` to `'row_total'`.
3. Updated `getCellValue` in the `useWorksheetInteraction` configuration to
   resolve the `'unit_price'` editable cell via `resolveUnitCost(row)` instead
   of indexing into `row.unit_price` (which no longer exists). This preserves
   the existing UI behavior — the column's `getValue` already used
   `resolveUnitCost(row)`, and now the hook's value-fetch path matches.

### `src/components/patterns/estimate/_hooks/useJobWorksheetState.ts`

Removed the `unit_price: null` and `total_price: null` lines from the draft
row default object created in `createDraftRow`. The remaining fields fully
satisfy the updated `JobWorksheetRow` type.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx` | Dropped legacy `unit_price` / `total_price` type fields. Renamed `'total_price'` column key to `'row_total'`. Updated `getCellValue` to resolve `unit_price` editable key via `resolveUnitCost`. |
| `src/components/patterns/estimate/_hooks/useJobWorksheetState.ts` | Removed `unit_price` / `total_price` defaults from `createDraftRow`. |
| `docs/modules/estimate/slice_43b_repo_cleanup_after_legacy_pricing_removal.md` | This file. |
| `docs/actions/current.md` | Marked Slice 43B complete; updated next-recommended work. |

No DB migrations (Slice 43A already executed). No new code paths. No resolver
changes. No new pricing logic. Snapshot schema unchanged.

---

## Validation

### TypeScript

`npx tsc --noEmit` → **clean (exit 0)** after the cleanup.

The first attempt surfaced one error (`row[field]` could not index
`JobWorksheetRow` because `'unit_price'` no longer matched a row field). Fixed
by branching on the editable cell key in `getCellValue` and routing
`'unit_price'` through `resolveUnitCost`. Re-run was clean.

### `JobWorksheetRow` field check

Confirmed via grep that no `JobWorksheetRow` remains with `unit_price` or
`total_price` fields. All remaining `.unit_price` / `.total_price` references
are on different types (`PricingRow`, `ProposalLineItem`, `ProposalSnapshotItem`,
catalog source rows).

### DB read/write paths

No `select`, `insert`, or `update` against `job_worksheet_items` references
`unit_price` or `total_price`:

- All worksheet CRUD goes through `buildPatch` / `buildCreateInput` (already
  resolution-only since slice 40A).
- All proposal reads use `select('*')`, which silently omits dropped columns.
- `duplicateEstimate` (fixed in Slice 41) writes resolution columns only.
- CSV import (`worksheetCsv.ts`) writes resolution columns only.

### `current.md`

Updated. See section below.

---

## Risks

1. **`select('*')` returning row objects without `unit_price`/`total_price`.**
   Already the post-Slice 43A reality. The repo no longer types these fields,
   so any code attempting to read them would have failed type-checking — and
   none does. No runtime risk.

2. **CSV export header still emits `unit_price` as a column name.** This is
   intentional (external-facing label). Existing CSV files generated before
   today continue to work for re-import; the import path reads the
   `unit_price` header and writes to `unit_cost_manual`.

3. **Legacy snapshots in `proposal_documents.snapshot_json`.** Snapshot items
   have a `unit_price` field on `ProposalSnapshotItem` (resolved value, not
   the legacy DB column). All existing snapshots remain readable. Snapshot
   schema is unchanged per hard constraints.

4. **Worksheet column key `'total_price'` → `'row_total'` rename.** This is a
   pure UI identifier; not persisted, not referenced by any external system.
   Verified via grep that no other code references the column key string
   `'total_price'`.

5. **`'unit_price'` editable cell key retained as UI/CSV terminology.** The
   state hook continues to translate it to `unit_cost_manual` /
   `unit_cost_override` writes. Renaming would be cosmetic only and break
   nothing externally — but also benefit nothing.

---

## Slice Report Path

`docs/modules/estimate/slice_43b_repo_cleanup_after_legacy_pricing_removal.md`

---

## current.md Update Status

Updated. Slice 43B added to the recent-work list and reports list. Known-gaps
entry for "Legacy DB columns remain on disk" removed. Next-recommended-work
trimmed to reflect the closed migration arc.
