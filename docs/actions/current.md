# Actions GPT — Current State

Status: authoritative current-state file for fresh sessions  
Branch: `dev`  
Last updated: 2026-05-06

---

## 1. Active execution track

Primary track: **Estimate → Proposal → Send pipeline**

Locked flow:

Price Sheets / Bids → Selections → Estimate → Proposal → Financials

---

## 2. Last verified completed work

Latest completed slice: **Slice 40D — Pricing Source Sync**

Recent completed work:
- Slice 38 — Pricing Permission Alignment
- Slice 39A–39D — Permission system complete
- Slice 40A — DB pricing columns
- Slice 40B — Resolver + write paths
- Slice 40B.1 — Resolver hardening
- Slice 40C — Minimal pricing resolution UI
- Slice 40D — Pricing source sync and mismatch surfacing

Reports:
- docs/modules/pricing/slice_38_pricing_permission_alignment.md
- docs/modules/platform/slice_39b_permission_repo_transition.md
- docs/modules/platform/slice_39c_permission_sql_cleanup.md
- docs/modules/platform/slice_39d_permission_repo_cleanup.md
- docs/modules/estimate/slice_40a_unit_cost_pricing_resolution_columns.md
- docs/modules/estimate/slice_40b_pricing_resolution_engine.md
- docs/modules/estimate/slice_40b1_resolver_hardening.md
- docs/modules/estimate/slice_40c_pricing_resolution_ui.md
- docs/modules/estimate/slice_40d_pricing_source_sync.md

---

## 3. Current platform state

### Permission model
Final and stable.

### Pricing resolution

- DB model complete
- Resolver implemented and enforced everywhere
- Write paths aligned
- UI indicators: linked (blue chain), overridden (amber chain + pencil), stale mismatch (orange dot), tooltip with values
- Source sync: non-overridden linked rows auto-sync `unit_cost_source` on worksheet load
- Overridden rows with changed source: preserved override + stale dot indicator

System is structurally correct and consistent.

---

## 4. Known gaps

- Stale mismatch state is not persisted (derived on load, lost on page leave)
- Override state not shown in mobile view
- No on-demand sync trigger (sync runs once on mount only)

---

## 5. Next recommended work

1. Slice 40E — Pricing sync re-trigger (on-demand refresh button)
2. Slice 40F — Mobile view: override + stale indicators

---

## 6. Summary

Pricing resolution is complete end-to-end: resolver, write paths, UI indicators,
source sync, and mismatch surfacing. Non-overridden linked rows auto-sync on
load; overridden rows with changed source show a subtle dot indicator. No new DB
columns were required.
