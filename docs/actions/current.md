# Actions GPT — Current State

Status: authoritative current-state file for fresh sessions  
Branch: `dev`  
Last updated: 2026-05-05

---

## 1. Active execution track

Primary track: **Estimate → Proposal → Send pipeline**

Locked flow:

Price Sheets / Bids → Selections → Estimate → Proposal → Financials

---

## 2. Last verified completed work

Latest completed slice: **Slice 40B — Unit Cost Pricing Resolution Engine**

Recent completed work:
- Slice 38 — Pricing Permission Alignment
- Slice 39A–39D — Permission system (DB + repo) complete
- Slice 40A — Unit-cost pricing resolution columns (DB)
- Slice 40B — Unit-cost resolver and repo write/read paths

Reports:
- docs/modules/pricing/slice_38_pricing_permission_alignment.md
- docs/modules/platform/slice_39b_permission_repo_transition.md
- docs/modules/platform/slice_39c_permission_sql_cleanup.md
- docs/modules/platform/slice_39d_permission_repo_cleanup.md
- docs/modules/estimate/slice_40a_unit_cost_pricing_resolution_columns.md
- docs/modules/estimate/slice_40b_pricing_resolution_engine.md

Verified files after latest work:
- docs/actions/START_HERE.md
- docs/actions/current.md
- docs/modules/estimate/slice_40b_pricing_resolution_engine.md
- src/components/patterns/estimate/_lib/unitCostResolver.ts
- src/components/patterns/estimate/JobWorksheetTableAdapter.tsx
- src/app/actions/worksheet-pricing-actions.ts

---

## 3. Current platform state

### SQL / DB process rule

SQL / schema changes are Supabase-direct only.
No repo migrations unless explicitly requested.

### Permission model

Final and stable:
- can_view
- can_edit
- can_manage

### Pricing resolution (in progress)

DB foundation is in place:
- unit_cost_manual
- unit_cost_source
- unit_cost_override
- unit_cost_is_overridden

Resolver foundation is in place:
- src/components/patterns/estimate/_lib/unitCostResolver.ts
- resolveUnitCost(row) is the intended single source of truth
- resolved value is NOT stored
- legacy unit_price remains present but should not be used for pricing resolution

Implemented behavior:
- manual row price edits write unit_cost_manual
- linked row price edits create unit_cost_override and set unit_cost_is_overridden
- link action stores pricing_source_row_id/pricing_header_id and copies pricing row unit_price into unit_cost_source
- accept source clears override
- unlink preserves resolved cost into unit_cost_manual and clears source/override/link fields

Verification caveat:
- unlinkRowFromPricing currently duplicates resolver precedence inline instead of importing resolveUnitCost
- this should be cleaned before UI/icon work so the single-resolver rule is actually enforced everywhere

---

## 4. Known gaps

- Resolver hardening needed: remove duplicated inline resolution logic in unlinkRowFromPricing
- No minimal UI indicators for linked / override / mismatch states
- No pricing sync/update flow
- No source-change mismatch surfacing

---

## 5. Next recommended work

1. **Slice 40B.1 — Resolver hardening**
   - replace inline resolution logic in server actions with resolveUnitCost
   - grep for duplicate unit-cost precedence logic
   - ensure report truth matches code truth

2. **Slice 40C — Pricing Resolution UI (minimal)**
   - icon-based state indicators
   - inline override/accept interactions refined to match design standard
   - avoid badge-heavy UI

3. **Slice 40D — Pricing sync / source update handling**
   - propagate pricing changes to non-overridden linked rows
   - surface mismatches for overridden rows

---

## 6. Summary

Permissions are complete.

Pricing resolution has started:
- DB layer complete
- resolver exists
- core write paths exist
- one hardening pass is needed before UI polish

Next critical step:
- enforce the resolver as the true single source of truth everywhere it is used
