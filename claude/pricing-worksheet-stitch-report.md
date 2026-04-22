# Pricing Worksheet Stitch Report

**Date:** 2026-04-22  
**Branch:** dev  
**Commit:** 41e5043

## What Was Done

### Files Created
- `src/components/pricing/PricingWorksheetPage.next.tsx` — adjacent replacement file with the four required changes
- `src/components/pricing/PricingWorksheetPage.pre_stitch_backup.tsx` — backup of original before stitch

### Files Modified
- `src/components/pricing/PricingWorksheetPage.tsx` — stitched in place via `scripts/apply-pricing-worksheet-stitch.mjs`

## Changes Applied (Exactly Four, No Scope Drift)

### 1. Row creation validation
- Removed: `if (!newCatalogSku) { setError('Catalog item is required.') }`
- Added: `if (!newDescription.trim()) { setError('Description is required.') }`
- `catalog_sku` is now `newCatalogSku || null` (optional/nullable)
- `description_snapshot` is now the required field, passed as `newDescription` directly

### 2. Input row UI label
- Changed `<option value="">Select catalog item</option>`
- To: `<option value="">Optional catalog link</option>`

### 3. Desktop unit_price display
- When cell is NOT active: displays `formatMoney(row.unit_price)` (formatted USD, e.g. `$1,234.56`)
- When cell IS active (being edited): displays raw `activeDraft` (numeric string)
- No change to mobile view (mobile already uses `formatMoney` via the `Field` component)

### 4. parseNullableNumber — strip formatting
- Added `.replace(/[$,]/g, '')` before parsing
- Handles pasted values like `$1,234.56` or `1,234.56` safely

## Stitch Process
```
node scripts/apply-pricing-worksheet-stitch.mjs
[stitch] Replacement applied.
```

## Build Result
Build succeeded (TypeScript clean, all 23 pages generated) with standard environment variables set.

## Push
Pushed to `dev` as commit `41e5043`.
