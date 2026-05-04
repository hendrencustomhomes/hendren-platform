# Actions GPT — Current State

Status: authoritative current-state file for fresh sessions  
Branch: `dev`  
Last updated: 2026-05-04

---

## 1. Active execution track

Primary track: **Estimate → Proposal → Send pipeline (Slices 06–25)**

Locked flow:

Price Sheets / Bids → Selections → Estimate → Proposal → Financials

---

## 2. Last verified completed work

Latest completed slice: **Slice 24 — estimate permission enforcement (view/manage)**

Recent completed slices:
- **Slice 21 — job_worksheet_items RLS estimate editability**
- **Slice 22 — estimate health indicators**
- **Slice 23 — estimate send validation guardrails**
- **Slice 24 — estimate permission enforcement (view/manage)**

Slice reports:
- `docs/actions/slices/slice_21_job_worksheet_items_rls.md`
- `docs/actions/slices/slice_22_estimate_health_indicators.md`
- `docs/actions/slices/slice_23_send_validation.md`
- `docs/actions/slices/slice_24_estimate_permissions.md`

---

## 3. Current platform state (verified)

### Estimate / Proposal
- End-to-end pipeline exists
- Estimate editability enforced via `isEstimateEditable()`
- Worksheet mutations protected at both app + RLS layers
- Health indicators visible (non-blocking)
- Send validation enforced server-side
- **Permission enforcement added (view/manage) via `requireModuleAccess` in server actions**

### Permissions
- Canonical server-side guard: `requireModuleAccess`
- Uses:
  - `internal_access`
  - `user_permission_snapshots`
  - fallback to `template_permissions`
- Admin bypass enforced
- `assign` explicitly **not used** for estimate actions

### Data model / DB enforcement
- RLS enforced for worksheet mutation safety
- Application-layer permission guards now exist
- **Service-role usage and SECURITY DEFINER paths not yet audited**

---

## 4. Known gaps (verified)

- No pricing resolution logic
- `sendProposal` not permission-guarded
- `document-actions.ts` lacks permission enforcement
- `proposal-actions.ts` (lock/unlock/sign/void) lack permission enforcement
- `lockProposal` is unguarded and can mutate estimate + proposal state
- SECURITY DEFINER RPC (`send_proposal`) bypasses RLS entirely
- Service-role usage not audited
- Estimate approval/status transition flow incomplete

---

## 5. Next recommended slices

1. **Slice 25 — RLS / service-role usage audit**
2. **Slice 26 — proposal/document action permission guards**
3. **Slice 27 — estimate approval/status transition flow**

---

## 6. Summary

The Estimate → Proposal pipeline now has:

- Aligned editability enforcement (app + RLS)
- Health visibility (UI)
- Send validation (server)
- **Permission enforcement (view/manage)**

The highest remaining risk is:

- privileged bypass paths (service role + SECURITY DEFINER)
- unguarded proposal mutation actions (`lockProposal`, etc.)

Next step is a full audit of mutation paths before adding further guards.
