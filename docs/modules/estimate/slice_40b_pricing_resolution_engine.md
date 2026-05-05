# Slice 40B — Unit Cost Pricing Resolution Engine

## Overview

Introduced a single, authoritative resolver for the effective unit cost of a
worksheet row. All pricing reads now go through `resolveUnitCost(row)`. No
resolved value is stored; resolution is always computed at read time.

---

## Resolver

**Location:** `src/components/patterns/estimate/_lib/unitCostResolver.ts`

```typescript
export function resolveUnitCost(row: UnitCostRow): number | null
```

**Precedence rules:**

| Priority | Condition | Value used |
|---|---|---|
| 1 | `unit_cost_is_overridden === true` | `unit_cost_override` |
| 2 | `pricing_source_row_id !== null` | `unit_cost_source` |
| 3 | (manual row) | `unit_cost_manual` |

The function is pure: no side effects, no React, no DB access. It can be
imported freely in both client components and server actions.

---

## DB Fields (job_worksheet_items)

| Column | Description |
|---|---|
| `unit_cost_manual` | Price typed by a user on an unlinked row |
| `unit_cost_source` | Price copied from the linked pricing row at link time |
| `unit_cost_override` | Price typed by a user on a linked row (override) |
| `unit_cost_is_overridden` | Boolean flag — true when an override is in effect |
| `unit_price` | Legacy column — kept for snapshot compatibility; not used for resolution |

---

## Write Paths

### Manual row edit
User edits the price cell on a row with no pricing link:
- Writes `unit_cost_manual`

### Linked row edit (override)
User edits the price cell on a row that has `pricing_source_row_id` set.
A confirm dialog ("Override linked price?") is shown first:
- Writes `unit_cost_override`
- Sets `unit_cost_is_overridden = true`
- The link (`pricing_source_row_id`) is **kept**

### Link action
User selects a pricing row from the Link modal:
- Sets `pricing_source_row_id` and `pricing_header_id`
- Copies `unit_price` from the pricing row → `unit_cost_source`
- Clears `unit_cost_override`, sets `unit_cost_is_overridden = false`

### Accept source
User clicks "Accept" on a row that has `unit_cost_is_overridden = true`.
Reverts to the linked source price:
- Clears `unit_cost_override`
- Sets `unit_cost_is_overridden = false`

### Detach (Unlink)
User clicks "Unlink". Before clearing the link, the server action computes the
current resolved cost (using the same precedence rules) and preserves it:
- Resolved cost → `unit_cost_manual`
- Clears `unit_cost_source`, `unit_cost_override`
- Sets `unit_cost_is_overridden = false`
- Clears `pricing_source_row_id`, `pricing_header_id`

---

## Files Changed

| File | Change |
|---|---|
| `src/components/patterns/estimate/_lib/unitCostResolver.ts` | **New** — resolver + `UnitCostRow` type |
| `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx` | Added `unit_cost_*` fields to `JobWorksheetRow`; display uses resolver; Accept button |
| `src/components/patterns/estimate/_worksheetFormatters.ts` | `rowTotal` uses resolver |
| `src/components/patterns/estimate/_worksheetValidation.ts` | `validationLabel` uses resolver |
| `src/components/patterns/estimate/_hooks/useJobWorksheetState.ts` | Write paths write to `unit_cost_manual`/`unit_cost_override`; equality checks updated |
| `src/components/patterns/estimate/_hooks/useJobWorksheetPersistence.ts` | Patch/create input types updated |
| `src/app/actions/worksheet-pricing-actions.ts` | `linkRowToPricing`, `unlinkRowFromPricing` updated; `acceptPricingSource` added |
| `src/lib/estimateValidation.ts` | `ValidatableRow` updated; `zeroPrice` check uses resolver |
| `src/lib/proposalSummary.ts` | `buildProposalSummary` uses resolver for `unit_price` in `ProposalLineItem` |
| `src/lib/proposalStructure.ts` | `applyStructure` uses resolver for `unit_price` in `ProposalLineItem` |
| `src/components/patterns/estimate/JobWorksheetMobileView.tsx` | Price input displays resolved value |
| `src/components/patterns/estimate/JobWorksheetPageOrchestrator.tsx` | CSV export uses resolved value |
| `src/lib/worksheetCsv.ts` | Import writes to `unit_cost_manual` instead of legacy `unit_price` |

---

## Out of Scope

- Removing the legacy `unit_price` column
- UI icons/badges indicating override state
- Pricing sync jobs
- Quantity / extended cost logic
