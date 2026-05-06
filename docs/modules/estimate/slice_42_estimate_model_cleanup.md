# Slice 42 — Estimate Model Cleanup and Legacy Pricing Removal Audit

Status: complete
Branch: `dev`
Date: 2026-05-06

---

## Goal

Audit remaining `unit_price` / `total_price` usages across the codebase.
Produce a concrete DB migration plan for legacy column removal. Fix the
`SnapshotCreateButton` visibility mismatch. Align `linkRowToPricing` and
`syncLinkedPricing` permission checks with their peers. Update the stale
"snapshot compatibility" comment on the legacy type fields.

---

## Audit: `unit_price` / `total_price` Usages

Full grep of `src/` for `unit_price` and `total_price` (all files, all extensions).
All occurrences catalogued by domain:

### A. `pricing_rows.unit_price` — pricing module source field (different table)

| File | Role |
|---|---|
| `src/app/actions/worksheet-pricing-actions.ts:29,144,220,345,351` | Reads live `pricing_rows.unit_price` to copy into `unit_cost_source` at link/sync time. Correct source-side read. |
| `src/app/more/catalog/_components/CatalogDetailPage.tsx:33,133,431` | Displays catalog source row's `unit_price`. Display of source data. |
| `src/components/patterns/estimate/PricingLinkModal.tsx:142–144` | Displays the pricing source row's `unit_price` in the link picker. Display of source, not resolution. |
| `src/components/patterns/pricing/**` | Pricing module's own worksheet (different family, different source data). |
| `src/lib/pricing/revisions.ts`, `rows.ts`, `types.ts` | Pricing module's own CRUD for `pricing_rows`. |

These are all `pricing_rows.unit_price` — a different table from `job_worksheet_items`. None of these are legacy and none should be changed.

### B. `ProposalLineItem.unit_price` — resolved value in proposal objects

| File | Role |
|---|---|
| `src/lib/proposalSummary.ts:14,66` | Type field; set from `resolveUnitCost(child)`. |
| `src/lib/proposalStructure.ts:118,165` | Set from `resolveUnitCost(child/sourceRow)`. |
| `src/lib/proposalSnapshot.ts:18` | Type field in snapshot item type; value is already-resolved. |
| `src/app/actions/document-actions.ts:122,237` | Writes `item.unit_price` into `snapshot_json`. `item` is a `ProposalLineItem`; its `unit_price` was set by `resolveUnitCost` in `applyStructure`. Never the DB column. |
| `src/app/jobs/[id]/proposal/page.tsx:57` | Renders `item.unit_price` from `ProposalLineItem`. |
| `src/app/jobs/[id]/proposal/preview/page.tsx:271` | Same. |
| `src/app/jobs/[id]/proposal/pdf/page.tsx:170` | Same. |
| `src/app/jobs/[id]/proposal/documents/[documentId]/page.tsx:144` | Renders `item.unit_price` from `ProposalSnapshotItem`. |

These are all the resolved `ProposalLineItem` / `ProposalSnapshotItem` `unit_price` field — not the legacy DB column. None should be changed; renaming would require a snapshot schema migration.

### C. `job_worksheet_items.unit_price` / `total_price` — legacy DB columns

| File | Role | Status |
|---|---|---|
| `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx:44–45` | Type fields on `JobWorksheetRow`; fetched from DB via `select('*')`. | Needed until column removal. |
| `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx:57,63,94,103,239,245,414` | `'unit_price'` used as editable cell key; `'total_price'` used as static column key. State layer translates 'unit_price' commits to `unit_cost_manual` / `unit_cost_override` — the DB column is never written. | Needed until column removal. |
| `src/components/patterns/estimate/JobWorksheetMobileView.tsx:91` | `commitCellValue(row.id, 'unit_price', ...)` — same: 'unit_price' is the commit key; state translates it. DB column not written. | Needed until column removal. |
| `src/components/patterns/estimate/_hooks/useJobWorksheetState.ts:82,325–326` | `case 'unit_price':` translates commit to resolution column writes; `unit_price: null, total_price: null` in draft row default (type satisfaction). DB column not written. | Needed until column removal. |
| `src/lib/worksheetCsv.ts:9,108` | `'unit_price'` CSV column header; value is parsed and written to `unit_cost_manual`, never to the DB `unit_price` column. | Needed until column removal. |

