# Actions GPT — Current State

Status: authoritative current-state file for fresh sessions  
Branch: `dev`  
Last updated: 2026-05-03

---

## 1. Active execution track

Primary track: **Estimate → Proposal → Send pipeline (Slices 06–23)**

Locked flow:

Price Sheets / Bids → Selections → Estimate → Proposal → Financials

---

## 2. Last verified completed work

Latest completed slice: **Slice 23 — estimate send validation guardrails**

Recent completed slices:
- **Slice 21 — job_worksheet_items RLS estimate editability**
- **Slice 22 — estimate health indicators**
- **Slice 23 — estimate send validation guardrails**

Slice reports:
- `docs/actions/slices/slice_21_job_worksheet_items_rls.md`
- `docs/actions/slices/slice_22_estimate_health_indicators.md`
- `docs/actions/slices/slice_23_send_validation.md`

---

## 3. Current platform state (verified)

### Estimate / Proposal
- End-to-end pipeline exists
- Estimate editability has a canonical rule: `isEstimateEditable()` in `src/lib/estimateTypes.ts`
- Estimate mutation guardrails enforce draft/active + unlocked status for key estimate/worksheet operations
- Worksheet page has read-only estimate health indicators for obvious completeness/pricing risks
- `sendProposal` now runs server-side estimate validation before the atomic send RPC
- Invalid estimates with missing pricing, missing quantity, or clear zero/missing line-item pricing are blocked from send with explicit errors

### Pricing
- Orchestrated pricing system active
- Linking is manual but **server-hardened (permissions + job scope + estimate editability)**
- No automatic resolution hierarchy

### Worksheet persistence
- `job_worksheet_items` is active source of truth
- Worksheet row create/update/delete/restore/sort mutations route through server actions with estimate editability enforcement
- Direct client-side Supabase writes from `useJobWorksheetPersistence` were removed

### Data model / DB enforcement
- Application-layer guards enforce estimate/worksheet editability
- RLS on `job_worksheet_items` enforces estimate editability for INSERT/UPDATE/DELETE
- DB and app layers are aligned for worksheet mutation safety

---

## 4. Known gaps (verified)

- No pricing resolution logic
- Estimate health indicators and send validation use similar logic independently; future refinement may consolidate if drift appears
- `lockProposal` in `proposal-actions.ts` is not validated; it is not currently the user-facing send path, but should be guarded if exposed
- `setActiveEstimate` can activate a locked estimate; review if `locked_at` semantics evolve
- Estimate approval flow/status transitions are not yet fully developed
- RLS is not forced (BYPASSRLS roles can bypass policies)
- Service-role usage has not been audited for user-driven worksheet/proposal mutations

---

## 5. Next recommended slices

1. **RLS hardening / service-role usage audit**
2. **Estimate approval/status transition flow**
3. **Pricing resolution logic**

---

## 6. Summary

The Estimate → Proposal → Send pipeline now has aligned application-layer and database-layer worksheet mutation enforcement, read-only worksheet health visibility, and server-side pre-send validation.

The highest remaining safety risk is privileged bypass or alternate lock/send paths, especially service-role use and the separate `lockProposal` action if it becomes user-facing.
