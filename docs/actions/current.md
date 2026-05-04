# Actions GPT — Current State

Status: authoritative current-state file for fresh sessions  
Branch: `dev`  
Last updated: 2026-05-04

---

## 1. Active execution track

Primary track: **Estimate → Proposal → Send pipeline (Slices 06–28)**

Locked flow:

Price Sheets / Bids → Selections → Estimate → Proposal → Financials

---

## 2. Last verified completed work

Latest completed slice: **Slice 27 — lockProposal resolution**

Recent completed slices:
- **Slice 24 — estimate permission enforcement (view/manage)**
- **Slice 25 — RLS and service-role audit**
- **Slice 26 — proposal and document permission guards**
- **Slice 27 — lockProposal resolution**

Slice reports:
- `docs/actions/slices/slice_24_estimate_permissions.md`
- `docs/actions/slices/slice_25_rls_service_role_audit.md`
- `docs/actions/slices/slice_26_proposal_document_permission_guards.md`
- `docs/actions/slices/slice_27_lockProposal_resolution.md`

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

---

## 4. Known gaps (verified)

- No pricing resolution logic
- `set_active_estimate` RPC SECURITY DEFINER status is unknown and requires DB inspection
- `unlockProposal` remains a non-atomic dual-write path and is actively used by `ProposalBuilderOrchestrator.tsx`; lower risk than deleted `lockProposal`, but worth future atomicity review
- Estimate approval/status transition flow incomplete
- `requireModuleAccess` adds multiple admin-client queries per guarded call; caching/batching may be needed later
- `pricing-access-actions.ts` admin behavior remains inconsistent with `requireModuleAccess`

---

## 5. Next recommended slices

1. **Slice 28 — DB inspection of `set_active_estimate` RPC privilege model**
2. **Slice 29 — estimate approval/status transition design**
3. **Slice 30 — pricing resolution logic**

---

## 6. Summary

The Estimate → Proposal pipeline now has:

- Aligned editability enforcement (app + RLS)
- Health visibility (UI)
- Send validation (server)
- Permission enforcement (view/manage) across estimate, worksheet, proposal, document, and send actions
- Legacy non-atomic `lockProposal` removed

The highest remaining risks are:

- `set_active_estimate` RPC privilege model is still unknown
- `unlockProposal` remains non-atomic but is lower-risk and active UI path
- approval/status transitions are not yet fully designed

Next step is DB inspection of `set_active_estimate` before continuing into broader approval/status flow work.
