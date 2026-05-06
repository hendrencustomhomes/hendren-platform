# Actions GPT — Current State

Status: authoritative current-state file for fresh sessions  
Branch: `dev`  
Last updated: 2026-05-11

---

## 1. Active execution track

Primary track: **Estimate → Proposal → Send pipeline**

Locked flow:

Price Sheets / Bids → Selections → Estimate → Proposal → Financials

---

## 2. Last verified completed work

Latest completed slice: **Slice 40I — Extended Cost Alignment Audit**

Recent completed work:
- Slice 38 — Pricing Permission Alignment
- Slice 39A–39D — Permission system complete
- Slice 40A — DB pricing columns
- Slice 40B — Resolver + write paths
- Slice 40B.1 — Resolver hardening
- Slice 40C — Minimal pricing resolution UI
- Slice 40D — Pricing source sync and mismatch surfacing
- Slice 40E — On-demand pricing sync trigger
- Slice 40F — Mobile pricing state indicators
- Slice 40G — Sync confirmation feedback
- Slice 40H — Mobile tap-to-reveal pricing detail
- Slice 40I — Extended cost alignment audit (no gaps found)

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
- docs/modules/estimate/slice_40e_pricing_sync_trigger.md
- docs/modules/estimate/slice_40f_mobile_pricing_indicators.md
- docs/modules/estimate/slice_40g_sync_confirmation_feedback.md
- docs/modules/estimate/slice_40h_mobile_pricing_detail.md
- docs/modules/estimate/slice_40i_extended_cost_alignment.md

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
- On-demand sync: "Sync prices" button above table; disabled + dimmed while pending
- Sync feedback: inline label auto-clears after 3 s — "Up to date" / "Updated" / "Needs review"
- Mobile: linked / overridden / stale icons beside description input; tap icon to reveal inline detail (source, override, SKU, stale notice)

Slice 40I audit confirmed: all 21 extended cost / total computation paths
route through `resolveUnitCost` or `rowTotal`. No gaps found.

System is structurally correct and consistent.

---

## 4. Known gaps

- Stale mismatch state is not persisted (derived on load, lost on page leave)
- Sync feedback label has no fade animation (appears/disappears abruptly)
- Mobile detail panel: no close-on-outside-tap; no open/close animation

---

## 5. Next recommended work

1. Slice 40J — Animation polish: sync feedback fade + mobile detail panel open/close
2. Slice 41A — Proposal builder: remove legacy unit_price column (prerequisite audit complete)

---

## 6. Summary

Pricing resolution is complete and fully audited end-to-end: resolver, write
paths, state indicators, source sync, mismatch surfacing, on-demand re-sync
with confirmation feedback, full mobile parity with tap-to-reveal detail
panels, and a clean extended cost alignment audit confirming zero gaps across
all 21 computation paths. No new DB columns were required across the full
40A–40I series.
