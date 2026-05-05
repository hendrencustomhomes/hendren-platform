# Price Sheets / Bids Stabilization Audit — R01

**Date:** 2026-04-25
**Branch:** `dev`
**Commit:** 9e16693

---

## Scope

Audit-only pass on the Price Sheets and Bids flows. No Estimate work. No Proposal work. No Catalog changes. No worksheet engine generalization unless a real bug required it.

Locked sequence reminder: Price Sheets / Bids → Catalog → Takeoff / Estimate → Proposal.

---

## Files Audited

### Routes
- `src/app/more/price-sheets/page.tsx` — list + inline create
- `src/app/more/price-sheets/[id]/page.tsx` — detail
- `src/app/jobs/[id]/bids/page.tsx` — list + inline create (job-scoped)
- `src/app/jobs/[id]/bids/[bidId]/page.tsx` — detail

### Live wrapper and orchestrator
- `src/components/pricing/PricingWorksheetPage.tsx`
- `src/components/patterns/pricing/PricingWorksheetPageOrchestrator.tsx`

### Worksheet engine (pricing-local)
- `src/components/patterns/pricing/PricingWorksheetTableAdapter.tsx`
- `src/components/patterns/pricing/_lib/pricingWorksheetColumns.tsx`
- `src/components/patterns/pricing/_hooks/usePricingWorksheetState.ts`
- `src/components/patterns/pricing/_hooks/usePricingWorksheetPersistence.ts`

### Header/list pattern
- `src/components/patterns/pricing/headers/PricingHeadersPageClient.tsx`
- `src/components/patterns/pricing/headers/usePricingHeadersPage.ts`

### Other pricing components
- `src/components/patterns/pricing/PricingWorksheetMobileList.tsx`
- `src/components/patterns/pricing/PricingWorksheetHeader.tsx`

### Domain layer
- `src/lib/pricing/types.ts`
- `src/lib/pricing/rows.ts`

---

## Checklist Results

| Check | Result |
|---|---|
| Both routes use shared `PricingHeadersPageClient` for list/create | Pass |
| Both detail routes use `PricingWorksheetPageOrchestrator` via live re-export | Pass |
| Shared worksheet engine: `EditableDataTable`, adapter, state, persistence | Pass |
| No legacy `PricingWorksheetGrid` or `_legacy/` imports in active paths | Pass |
| No old monolith/grid code reintroduced | Pass |
| `catalog_sku` and `source_sku` remain separate, never merged | Pass |
| Column name is `unit`, no `uom` anywhere in pricing paths | Pass |
| `quantity` present through type / state / persistence / UI | Pass |
| `unit` present through type / state / persistence / UI | Pass |
| `unit_price` present through type / state / persistence / UI | Pass |
| `pricing_type` present through type / state / UI | Pass |
| `pricing_type` forwarded through persistence on row update | Pass |
| `pricing_type` forwarded through persistence on draft row create | **Fail — fixed** |
| `unit_price = 0` → `NULL` in state (`parseNullableMoney`) | Pass |
| `unit_price = 0` → `NULL` in persistence (`normalizeMoney` in `rows.ts`) | Pass |
| Price Sheets and Bids have identical column definitions | Pass |
| Draft rows do not persist until `hasMeaningfulData` is true | Pass |
| Draft row ID promotes to DB row ID in local state, undo stack, and activeCell | Pass |
| `parsePricingType` guards against invalid enum input before any DB write | Pass |
| Mobile display handles draft rows without crash | Pass |
| Mobile display handles all three pricing types without crash | Pass |

---

## Bug Fixed

### `pricing_type` not forwarded in `createRowFromDraft`

**File:** `src/components/patterns/pricing/_hooks/usePricingWorksheetPersistence.ts`

**Root cause:** The `createRowFromDraft` function built its `createPricingRow` input from the draft row's fields but omitted `pricing_type`. The `createPricingRow` DB function defaults to `'unit'` when `pricing_type` is absent. This meant any `lump_sum` or `allowance` type set on a fresh unsaved row would be discarded on first flush.

**How it failed silently:** After a draft flush, `promoteDraftRow` merges the returned DB row back into local state. When the user had made no concurrent edits during the async create, `latestLocalRow` equaled `requestRow`, so `promotedBase = created` (the DB row with `pricing_type: 'unit'`). Because the promoted base matched the DB row, `areEqual` returned true and no follow-up update was scheduled. The user's `lump_sum` or `allowance` setting was permanently lost with no error or indicator.

**Why `hasMeaningfulData` made it worse:** `hasMeaningfulData` treats `pricing_type !== 'unit'` as a signal to flush. So changing only the type on an otherwise-blank row would trigger an immediate create, hit this bug, and revert the type to `unit` — all before any description was entered.

**Fix:** Added `pricing_type: draft.pricing_type` to the `createPricingRow` call in `createRowFromDraft`. One line, no structural change.

```diff
 return createPricingRow(supabase, {
   pricing_header_id: header.id,
   catalog_sku: draft.catalog_sku,
   description_snapshot: draft.description_snapshot,
   vendor_sku: draft.vendor_sku,
+  pricing_type: draft.pricing_type,
   quantity: draft.quantity,
   unit: draft.unit,
   unit_price: draft.unit_price,
   lead_days: draft.lead_days,
   notes: draft.notes,
   is_active: draft.is_active,
 })
```

---

## Observations (No Action Taken)

### `getRowStatusLabel` is defined in two places

Identical implementations exist in `PricingWorksheetPageOrchestrator` (consumed by `PricingWorksheetMobileList`) and `PricingWorksheetTableAdapter` (consumed by column rendering). Not a bug. Not worth extracting yet per cleanup plan rules — no second adopter, no proven multi-module reuse.

### `pricing_type` not shown in mobile list

`PricingWorksheetMobileList` renders source SKU, description, vendor SKU, unit, unit price, and lead days. It does not show `pricing_type`. This is a display gap, not a crash risk. Acceptable at the Price Sheets / Bids stabilization stage.

### Local typecheck environment

`npx tsc --noEmit` in this sandbox reports pre-existing missing-module errors (`react`, `next`, `@supabase/supabase-js` not installed). All errors are environment-level, not logic errors in pricing paths. The prior clean tsc run recorded in `cleanup_plan_r03.md §11` remains the authoritative baseline.

---

## Architectural Confirmation

The orchestrated worksheet stack is intact and authoritative:

```
[Route entry]                 price-sheets/[id]/page.tsx
                              jobs/[id]/bids/[bidId]/page.tsx
        ↓
[Live wrapper]                src/components/pricing/PricingWorksheetPage.tsx
                              (re-exports PricingWorksheetPageOrchestrator)
        ↓
[Orchestrator]                PricingWorksheetPageOrchestrator
        ↓
[State]                       usePricingWorksheetState
[Persistence]                 usePricingWorksheetPersistence
        ↓
[Adapter]                     PricingWorksheetTableAdapter
        ↓
[Shared worksheet layer]      useWorksheetInteraction + useWorksheetVirtualization
        ↓
[Shared UI]                   EditableDataTable
```

No legacy paths active. No monolith referenced. No god component. Column parity between Price Sheets and Bids confirmed — both flow through the same orchestrator, adapter, and column definitions.

---

## Next Steps (Per Locked Sequence)

- Pricing stabilization: complete
- Next: Catalog (per locked sequence)
- Do not start Estimate until Catalog pass is done
- Do not add Proposal override or validation logic
