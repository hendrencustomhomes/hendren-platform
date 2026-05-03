# Slice 17 — Worksheet ↔ Pricing Source Link

## Files Changed

### New files
| Path | Purpose |
|---|---|
| `src/app/actions/worksheet-pricing-actions.ts` | Server actions: `linkRowToPricing`, `unlinkRowFromPricing` |
| `src/components/patterns/estimate/PricingLinkModal.tsx` | Two-step modal for picking a pricing header then row |

### Modified files
| Path | Change |
|---|---|
| `src/components/patterns/estimate/_hooks/useJobWorksheetPersistence.ts` | Extended `UpdateJobWorksheetRowPatch` with optional `pricing_source_row_id` and `pricing_header_id` fields |
| `src/components/patterns/estimate/_hooks/useJobWorksheetState.ts` | Extended `areEditableFieldsEqual` to compare link fields; extended `buildPatch` to include link fields when null; added link-drop logic to `commitCellValue`; exposed `forceUpdateRow` |
| `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx` | Added `jobId`, `activeEstimateId`, `forceUpdateRow` props; added `PricingSourceBadge` component; added Source badge column; added Link/Unlink buttons to actions column; added unit_price confirm dialog; integrated `PricingLinkModal` |
| `src/components/patterns/estimate/JobWorksheetPageOrchestrator.tsx` | Destructured `forceUpdateRow` from state hook; passed `jobId`, `activeEstimateId`, `forceUpdateRow` to adapter |

---

## Server Actions Added / Modified

### `linkRowToPricing(rowId, estimateId, pricingRowId, jobId)`
- Parallel-fetches the `pricing_rows` row (must be `is_active = true`) and the worksheet item's current `unit`
- UPDATEs `job_worksheet_items` scoped by `id + estimate_id` setting: `pricing_source_row_id`, `pricing_header_id`, `unit_price`, `unit` (COALESCE: source unit if non-null, else existing), `catalog_sku`, `source_sku`
- Does NOT touch `quantity`, `description`, `pricing_type`, or `total_price`
- Returns the full updated row for optimistic local state update
- Calls `revalidatePath` for the worksheet route

### `unlinkRowFromPricing(rowId, estimateId, jobId)`
- UPDATEs `job_worksheet_items` scoped by `id + estimate_id` setting `pricing_source_row_id = NULL`, `pricing_header_id = NULL`
- Leaves `unit_price`, `catalog_sku`, `source_sku`, `unit` intact (last linked values remain as starting point)
- Returns the full updated row
- Calls `revalidatePath`

### `persistRow` modification (via `buildPatch` in `useJobWorksheetState`)
- `buildPatch` now includes `pricing_source_row_id: null` and `pricing_header_id: null` in the DB patch when the local row has those fields as null
- `commitCellValue` detects `field === 'unit_price'` on a linked row and also clears `pricing_source_row_id`/`pricing_header_id` from the local `next` row before saving — this is the server-side clearing that executes after UI confirm

---

## UI Components Added / Modified

### `PricingSourceBadge` (inline in `JobWorksheetTableAdapter.tsx`)
- Renders a `Linked` badge (blue tint) with tooltip showing SKU when `pricing_source_row_id !== null`
- Renders a `Manual` badge (muted) when null
- Shown in a new `Source` column (90px) immediately after `Unit Price`

### Link action button
- Every row has a `Link` button in the actions column
- Opens `PricingLinkModal` for that row

### Unlink action button
- Only shown when `pricing_source_row_id !== null`
- Calls `unlinkRowFromPricing` immediately (no confirm)
- Updates local state optimistically via `forceUpdateRow`

### `PricingLinkModal`
- Two-column layout: Step 1 picks a `pricing_headers` entry (grouped by kind: Price Sheets / Bids, all `is_active = true`); Step 2 picks a `pricing_rows` entry from the selected header (`is_active = true`, shows description + price/unit + SKU sublabel)
- Uses client-side Supabase for reads (consistent with worksheet persistence pattern)
- On confirm calls `linkRowToPricing` server action; on success calls `onLinked(updatedRow)` to update local state and closes

### Unit price confirm dialog
- `wrappedCommitCellValue` in the adapter intercepts `unit_price` commits on linked rows
- Shows a modal confirm: "Drop price link?" with Cancel / Confirm buttons
- Cancel: dismisses dialog, cell reverts to saved value (commit never fires)
- Confirm: fires the actual `commitCellValue`, which clears link fields on the local row and schedules a DB flush

---

## Confirmed-Fixed vs Improved-Only

| Item | Status |
|---|---|
| `linkRowToPricing` server action | Implemented |
| `unlinkRowFromPricing` server action | Implemented |
| `persistRow` drops link on manual unit_price edit | Implemented via `buildPatch` + `commitCellValue` |
| `Manual` / `Linked` badge per row | Implemented |
| Link modal (2-step header→row picker) | Implemented |
| Unlink action (no confirm) | Implemented |
| Unit price confirm dialog | Implemented |
| All UPDATEs scoped by `id + estimate_id` | Confirmed |
| Proposal summary/preview/PDF/snapshot paths untouched | Confirmed — no changes to proposal/* or lib/proposal* |
| TypeScript clean | Confirmed — `tsc --noEmit` passes with zero errors |

---

## Manual Test Steps

1. **Manual badge**: Open a worksheet row with no link → Source column shows `Manual` badge.

2. **Link flow**: Click `Link` → modal opens. Step 1 shows active pricing headers grouped by Price Sheets / Bids. Select a header → Step 2 shows its active rows with description + price/unit/SKU. Select a row → click `Link`. Modal closes. Badge changes to `Linked`. `unit_price` updated to source value. `unit`, `catalog_sku`, `source_sku` populated.

3. **Manual price edit on linked row**: Click a `unit_price` cell on a `Linked` row and change the value. Confirm dialog appears: "Drop price link?". Click `Confirm` → value saves, badge flips to `Manual`, `pricing_source_row_id` and `pricing_header_id` are NULL in DB. Click `Cancel` → dialog dismisses, cell retains old price, link intact.

4. **Unlink**: Click `Unlink` on a linked row → no confirm, row immediately shows `Manual` badge. `unit_price` retains the last linked value.

5. **Re-link after unlink**: Click `Link` again → can re-link to any source. Works as in step 2.

6. **Proposal paths**: Open `/jobs/[id]/proposal/builder`, preview, PDF export — all render unchanged.

---

## Deviations from Prompt

None. All specified behaviors implemented as described. The `source_sku` column (not called out explicitly in the slice's SELECT list but present on `pricing_rows`) is included in both `linkRowToPricing` and the `PricingLinkModal` sublabel for completeness — consistent with the schema table in the spec.
