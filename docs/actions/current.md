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

Latest completed work: **Slice 29 — Archive and Restore Behavior Alignment**

Recent completed slices/work:
- **Slice 27 — lockProposal resolution**
- **Slice 28 — set_active_estimate RPC audit**
- **Architecture rewrite — permission model and estimate status**
- **Slice 29 — archive and restore behavior alignment**

Reports:
- `docs/actions/slices/slice_27_lockProposal_resolution.md`
- `docs/actions/slices/slice_28_set_active_estimate_rpc_audit.md`
- `docs/actions/architecture/permission_status_rewrite.md`
- `docs/actions/slices/slice_29_archive_restore_fix.md`

Verified files after latest work:
- `src/app/actions/estimate-actions.ts`
- `src/components/patterns/estimate/EstimateSelector.tsx`

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
- `EstimateSelector.tsx` now exposes Archive for active estimates and uses inline confirmation copy: `Are you sure?` with `[No] [Yes]`, Yes highlighted
- `restoreEstimate` server action restores `archived` → `draft` and requires `edit`
- Archived estimate Restore UI now calls `restoreEstimate`, not `setActiveEstimate`
- Worksheet mutations protected at both app (`edit` guard) + RLS layers
- Health indicators visible (non-blocking)
- Send validation enforced server-side
- `lockProposal` deleted; canonical send path is `sendProposal` via atomic `send_proposal` RPC

### Action permission guards

| Action                    | File                       | Level    |
|---------------------------|----------------------------|----------|
| `getEstimatesForJob`      | estimate-actions.ts        | `view`   |
| `createEstimate`          | estimate-actions.ts        | `edit`   |
| `setActiveEstimate`       | estimate-actions.ts        | `edit`   |
| `archiveEstimate`         | estimate-actions.ts        | `edit`   |
| `restoreEstimate`         | estimate-actions.ts        | `edit`   |
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
- `send_proposal` RPC runs as SECURITY DEFINER; `sendProposal` applies `manage` guard before invoking it
- `set_active_estimate` RPC verified SECURITY INVOKER; RLS applies inside the function
- DB enum migration is still required before new estimate statuses can be written directly to `estimates.status`

---

## 4. Known gaps (verified)

- No pricing resolution logic
- `staged` status is defined in TypeScript but no staging action exists yet
- `rejected` status is defined in TypeScript but no reject action exists yet
- DB enum migration is required before writing `staged`, `sent`, `signed`, `rejected`, or `voided` to `estimates.status`
- `createProposalSnapshot` and `sendProposal` still create/store `snapshot_json`; target architecture says estimate is durable truth and proposal artifacts must not become competing source of truth
- `unlockProposal` is a non-atomic dual-write path and also conflicts with permanent-lock direction for sent estimates; likely should be removed or redesigned after void/duplicate flow exists
- `pricing-access-actions.ts` does not use `requireModuleAccess` and does not check `is_admin`; inconsistency with estimate/proposal paths

---

## 5. Next recommended work

1. **DB enum + staging action**
   - Add migration for new estimate statuses
   - Add `stageEstimate` server action: `draft|active` → `staged`, requires `edit`
   - Ensure staged is locked/non-editable and cannot be archived

2. **Reject / void / permanent-lock flow**
   - Add reject flow requiring `manage`
   - Reconcile or remove unlock behavior so sent estimates are not silently editable again
   - Preserve manual duplicate path for rejected/voided estimates

3. **Proposal artifact source-of-truth cleanup**
   - Ensure proposal documents are audit/output artifacts only
   - Prevent `snapshot_json` from becoming competing authoritative estimate truth

---

## 6. Summary

The permission/status foundation and archive/restore behavior are now aligned:

- Three-level permission model: `view` / `edit` / `manage`
- Existing DB mapping: `can_view` / `can_manage` / `can_assign`
- `manage` includes `edit`; `edit` includes `view`
- Estimate lifecycle type includes draft, active, staged, sent, signed, rejected, voided, archived
- Server and UI now allow archiving draft/active estimates, including active estimates
- Archive confirmation is implemented with minimal inline UI
- Archived estimates now restore to `draft`, not `active`

The next meaningful work is the DB enum migration plus the `stageEstimate` transition.
