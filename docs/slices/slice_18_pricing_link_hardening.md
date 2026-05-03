# Slice 18 — Pricing Link Hardening / Permissions / Scope Guardrails

**Date:** 2026-05-03
**Branch:** dev

---

## Files Changed

### Modified files

| Path | Change |
|---|---|
| `src/app/actions/worksheet-pricing-actions.ts` | Added `getAvailablePricingHeaders`, `getAvailablePricingRows`; hardened `linkRowToPricing` and `unlinkRowFromPricing` with permission checks and job scope validation |
| `src/components/patterns/estimate/PricingLinkModal.tsx` | Replaced client-side Supabase reads with calls to the new server actions; removed `createClient` import |

---

## Permission and Scoping Rules Enforced

### `linkRowToPricing`

Previously: authenticated user only (requireUser).

Now enforces:
1. **Authenticated user** — unchanged
2. **Worksheet item job scope** — fetches `job_worksheet_items.job_id` and asserts it equals the caller-supplied `jobId`; prevents `estimateId` from a different job being used to mutate a row the caller has no access to
3. **Pricing header active** — `pricing_headers.is_active = true` verified server-side before accepting the link
4. **Bid-to-job scope** — if `pricing_headers.kind = 'bid'`, asserts `pricing_headers.job_id = jobId`; prevents bid pricing data from unrelated jobs leaking into this job's worksheet
5. **Permission check** — calls `getCurrentPricingAccess('pricing_sources')` for price-sheet headers, `getCurrentPricingAccess('bids')` for bid headers; requires `canManage = true`; inherits the full permission snapshot resolution (template → user snapshot fallback) already in `pricing-access-actions.ts`

### `unlinkRowFromPricing`

Previously: authenticated user only.

Now enforces:
1. **Authenticated user**
2. **Worksheet item job scope** — fetches `job_worksheet_items.job_id` and asserts equality with `jobId`

Unlink does not check pricing source permissions because it only clears reference fields on the worksheet item, not modifying any pricing source data. Job scope is sufficient.

### `getAvailablePricingHeaders(jobId)` (new)

1. Authenticated user
2. Calls `getCurrentPricingAccess('pricing_sources')` and `getCurrentPricingAccess('bids')` in parallel
3. Returns price sheets only if `canView pricing_sources = true`
4. Returns bids only if `canView bids = true` **and** filtered to `pricing_headers.job_id = jobId`
5. Returns empty list (not an error) if user has neither permission — no information leak about what exists

### `getAvailablePricingRows(headerId, jobId)` (new)

1. Authenticated user
2. Fetches the header, checks `is_active = true`
3. For bid headers: asserts `header.job_id = jobId`
4. Calls `getCurrentPricingAccess` for the header's kind; requires `canView = true`
5. Returns active rows for that header

---

## Client Exposure Findings

### Before (Slice 17)

`PricingLinkModal.tsx` fetched pricing headers and rows directly via client-side Supabase (`createClient()`), with only `is_active = true` as a filter.

**Exposures found:**
- All active pricing headers (both price sheets and bids from all jobs) were returned to the browser regardless of the user's permission snapshot
- Bids from unrelated jobs were visible in the picker (no `job_id` filter)
- No check that the user had `canView` on `pricing_sources` or `bids`

### After (Slice 18)

`PricingLinkModal.tsx` now calls `getAvailablePricingHeaders(jobId)` and `getAvailablePricingRows(headerId, jobId)` — both server actions that enforce permissions and bid-job scoping before returning data.

The client-side `createClient` import has been removed from `PricingLinkModal.tsx`. The modal now receives only what the server authorizes.

---

## Proposal Safety

Verified no changes required:

- `src/lib/proposalStructure.ts` — uses `unit_price`, `description`, `quantity` from worksheet rows; does not reference `pricing_source_row_id`, `pricing_header_id`, `source_sku`, `catalog_sku`, or `vendor_sku`
- `src/lib/proposalFormatters.ts` — references `unit_price` only (line-item price, not source metadata)
- `src/lib/proposalSnapshot.ts` — no pricing source fields referenced
- `src/app/actions/document-actions.ts` — snapshot JSON is built via `applyStructure()`, which outputs proposal structure (not raw worksheet rows with pricing source fields)

No proposal files were modified.

---

## Validation Results

- `npx tsc --noEmit` — 0 errors
- No broken imports
- `PricingLinkModal.tsx` no longer imports `createClient` from `@/utils/supabase/client`
- `worksheet-pricing-actions.ts` uses only `getCurrentPricingAccess` from the existing `pricing-access-actions.ts` — no new access-control system introduced

---

## Remaining Risks

1. **RLS policies not verified** — This slice adds application-layer guardrails. The actual Supabase RLS policies on `pricing_headers`, `pricing_rows`, and `job_worksheet_items` were not audited. If RLS is misconfigured, a direct API call (bypassing server actions) could still read/write without these checks. A future slice should verify RLS.

2. **`canManage` requirement for link** — If users have `canView` on pricing sources but not `canManage`, they cannot link rows. This is intentional but may need UX communication (the modal will still show sources, but the link action will return an error from the server action after selecting a row).

3. **No estimate-level status guard** — Neither link nor unlink checks whether the estimate is in `draft` status. Linking a row on a `sent` or `signed` estimate (if such a state becomes possible in future) would silently succeed. This is outside Slice 18 scope.
