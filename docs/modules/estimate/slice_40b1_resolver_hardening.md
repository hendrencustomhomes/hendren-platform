# Slice 40B.1 — Resolver Hardening

## Goal

Enforce `resolveUnitCost` as the single source of truth with zero duplicated
resolution logic anywhere in the codebase.

## Duplicate Found

**File:** `src/app/actions/worksheet-pricing-actions.ts`  
**Function:** `unlinkRowFromPricing`  
**Lines (before fix):** 284–288

```typescript
// Inline duplicate — did not call the resolver
const resolvedCost: number | null = item.unit_cost_is_overridden
  ? (item.unit_cost_override ?? null)
  : item.pricing_source_row_id !== null
    ? (item.unit_cost_source ?? null)
    : (item.unit_cost_manual ?? null)
```

This ternary was a hand-written copy of the three-way precedence rule that
`resolveUnitCost` already encodes. Any future change to resolver precedence
(e.g. adding a new pricing tier) would have required updating two places.

## Fix

Imported `resolveUnitCost` into the server action file and replaced the inline
ternary with a single resolver call:

```typescript
import { resolveUnitCost } from '@/components/patterns/estimate/_lib/unitCostResolver'

// In unlinkRowFromPricing:
const resolvedCost = resolveUnitCost(item)
```

## Audit — Other `unit_cost_is_overridden` / `pricing_source_row_id` Usages

The following usages were reviewed and confirmed **not** to be resolution logic:

| Location | Usage | Classification |
|---|---|---|
| `JobWorksheetTableAdapter.tsx:71` | `isLinked = pricing_source_row_id !== null` | UI badge state |
| `JobWorksheetTableAdapter.tsx:141` | `unit_cost_is_overridden && <Accept button>` | UI action gate |
| `useJobWorksheetState.ts:85` | branch to decide *which field to write* | Write routing |
| `useJobWorksheetState.ts:112` | `if (pricing_source_row_id === null) patch.pricing_source_row_id = null` | Patch building |
| `useJobWorksheetState.ts:150–152` | equality comparisons in `areEditableFieldsEqual` | Dirty-checking |
| `EstimateHealthSummary.tsx:19` | count of linked rows | Aggregate reporting |

None of the above perform cost resolution. All resolution reads go through
`resolveUnitCost`.

## Invariants After 40B.1

1. `resolveUnitCost` is the **only** place that implements the three-way
   precedence rule (override → source → manual).
2. Write paths only update raw storage fields (`unit_cost_manual`,
   `unit_cost_override`, `unit_cost_is_overridden`). They never compute a
   resolved value to store.
3. `unit_cost_source` is written only by `linkRowToPricing`.
4. Detach (`unlinkRowFromPricing`) calls `resolveUnitCost` to snapshot the
   effective cost into `unit_cost_manual` before clearing the link.

## Files Changed

| File | Change |
|---|---|
| `src/app/actions/worksheet-pricing-actions.ts` | Import `resolveUnitCost`; replace inline ternary |
| `docs/modules/estimate/slice_40b_pricing_resolution_engine.md` | Added 40B.1 summary section |
| `docs/modules/estimate/slice_40b1_resolver_hardening.md` | **New** — this document |

## Validation

- `grep -rn "unit_cost_is_overridden" src/` — only the resolver and
  legitimate type/write/equality usages remain; no branching on the field
  outside the resolver.
- `npx tsc --noEmit` — no new type errors introduced.
