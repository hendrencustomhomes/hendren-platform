# Handoff — 2026-05-05 (Through Slice 38)

---

## What changed

Latest completed slice: **Slice 38 — Pricing Permission Alignment**

Recent confirmed state:
- Slice reports now live in module directories under `docs/modules/`.
- SQL/schema/RPC/RLS/enum changes are Supabase-direct and must not be committed as repo migration files unless explicitly requested.
- `is_admin` remains a SQL/admin-only superuser flag. Feature code must not check it directly; feature authorization must route through `requireModuleAccess`.
- `getCurrentPricingAccess` now delegates permission checks to `requireModuleAccess`, so pricing access inherits shared admin bypass, snapshot resolution, and template fallback.

---

## Current state

Primary track: **Estimate → Proposal → Send pipeline**

Lifecycle:

```text
draft → active → staged → sent → rejected / signed / voided
archived restores to draft
```

Current guarantees:
- Permission model is `view` / `edit` / `manage`.
- Existing DB columns still map as `can_view` / `can_manage` / `can_assign`.
- `manage` includes `edit`; `edit` includes `view`.
- `sendProposal` requires `staged` and uses the atomic `send_proposal` RPC.
- Sent estimates are permanently locked; no unlock path remains.
- `signProposal` and `voidProposal` update both proposal structure and estimate status.
- `rejectProposal` updates estimate status only; proposal structure intentionally remains `sent`.
- `snapshot_json` is documented as a write-once audit artifact, not authoritative truth.
- `createProposalSnapshot` supports `active` and `staged` estimates only.
- Pricing access is now routed through the shared guard.

---

## Known gaps

- Permission naming is semantically awkward at the DB/code boundary: `can_manage` currently means `edit`, and `can_assign` currently means `manage`.
- `unlinkRowFromPricing` has no pricing permission check; only `isEstimateEditable` currently protects it.
- `unstageEstimate` uses `set_active_estimate`; if that RPC later rejects staged estimates internally, a dedicated `unstage_estimate` RPC will be needed.
- `SnapshotCreateButton` UI only surfaces on the preview page when an active estimate exists; staged-flow snapshot button wiring is not implemented.
- UI components that read only `proposal_structures.proposal_status` will show `sent` for rejected proposals; UI that needs rejected state must read `estimates.status`.
- Pricing resolution logic is not implemented.

---

## Next step

### Slice 39 — Permission matrix naming alignment audit

Goal:
- Audit all current `can_manage` / `can_assign` usage before any rename.
- Identify DB columns, query selects, inserts/updates, TypeScript types, UI labels, RPC/RLS dependencies, and compatibility risks.
- Do **not** rename yet.

Expected report path:

```text
docs/modules/platform/slice_39_permission_naming_audit.md
```

Follow-up likely after audit:
- Decide whether to keep compatibility mapping or perform SQL-direct DB rename.
- Add pricing permission guard to `unlinkRowFromPricing` after naming alignment is settled.

---

## What NOT to touch

- Do NOT rename permission columns before the audit is complete.
- Do NOT create repo migration files.
- Do NOT bypass `requireModuleAccess` in feature code.
- Do NOT add direct `is_admin` checks in feature code.
- Do NOT loosen staged → send requirements.
- Do NOT reintroduce unlock paths.
- Do NOT treat `snapshot_json` as authoritative estimate truth.

---

## current.md updated?

No update was needed during this handoff. `docs/actions/current.md` already reflected Slice 38 and the next permission naming audit.