**Key finding:** No active write path writes to `job_worksheet_items.unit_price` or `job_worksheet_items.total_price`. All DB interactions that reference these names either (a) read them from `select('*')` queries (not relied on for any business logic) or (b) use the string `'unit_price'`/`'total_price'` as column identifiers within the worksheet UI, which the state layer translates into the correct resolution columns before persistence.

The `buildPatch` function (used by `persistWorksheetRow`) and `buildCreateInput` (used by `createWorksheetRow`) do not include `unit_price` or `total_price`. The `duplicateEstimate` fix in Slice 41 removed the last write path that propagated these forward.

**Conclusion: the columns are safe to remove from the DB schema.**

---

## DB Migration Plan

The following migration is safe to apply once approved. It requires no data
migration — the columns are not relied on by any read path for business logic,
and they have not been written by any active path since Slice 41.

**Prerequisite checks before applying:**

1. Confirm no pending `job_worksheet_items` rows rely on `unit_price` for display
   (a simple `SELECT count(*) FROM job_worksheet_items WHERE unit_price IS NOT NULL`
   to understand scope; the values are never read by resolver logic regardless).
2. Confirm `proposal_documents.snapshot_json` does not contain `item.unit_price`
   sourced from the DB column (confirmed: snapshot items' `unit_price` is
   `resolveUnitCost`-derived from `ProposalLineItem`, not the DB column).
3. Run TypeScript typecheck after removing the type fields from `JobWorksheetRow`.

**Migration SQL (do NOT apply without explicit approval):**

```sql
-- Remove legacy pricing columns from job_worksheet_items.
-- These columns have not been written by any active code path since Slice 41.
-- All resolution is handled by unit_cost_manual, unit_cost_source, unit_cost_override,
-- unit_cost_is_overridden.
ALTER TABLE job_worksheet_items
  DROP COLUMN IF EXISTS unit_price,
  DROP COLUMN IF EXISTS total_price;
```

**Code changes required alongside the migration (do NOT apply until migration executes):**

1. `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx`
   - Remove `unit_price` and `total_price` fields from `JobWorksheetRow` type.
   - Rename the static Total column key from `'total_price'` to `'row_total'`
     (it already reads `rowTotal(row)`; the key is just a string identifier).

2. `src/components/patterns/estimate/_hooks/useJobWorksheetState.ts`
   - Remove `unit_price: null` and `total_price: null` from the draft row default.
   - These satisfy the type; removing the type fields makes them dead code.

3. `src/lib/worksheetCsv.ts`
   - The CSV import reads the `unit_price` column header from the CSV file and
     writes the value to `unit_cost_manual`. This is correct import behavior.
     When the DB column is dropped, the CSV column name ('unit_price') can be
     renamed in the header line (line 9) and the import instruction comment
     updated for clarity, but the mapping logic is already correct.

These code changes are out of scope for Slice 42; they belong in the migration
slice that actually drops the columns.

---

## Fixes Performed

### 1. `SnapshotCreateButton` visibility (preview page)

**File:** `src/app/jobs/[id]/proposal/preview/page.tsx:172`

**Before:** `{proposalStatus !== 'voided' && <SnapshotCreateButton ... />}`

**After:** `{proposalStatus === 'draft' && <SnapshotCreateButton ... />}`

**Rationale:** `createProposalSnapshot` only accepts estimates with
`status === 'active' || status === 'staged'`. After the proposal is sent or
signed, `proposal_structures.proposal_status` is `'sent'` or `'signed'`,
and the estimate's own status is `'sent'` or `'signed'` — both fail the
eligibility check. The old condition (`!== 'voided'`) meant the button
remained visible for `sent` and `signed` proposals, displaying a server-side
error when clicked. The new condition `=== 'draft'` matches the action's
eligibility contract: snapshots are a pre-send artifact, appropriate only
while the proposal is in draft.

