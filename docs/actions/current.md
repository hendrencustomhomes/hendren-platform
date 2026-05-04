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

Latest completed work: **permission and estimate status architecture rewrite**

Recent completed slices:
- **Slice 26 — proposal and document permission guards**
- **Slice 27 — lockProposal resolution**
- **Slice 28 — set_active_estimate RPC audit**
- **Architecture rewrite — permission model and estimate status**

Reports:
- `docs/actions/slices/slice_26_proposal_document_permission_guards.md`
- `docs/actions/slices/slice_27_lockProposal_resolution.md`
- `docs/actions/slices/slice_28_set_active_estimate_rpc_audit.md`
- `docs/actions/architecture/permission_status_rewrite.md`

---

## 3. Current platform state (verified)

### Permission model

Three levels, backed by DB columns:

| Code level | DB column   | Meaning                                      |
|------------|-------------|----------------------------------------------|
| `view`     | `can_view`  | Read access                                  |
| `edit`     | `can_manage`| Build/mutate active work                     |
| `manage`   | `can_assign`| Workflow authority: stage/send/sign/void/reject |

Hierarchy: `manage` satisfies `edit` + `view`. `edit` satisfies `view`.

Guard: `requireModuleAccess(profileId, rowKey, 'view' | 'edit' | 'manage')` in `src/lib/access-control-server.ts`.

Admin bypass: `is_admin = true` in `internal_access` → skips all checks.

### Estimate status lifecycle

| Status     | Editable | Archivable | Notes                                      |
|------------|----------|------------|--------------------------------------------|
| `draft`    | ✓        | ✓          | Default new estimate state                 |
| `active`   | ✓        | ✓          | Selected working estimate for a job        |
| `staged`   | ✗        | ✗          | Locked for management review/send          |
| `sent`     | ✗        | ✗          | Proposal sent; permanently locked          |
| `signed`   | ✗        | ✗          | Client accepted; permanently locked        |
| `rejected` | ✗        | ✗          | Rejected; locked; may duplicate manually   |
| `voided`   | ✗        | ✗          | Canceled; locked; may duplicate manually   |
| `archived` | ✗        | —          | Hidden/recoverable; restores to `draft`    |

### Estimate / Proposal

- End-to-end pipeline exists
- Estimate editability enforced via `isEstimateEditable()` — draft + active + !locked_at
- Active estimate can be archived without requiring another active estimate first
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

---

## 4. Known gaps (verified)

- No pricing resolution logic
- `staged` status is defined in the type but no staging action exists yet
- `rejected` status is defined in the type but no reject action exists yet
- Archived estimates restore via `setActiveEstimate` (sets to `active`); a dedicated `restoreEstimate` action setting status to `draft` is deferred
- `unlockProposal` is a non-atomic dual-write path; lower risk than the deleted `lockProposal`, but worth future atomicity review
- `requireModuleAccess` adds 3–4 admin-client queries per guarded call; caching/batching may be needed later
- `pricing-access-actions.ts` does not use `requireModuleAccess` and does not check `is_admin`; inconsistency with estimate/proposal paths

---

## 5. Next recommended slices

1. **Staging action** — add `stageEstimate` server action (transitions draft/active → staged; requires `edit`)
2. **Reject action** — add `rejectEstimate` server action (transitions staged/sent → rejected; requires `manage`)
3. **Restore action** — add `restoreEstimate` server action (transitions archived → draft; replaces current setActiveEstimate workaround)
4. **Pricing resolution logic** — resolve pricing source rows into estimate lines
5. **unlockProposal atomicity** — evaluate making the dual-write atomic

---

## 6. Summary

The Estimate → Proposal pipeline now has:

- Aligned editability enforcement (app + RLS)
- Three-level permission model (view / edit / manage) with correct DB column mapping
- Full status lifecycle defined (draft → active → staged → sent → signed / rejected / voided / archived)
- Permission enforcement across all estimate, worksheet, proposal, document, and send actions
- Archive guard: only draft/active may be archived; active may archive without a replacement
- `lockProposal` removed; `sendProposal` is the canonical atomic send path

The permission and status foundation is complete. The next meaningful work is implementing the remaining lifecycle actions (staging, rejection, restore) before adding broader business behavior.
