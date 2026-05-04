# Actions GPT — Current State

Status: authoritative current-state file for fresh sessions  
Branch: `dev`  
Last updated: 2026-05-04

---

## 1. Active execution track

Primary track: **Estimate → Proposal → Send pipeline**

Locked flow:

Price Sheets / Bids → Selections → Estimate → Proposal → Financials

---

## 2. Last verified completed work

Latest completed work: **Slice 30 — Stage Estimate Server Action**

Recent completed slices/work:
- **Slice 28 — set_active_estimate RPC audit**
- **Architecture rewrite — permission model and estimate status**
- **Slice 29 — archive and restore behavior alignment**
- **DB enum update — estimate_status values appended**
- **Slice 30 — stage estimate server action**

Reports:
- `docs/actions/slices/slice_28_set_active_estimate_rpc_audit.md`
- `docs/actions/architecture/permission_status_rewrite.md`
- `docs/actions/slices/slice_29_archive_restore_fix.md`
- `docs/actions/slices/slice_30_stage_estimate_action.md`

Verified files after latest work:
- `src/app/actions/estimate-actions.ts`

Note: `docs/actions/slices/slice_30_stage_estimate_action.md` says the enum migration was deferred, but the DB enum was applied separately after that report. Current DB enum values are confirmed as: `draft`, `active`, `approved`, `archived`, `staged`, `sent`, `signed`, `rejected`, `voided`.

---

## 3. Current platform state (verified)

### Permission model

Three levels, backed by existing DB columns:

| Code level | DB column    | Meaning                                             |
|------------|--------------|-----------------------------------------------------|
| `view`     | `can_view`   | Read access                                        |
| `edit`     | `can_manage` | Build/mutate active work                           |
| `manage`   | `can_assign` | Workflow authority: send/sign/void/reject/finalize |

Hierarchy: `manage` satisfies `edit` + `view`. `edit` satisfies `view`.

Guard: `requireModuleAccess(profileId, rowKey, 'view' | 'edit' | 'manage')` in `src/lib/access-control-server.ts`.

Admin bypass: `is_admin = true` in `internal_access` skips all row-level permission checks.

### Estimate status lifecycle

| Status     | Editable | Archivable | Notes                                       |
|------------|----------|------------|---------------------------------------------|
| `draft`    | yes      | yes        | Default new estimate state                  |
| `active`   | yes      | yes        | Selected working estimate for a job         |
| `staged`   | no       | no         | Locked for management review/send           |
| `sent`     | no       | no         | Proposal sent; permanently locked           |
| `signed`   | no       | no         | Client accepted; permanently locked         |
| `rejected` | no       | no         | Rejected; locked; may duplicate manually    |
| `voided`   | no       | no         | Canceled; locked; may duplicate manually    |
| `archived` | no       | n/a        | Hidden/recoverable; restores to `draft`     |

### Estimate / Proposal

- End-to-end pipeline exists
- Estimate editability enforced via `isEstimateEditable()` — `draft` + `active` + `!locked_at`
- Server-side archive guard allows only `draft` / `active`; staged/sent/signed/rejected/voided cannot be archived
- Active estimates can be archived without requiring another active estimate first
- `EstimateSelector.tsx` exposes Archive for active estimates and uses inline confirmation copy: `Are you sure?` with `[No] [Yes]`, Yes highlighted
- `restoreEstimate` server action restores `archived` → `draft` and requires `edit`
- `stageEstimate` server action transitions `draft|active` → `staged`, requires `edit`, and rejects locked estimates
- Archived estimate Restore UI calls `restoreEstimate`, not `setActiveEstimate`
- Worksheet mutations protected at both app (`edit` guard) + RLS layers
- Health indicators visible (non-blocking)
- Send validation enforced server-side
- `lockProposal` deleted; canonical send path is currently `sendProposal` via atomic `send_proposal` RPC

### Action permission guards

