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

Latest completed slice: **Slice 40A — Unit-Cost Pricing Resolution Columns**

Recent completed work:
- Slice 38 — Pricing Permission Alignment
- Slice 39A–39D — Permission system (DB + repo) complete
- Slice 40A — Unit-cost pricing resolution columns (DB)

Reports:
- docs/modules/pricing/slice_38_pricing_permission_alignment.md
- docs/modules/platform/slice_39b_permission_repo_transition.md
- docs/modules/platform/slice_39c_permission_sql_cleanup.md
- docs/modules/platform/slice_39d_permission_repo_cleanup.md
- docs/modules/estimate/slice_40a_unit_cost_pricing_resolution_columns.md

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

DB foundation is now in place:

job_worksheet_items now includes:
- unit_cost_manual
- unit_cost_source
- unit_cost_override
- unit_cost_is_overridden

Rules locked:
- resolved value is NOT stored
- overrides do NOT break link
- source value is stored as snapshot

No resolver or UI behavior exists yet.

---

## 4. Known gaps

- No pricing resolution engine (resolver not implemented)
- No UI behavior for linked / override / mismatch states
- No pricing sync/update flow

---

## 5. Next recommended work

1. **Slice 40B — Pricing Resolution Engine (repo)**
   - implement resolver
   - wire read/write paths
   - enforce override behavior

2. **Slice 40C — Pricing Resolution UI (minimal)**
   - icon-based state indicators
   - inline override interactions

3. **Slice 40D — Pricing sync / source update handling**
   - propagate pricing changes
   - surface mismatches

---

## 6. Summary

Permissions are complete.

Pricing resolution has started:
- DB layer complete
- behavior layer not yet implemented

Next critical step:
- implement resolver + write logic (Slice 40B)
