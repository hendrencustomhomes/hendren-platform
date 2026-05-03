# Actions GPT — Current State

Status: authoritative current-state file for fresh sessions  
Branch: `dev`  
Last updated: 2026-05-03

---

## 1. Active execution track

Primary track: **Estimate → Proposal → Send pipeline (Slices 06–22)**

Locked flow:

Price Sheets / Bids → Selections → Estimate → Proposal → Financials

---

## 2. Last verified completed work

Latest completed slice: **Slice 22 — estimate health indicators**

Recent completed slices:
- **Slice 20 — worksheet persistence guardrails**
- **Slice 21 — job_worksheet_items RLS estimate editability**
- **Slice 22 — estimate health indicators**

Slice reports:
- `docs/actions/slices/slice_20_worksheet_persistence_guardrails.md`
- `docs/actions/slices/slice_21_job_worksheet_items_rls.md`
- `docs/actions/slices/slice_22_estimate_health_indicators.md`

---

## 3. Current platform state (verified)

### Estimate / Proposal
- End-to-end pipeline exists
- Estimate editability has a canonical rule: `isEstimateEditable()` in `src/lib/estimateTypes.ts`
- Estimate mutation guardrails now enforce draft/active + unlocked status for key estimate/worksheet operations
- Worksheet page now has read-only estimate health indicators for obvious completeness/pricing risks
- No validation or completeness enforcement before send

### Pricing
- Orchestrated pricing system active
- Linking is manual but **server-hardened (permissions + job scope + estimate editability)**
- No automatic resolution hierarchy

### Worksheet persistence
- `job_worksheet_items` is active source of truth
- Worksheet row create/update/delete/restore/sort mutations now route through server actions with estimate editability enforcement
- Direct client-side Supabase writes from `useJobWorksheetPersistence` were removed

### Data model / DB enforcement
- Application-layer guards enforce estimate/worksheet editability
- **RLS on `job_worksheet_items` now enforces estimate editability for INSERT/UPDATE/DELETE**
- DB and app layers are now aligned for worksheet mutation safety

---

## 4. Known gaps (verified)

- No send validation / pre-send blocking guardrails
- No pricing resolution logic
- Estimate health indicators are visibility-only and do not block unsafe send
- `setActiveEstimate` can activate a locked estimate; review if `locked_at` semantics evolve
- Estimate approval flow/status transitions are not yet fully developed
- RLS is not forced (BYPASSRLS roles can bypass policies)

---

## 5. Next recommended slices

1. **Send validation / pre-send guardrails**
2. **RLS hardening / service-role usage audit**
3. **Estimate approval/status transition flow**

---

## 6. Summary

The Estimate → Proposal → Send pipeline now has aligned application-layer and database-layer enforcement for worksheet mutations, plus read-only worksheet health visibility.

The highest remaining product safety risk is that proposal sending is not yet blocked by estimate completeness or pricing health.
