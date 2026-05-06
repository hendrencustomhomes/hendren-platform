# Slice 40I — Extended Cost Alignment Audit

## Goal

Verify that every place extended cost (quantity × unit price) or row total is
computed in the estimate module uses the resolved unit cost — not the legacy
`unit_price` column. Document findings. Fix any gaps found.

## Audit Scope

Paths audited:

| Path | File | Method |
|---|---|---|
| Row total display — desktop | `JobWorksheetTableAdapter.tsx` | `rowTotal(row)` column |
| Row total display — mobile | `JobWorksheetMobileView.tsx` | `rowTotal(row)` |
| Grand total — mobile header | `JobWorksheetMobileView.tsx` | `rows.reduce(rowTotal)` |
| Unit price display — desktop | `JobWorksheetTableAdapter.tsx` | `resolveUnitCost(row)` |
| Unit price display — mobile | `JobWorksheetMobileView.tsx` | `resolveUnitCost(row)` |
| Parent subtotal | `_worksheetFormatters.ts` | `parentSubtotal` → `rowTotal` |
| Inline validation label | `_worksheetValidation.ts` | `resolveUnitCost(row)` |
| Pre-send validation | `estimateValidation.ts` | `resolveUnitCost(r)` |
| Proposal line item unit_price | `proposalSummary.ts` | `resolveUnitCost(child)` |
| Proposal line item lineTotal | `proposalSummary.ts` | `rowTotal(child)` |
| Proposal section subtotal | `proposalSummary.ts` | `leafTotal` → `rowTotal` |
| Proposal grand total | `proposalSummary.ts` | sum of subtotals |
| Structured proposal unit_price | `proposalStructure.ts` | `resolveUnitCost(child/sourceRow)` |
| Structured proposal lineTotal | `proposalStructure.ts` | `rowTotal(child/sourceRow)` |
| Structured proposal subtotal | `proposalStructure.ts` | `leafTotal` → `rowTotal` |
| Structured proposal grand total | `proposalStructure.ts` | sum of subtotals |
| CSV export unit_price column | `JobWorksheetPageOrchestrator.tsx` | `resolveUnitCost(row)` |
| CSV import unit_price column | `worksheetCsv.ts` | reads CSV → `unit_cost_manual` |
| Write: linked row edit | `useJobWorksheetState.ts` | → `unit_cost_override` |
| Write: manual row edit | `useJobWorksheetState.ts` | → `unit_cost_manual` |
| Write: create new row | `useJobWorksheetState.ts` | → `unit_cost_manual` |

## Findings

**All paths already route through `resolveUnitCost` or `rowTotal`.**

No gaps were found. Every quantity × price multiplication reaches the resolver:

- `rowTotal` is the single entry point for `qty * price` and calls
  `resolveUnitCost(row)` internally.
- `parentSubtotal` and `leafTotal` recurse via `rowTotal`.
- `ProposalLineItem.unit_price` is set to `resolveUnitCost(child)` in both
  `buildProposalSummary` and `applyStructure`.
- `ProposalLineItem.lineTotal` is set to `rowTotal(child)` in both builders.
- The pre-send validator and the inline row validator both call `resolveUnitCost`.
- The CSV export emits `resolveUnitCost(row)` as the `unit_price` column value.
- The CSV importer reads the `unit_price` column and writes it to `unit_cost_manual`
  (not the legacy `unit_price` column).

## Out-of-Scope Usages Confirmed Correct

The following `unit_price` references are **not** estimate extended cost computations:

| Location | Nature | Status |
|---|---|---|
| `src/components/patterns/pricing/` | Pricing module's own source data field | Correct — different domain |
| `src/app/more/catalog/` | Catalog display of pricing row prices | Correct — display only |
| `worksheet-pricing-actions.ts` L220 | Copies pricing row `unit_price` → `unit_cost_source` at link time | Correct — this is the link write path |
| `worksheet-pricing-actions.ts` L345, 351 | Reads live `unit_price` for sync comparison | Correct — sync logic only |
| `PricingLinkModal.tsx` L142-144 | Displays pricing row `unit_price` in the link picker UI | Correct — display of source, not resolution |
| `proposal/page.tsx`, `preview/`, `pdf/`, `documents/` | Displays `item.unit_price` from `ProposalLineItem` | Correct — resolved value from `buildProposalSummary`/`applyStructure` |

## Files Changed

None. Audit result: clean.

## Pre-existing TypeScript Errors

`npx tsc --noEmit` surfaced pre-existing errors unrelated to this series:

| File | Error | Pre-existing? |
|---|---|---|
| `proposal/builder/page.tsx` | `activeEstimate` possibly null | Yes — not touched in 40A-40I |
| `proposal/documents/.../page.tsx` | Props type mismatch | Yes |
| `proposal/page.tsx` | Props type mismatch | Yes |
| `proposal/pdf/page.tsx` | Props type mismatch | Yes |
| `jobs/new/page.tsx` | Implicit any in binding | Yes |
| `layout.tsx` | CSS side-effect import | Yes |
| `CatalogDetailPage.tsx` | React namespace missing | Yes |

None of these are in files touched by the 40A–40I series.

## Invariants Confirmed After 40I

1. `resolveUnitCost` is the **only** implementation of the three-way precedence
   rule (override → source → manual).
2. `rowTotal` is the **only** place that multiplies quantity by resolved unit cost.
3. No call site reaches a raw `unit_price` column from `job_worksheet_items` for
   cost computation.
4. The legacy `unit_price` column is preserved but unused for resolution,
   consistent with the comment in `JobWorksheetRow`:
   `// Legacy column — kept for snapshot compatibility. Do NOT use for resolution.`

## Out of Scope

- DB changes
- New pricing fields
- UI changes
- Removing legacy `unit_price`
- Resolver precedence changes