| Action                    | File                       | Level    |
|---------------------------|----------------------------|----------|
| `getEstimatesForJob`      | estimate-actions.ts        | `view`   |
| `createEstimate`          | estimate-actions.ts        | `edit`   |
| `setActiveEstimate`       | estimate-actions.ts        | `edit`   |
| `archiveEstimate`         | estimate-actions.ts        | `edit`   |
| `restoreEstimate`         | estimate-actions.ts        | `edit`   |
| `stageEstimate`           | estimate-actions.ts        | `edit`   |
| `duplicateEstimate`       | estimate-actions.ts        | `edit`   |
| `importEstimate`          | estimate-actions.ts        | `edit`   |
| `renameEstimate`          | estimate-actions.ts        | `edit`   |
| `persistWorksheetRow`     | worksheet-item-actions.ts  | `edit`   |
| `createWorksheetRow`      | worksheet-item-actions.ts  | `edit`   |
| `restoreWorksheetRows`    | worksheet-item-actions.ts  | `edit`   |
| `deleteWorksheetRow`      | worksheet-item-actions.ts  | `edit`   |
| `persistWorksheetSortOrders` | worksheet-item-actions.ts | `edit` |
| `getProposalStructure`    | proposal-actions.ts        | `view`   |
| `saveProposalStructure`   | proposal-actions.ts        | `edit`   |
| `unlockProposal`          | proposal-actions.ts        | `manage` |
| `signProposal`            | proposal-actions.ts        | `manage` |
| `voidProposal`            | proposal-actions.ts        | `manage` |
| `createProposalSnapshot`  | document-actions.ts        | `edit`   |
| `sendProposal`            | document-actions.ts        | `manage` |
| `voidProposalDocument`    | document-actions.ts        | `manage` |

### Data model / DB enforcement

- RLS enforced for worksheet mutation safety
- `estimate_status` DB enum now accepts all TypeScript lifecycle values, plus legacy `approved`
- `send_proposal` RPC runs as SECURITY DEFINER; `sendProposal` applies `manage` guard before invoking it
- `set_active_estimate` RPC verified SECURITY INVOKER; RLS applies inside the function

---

## 4. Known gaps (verified)

- No pricing resolution logic
- `stageEstimate` exists server-side but no UI calls it yet
- `rejected` status is defined in TypeScript and DB but no reject action exists yet
- `sent`, `signed`, `rejected`, and `voided` statuses exist on `estimates.status`, but send/sign/void paths still primarily mutate `proposal_structures` and/or `proposal_documents`
- `createProposalSnapshot` and `sendProposal` still create/store `snapshot_json`; target architecture says estimate is durable truth and proposal artifacts must not become competing source of truth
- `unlockProposal` is a non-atomic dual-write path and conflicts with permanent-lock direction for sent estimates; likely should be removed or redesigned after void/duplicate flow exists
- `pricing-access-actions.ts` does not use `requireModuleAccess` and does not check `is_admin`; inconsistency with estimate/proposal paths

---

## 5. Next recommended work

1. **Stage UI wiring**
   - Add a bounded UI path to call `stageEstimate`
   - Only show Stage for `draft` / `active`
   - Make staged visibly non-editable and not archivable

2. **Reject / void / permanent-lock flow**
   - Add reject flow requiring `manage`
   - Reconcile or remove unlock behavior so sent estimates are not silently editable again
   - Preserve manual duplicate path for rejected/voided estimates

3. **Proposal artifact source-of-truth cleanup**
   - Ensure proposal documents are audit/output artifacts only
   - Prevent `snapshot_json` from becoming competing authoritative estimate truth

---

## 6. Summary

The permission/status foundation, archive/restore behavior, DB enum, and staging server action are now aligned:

- Three-level permission model: `view` / `edit` / `manage`
- Existing DB mapping: `can_view` / `can_manage` / `can_assign`
- `manage` includes `edit`; `edit` includes `view`
- DB and TypeScript lifecycle statuses now include draft, active, staged, sent, signed, rejected, voided, archived
- Server and UI allow archiving draft/active estimates, including active estimates
- Archive confirmation is implemented with minimal inline UI
- Archived estimates restore to `draft`, not `active`
- `stageEstimate` exists server-side and can write `staged`

The next meaningful work is wiring staging into the UI, then reject/void/permanent-lock behavior.
