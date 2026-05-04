# Actions GPT — Current State

Status: authoritative current-state file for fresh sessions  
Branch: `dev`  
Last updated: 2026-05-04

---

## 1. Active execution track

Primary track: **Estimate → Proposal → Send pipeline (Slices 06–29)**

Locked flow:

Price Sheets / Bids → Selections → Estimate → Proposal → Financials

---

## 2. Last verified completed work

Latest completed slice: **Slice 28 — set_active_estimate RPC audit**

Recent completed slices:
- **Slice 25 — RLS and service-role audit**
- **Slice 26 — proposal and document permission guards**
- **Slice 27 — lockProposal resolution**
- **Slice 28 — set_active_estimate RPC audit**

Slice reports:
- `docs/actions/slices/slice_25_rls_service_role_audit.md`
- `docs/actions/slices/slice_26_proposal_document_permission_guards.md`
- `docs/actions/slices/slice_27_lockProposal_resolution.md`
- `docs/actions/slices/slice_28_set_active_estimate_rpc_audit.md`

---

## 3. Current platform state (verified)

### Estimate / Proposal
- End-to-end pipeline exists
- Estimate editability enforced via `isEstimateEditable()`
- Worksheet mutations protected at both app + RLS layers
- Health indicators visible (non-blocking)
- Send validation enforced server-side
- Estimate actions are permission-guarded (`view` / `manage`) via `requireModuleAccess`
- Proposal actions are permission-guarded:
  - `getProposalStructure` requires `view`
  - `saveProposalStructure`, `unlockProposal`, `signProposal`, and `voidProposal` require `manage`
- Document/send actions are permission-guarded:
  - `createProposalSnapshot`, `sendProposal`, and `voidProposalDocument` require `manage`
- `sendProposal` checks `manage` before calling the `send_proposal` SECURITY DEFINER RPC
- Legacy `lockProposal` path has been deleted; canonical send/lock path is `sendProposal` via atomic `send_proposal` RPC
- `set_active_estimate` was inspected in DB and confirmed SECURITY INVOKER; RLS applies inside the function

### Permissions
- Canonical server-side guard: `requireModuleAccess`
- Uses:
  - `internal_access`
  - `user_permission_snapshots`
  - fallback to `template_permissions`
- Admin bypass enforced
- `assign` is explicitly **not used** for estimate/proposal actions; per `docs/design/module_structure`, assign means workflow assignment authority only

### Data model / DB enforcement
- RLS enforced for worksheet mutation safety
- Application-layer permission guards now cover estimate, worksheet, proposal, document, and send actions
- `send_proposal` still runs as SECURITY DEFINER, but `sendProposal` applies the application-layer permission guard before invoking it
- `set_active_estimate` runs as SECURITY INVOKER, so RLS remains active during active-estimate transitions

---

## 4. Known gaps (verified)

- No pricing resolution logic
- Estimate approval/status transition flow incomplete
- `unlockProposal` remains a non-atomic dual-write path and is actively used by `ProposalBuilderOrchestrator.tsx`; lower risk than deleted `lockProposal`, but worth future atomicity review
- `requireModuleAccess` adds multiple admin-client queries per guarded call; caching/batching may be needed later
- `pricing-access-actions.ts` admin behavior remains inconsistent with `requireModuleAccess`

---

## 5. Next recommended slices

1. **Slice 29 — estimate approval/status transition design**
2. **Slice 30 — pricing resolution logic**
3. **Future hardening — unlockProposal atomicity review / permission helper caching**

---

## 6. Summary

The Estimate → Proposal pipeline now has:

- Aligned editability enforcement (app + RLS)
- Health visibility (UI)
- Send validation (server)
- Permission enforcement (view/manage) across estimate, worksheet, proposal, document, and send actions
- Legacy non-atomic `lockProposal` removed
- `set_active_estimate` RPC privilege model verified as SECURITY INVOKER

The original safety/infrastructure track is complete. The next meaningful work is design-first approval/status transition flow before adding new business behavior.