Note: the `SnapshotCreateButton` is already inside an `{activeEstimate && ...}`
guard (line 162), so it was not rendered when `activeEstimate` was null. The
fix tightens the inner condition so the button is hidden by the proposal status
itself, independent of the outer guard.

### 2. `linkRowToPricing` — added `requireModuleAccess`

**File:** `src/app/actions/worksheet-pricing-actions.ts`

`linkRowToPricing` was missing the `requireModuleAccess(auth.user.id, 'estimates', 'edit')`
call that its peers `unlinkRowFromPricing` and `acceptPricingSource` both have.
The function still gated on `isEstimateEditable`, `getCurrentPricingAccess(canManage)`,
and job ownership, so writes were still authorized — but the permission check
was asymmetric. Added the guard immediately after the `requireUser` check,
matching the exact pattern used by peer actions.

### 3. `syncLinkedPricing` — added `requireModuleAccess`

**File:** `src/app/actions/worksheet-pricing-actions.ts`

Same gap as `linkRowToPricing`. `syncLinkedPricing` was also missing
`requireModuleAccess(auth.user.id, 'estimates', 'edit')` while its peers
(`unlinkRowFromPricing`, `acceptPricingSource`) have it. Fixed with the
same pattern. The Slice 41 risk note called out `linkRowToPricing`; this
slice extends the fix to the complete set of asymmetric actions.

### 4. Updated stale comment on `JobWorksheetRow` legacy fields

**File:** `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx:43`

The comment "Legacy column — kept for snapshot compatibility. Do NOT use for
resolution." was slightly misleading: the columns are not actually read for
snapshot output (snapshot items carry the `resolveUnitCost`-derived value, not
the raw DB column). Updated to: "Legacy DB columns. No longer written by any
active write path. Pending schema removal. Do NOT use for resolution."

---

## Files Changed

| File | Change |
|---|---|
| `src/app/jobs/[id]/proposal/preview/page.tsx` | `proposalStatus !== 'voided'` → `proposalStatus === 'draft'` for `SnapshotCreateButton` visibility. |
| `src/app/actions/worksheet-pricing-actions.ts` | Added `requireModuleAccess` guard to `linkRowToPricing` and `syncLinkedPricing`. |
| `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx` | Updated stale comment on legacy `unit_price`/`total_price` type fields. |
| `docs/modules/estimate/slice_42_estimate_model_cleanup.md` | This file. |
| `docs/actions/current.md` | Updated to mark Slice 42 complete; updated next-recommended work. |

No DB migrations. No new tables. No new components. No resolver changes.

---

## Validation

### TypeScript

`npx tsc --noEmit` → **clean (exit 0)** after all changes.

### Reasoning

- `SnapshotCreateButton`: condition change from `!== 'voided'` to `=== 'draft'`
  is a subset — the button now appears for fewer states, never for more. No
  regression possible.
- `requireModuleAccess` additions: pure authorization hardening. No change to
  the successful code path; existing errors are still returned; a new class
  of callers (those lacking module access) now receive a permission error
  instead of reaching the downstream logic. Both downstream checks
  (`isEstimateEditable`, `getCurrentPricingAccess`) remain in place.
- Comment update: no behavioral change.

---

## DB Migration Status

**Planned, not executed.** The migration SQL is documented above. Execution
requires explicit approval. The code changes that must accompany the migration
(removing `unit_price`/`total_price` from `JobWorksheetRow`, renaming the
`'total_price'` column key, removing draft row defaults) are also documented
but not yet applied.

---

## Invariants Confirmed After Slice 42

All Slice 41 invariants remain valid. Additionally:

7. `SnapshotCreateButton` is only rendered when `proposalStatus === 'draft'`,
   matching the `createProposalSnapshot` action's `active || staged` eligibility
   contract. No visible action can be attempted from an ineligible proposal state.
8. All four pricing-link write actions (`linkRowToPricing`, `unlinkRowFromPricing`,
   `acceptPricingSource`, `syncLinkedPricing`) now uniformly call
   `requireModuleAccess(auth.user.id, 'estimates', 'edit')` as their first
   post-auth guard.
9. No active write path writes to `job_worksheet_items.unit_price` or
   `job_worksheet_items.total_price`. Migration is safe to schedule.
