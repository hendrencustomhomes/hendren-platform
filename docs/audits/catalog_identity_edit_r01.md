# Catalog Identity Edit — R01

**Date:** 2026-04-25
**Branch:** `dev`
**Locked sequence position:** Step 2 of 4 — Catalog (identity edit pass)

---

## Status

**PASS**

Catalog identity editing is implemented, boundary-clean, and structurally minimal. No new files created. No domain layer changes required. No lib changes required.

---

## Files Changed

| File | Change |
|---|---|
| `src/app/more/catalog/_components/CatalogDetailPage.tsx` | Added edit state, handlers, form, trade→cost-code filtering |

No other files changed. `catalog.ts`, `types.ts`, route files, and the source pricing section are all unchanged.

---

## Behavior Implemented

### Edit button

- Visible only when `access.canManage` is true (from `getCurrentPricingAccess('catalog')` called on load)
- Hidden when editing is active
- Clicking Edit initializes all draft fields from the current committed `item` state, then shows the edit form

### Edit form fields

| Field | Input | Notes |
|---|---|---|
| `catalog_sku` | Read-only display (outside edit block) | Immutable — never editable |
| `title` | `<input>` | Required |
| `description` | `<textarea>` | Optional |
| `trade` | `<select>` from loaded trades | Required — changing trade triggers cost code filter |
| `cost code` | `<select>` from filtered cost codes | Required — auto-resets to first valid option on trade change |
| `default_unit` | `<input>` | Optional, trimmed to null on save |
| `active/inactive` | `<input type="checkbox">` | Toggles `is_active` |

### Trade → cost code filtering

`editFilteredCostCodes` is a `useMemo` that keeps only cost codes matching `editTradeId` (or all if the cost code has no `trade_id`). A `useEffect` watches `[editTradeId, editFilteredCostCodes, editCostCodeId, editing]` — if the selected cost code is no longer in the filtered list, it resets to `editFilteredCostCodes[0]`. Effect is guarded by `!editing` so it only runs during active edit sessions.

### Validation (client-side, on save)

- `editTitle.trim()` must be non-empty
- `editTradeId` must be non-empty
- `editCostCodeId` must be non-empty
- Failure sets `saveError` inline; does not submit to DB

### Save

- Calls `updateCatalogItem(supabase, item.id, { title, description, trade_id, cost_code_id, default_unit, is_active })`
- `title` is trimmed before send; `description` and `default_unit` are trimmed and coerced to `null` if empty — normalization is duplicated in the domain layer (`catalog.ts`) but is harmless client-side pre-trim
- On success: `setItem(updated)` with the returned DB row, then `setEditing(false)`
- On error: `setSaveError(message)` — form stays open, save error displayed inline
- `saving` state toggled in `try/finally` — cannot get stuck

### Cancel

- `setEditing(false)` + `setSaveError(null)`
- Does not alter `item` — committed state is unchanged and re-displayed immediately
- Cancel button is `disabled` while saving in progress to prevent mid-save cancellation

### After save

- `item` is replaced with the DB-returned row
- Nav title (`<Nav title={item.title}>`) updates to reflect the new title
- View fields reflect updated values immediately
- Source pricing section is unaffected — re-renders with the same `sources` state

---

## Boundary Verification

| Constraint | Verified |
|---|---|
| `catalog_sku` is immutable and not editable | ✅ SKU rendered as static field outside the `editing ? ... : ...` block |
| `source_sku` is read-only | ✅ `source_sku` only appears in the source display section; no input or mutation |
| Source pricing section unchanged | ✅ Source section code is byte-identical to the pre-edit version |
| No pricing row mutation | ✅ Only `updateCatalogItem` is called; `updatePricingRow` is not imported or referenced |
| No bid/request/estimate/proposal logic | ✅ No such imports or calls anywhere in the file |
| No worksheet UI introduced | ✅ Edit UI is a plain form within the identity card |
| Edit gated on `canManage` | ✅ `{canManage && !editing && <button>Edit</button>}` |
| Domain functions used as-is | ✅ `updateCatalogItem` requires no changes — `UpdateCatalogItemPatch` covers all fields |

---

## Build / Vercel Result

`next` binary not available in this environment. All prior clean build checkpoints are recorded in `cleanup_plan_r03.md §11` and `catalog_stress_audit_r01.md`. No new imports were added beyond `updateCatalogItem` from an already-imported module (`@/lib/pricing/catalog`). No new dependencies, no new shared abstractions, no structural changes to route files. Vercel should remain green.

---

## Bugs Fixed

None in this pass. This was a feature implementation pass, not a bug-fix pass.

---

## Remaining Gaps

### Source count scaling — carry-forward

List page fetches all `catalog_sku` values from `pricing_rows` for client-side count aggregation. Still acceptable at current scale. Carry to future cleanup.

### `catalogItems` dead load in pricing persistence — carry-forward

Documented in prior audits. `usePricingWorksheetPersistence` fetches catalog items that the orchestrator never consumes. Out of scope for catalog work.

---

## Recommended Next Step

Catalog phase is functionally complete:
- List with search/filter ✅
- Create ✅
- Detail view ✅
- Identity edit/deactivate ✅
- Source pricing visibility read-only ✅
- Access gating ✅

Confirm Vercel deployment is green. Then proceed to the next locked sequence step: **Takeoff / Estimate**.

Do not start Estimate until Vercel is confirmed green on this commit.
