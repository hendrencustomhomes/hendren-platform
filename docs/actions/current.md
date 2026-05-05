# Actions GPT — Current State

Status: authoritative current-state file for fresh sessions  
Branch: `dev`  
Last updated: 2026-05-05

---

## 1. Active execution track

Primary track: **Estimate → Proposal → Send pipeline**

Locked flow:

Price Sheets / Bids → Selections → Estimate → Proposal → Financials

---

## 2. Last verified completed work

Latest completed work: **Slice 34 — Sign and Void Estimate Status Alignment**

Recent completed slices/work:
- **Slice 29 — archive and restore behavior alignment**
- **DB enum update — estimate_status values appended** (applied directly in Supabase)
- **Slice 30 — stage estimate server action**
- **Slice 31 — stage/unstage UI and doc correction**
- **Slice 32 — reject and permanent lock**
- **Slice 33 — send RPC atomic status cleanup**
- **Process correction — SQL changes are Supabase-direct; repo migration files are forbidden unless explicitly requested**
- **Doc restructure — slice reports now live in module directories under `docs/modules/`**
- **Slice 34 — sign/void proposal actions now align `estimates.status` and preserve permanent locks**

Reports:
- `docs/modules/estimate/slice_29_archive_restore_fix.md`
- `docs/modules/estimate/slice_30_stage_estimate_action.md`
- `docs/modules/estimate/slice_31_stage_unstage_ui.md`
- `docs/modules/estimate/slice_32_reject_and_lock.md`
- `docs/modules/estimate/slice_33_send_rpc_atomic_status_cleanup.md`
- `docs/modules/estimate/slice_34_void_sign_status_alignment.md`

Verified files after latest work:
- `docs/actions/START_HERE.md`
- `docs/actions/templates/claude_chat_sql_prompt.md`
- `docs/actions/templates/claude_code_prompt.md`
- `docs/actions/current.md`
- `src/app/actions/document-actions.ts`
- `src/app/actions/proposal-actions.ts`
- `docs/modules/estimate/slice_34_void_sign_status_alignment.md`

Note: `docs/modules/estimate/slice_30_stage_estimate_action.md` originally said the enum migration was deferred, but the DB enum was applied separately and the report now has a post-slice correction. Current DB enum values are confirmed as: `draft`, `active`, `approved`, `archived`, `staged`, `sent`, `signed`, `rejected`, `voided`.

---

## 3. Current platform state (verified)

### SQL / DB process rule

SQL / schema / RPC / RLS / enum changes are made directly in Supabase through Claude Chat or another SQL-focused tool.

Do NOT create, modify, or commit files under `supabase/migrations/` unless the user explicitly asks for repo migration files.

This rule is now recorded in:
- `docs/actions/START_HERE.md`
- `docs/actions/templates/claude_chat_sql_prompt.md`

The mistakenly committed Slice 33 migration file was removed from `dev`:
- `supabase/migrations/20260505001007_make_send_proposal_set_estimate_sent.sql` is confirmed absent.

### Slice report location rule

Slice reports must be written to module directories under `docs/modules/`, not legacy slice/audit/archive paths.

Current mapping:
- Estimate / proposal / worksheet-in-estimate / send pipeline → `docs/modules/estimate/`
- Pricing / catalog / pricing sources → `docs/modules/pricing/`
- Cross-cutting platform / permissions / shared foundation / worksheet engine audits / repo-wide bugfixes → `docs/modules/platform/`

This rule is recorded in:
- `docs/actions/START_HERE.md`
- `docs/actions/templates/claude_code_prompt.md`

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
- `stageEstimate` server action transitions `active` → `staged` only, requires `edit`, and rejects locked estimates
- `unstageEstimate` server action transitions `staged` → `active` via `set_active_estimate` RPC, requires `edit`, and rejects locked estimates
- Lifecycle forward path: `draft` → `active` → `staged` → `sent` → `rejected` (or `signed` / `voided`)
- Reverse path: `staged` → `active` (unstage); `archived` → `draft` (restore)
- `setActiveEstimate` is blocked if any other estimate for the same job is staged
- `EstimateSelector.tsx` exposes Stage for active estimates; Unstage for staged estimates; Archive (with confirmation) for all non-staged non-archived estimates; Copy-only for rejected
- Archived estimate Restore UI calls `restoreEstimate`, not `setActiveEstimate`
- `sendProposal` requires `staged` status; `send_proposal` RPC atomically sets `estimates.status = 'sent'`, `locked_at`, transitions `proposal_structures` to `sent`, and inserts the snapshot document — all in one Postgres transaction; no post-RPC status update in the app layer
- `signProposal` transitions `proposal_structures.proposal_status = 'signed'` and `estimates.status = 'signed'`; requires `manage`
- `voidProposal` transitions `proposal_structures.proposal_status = 'voided'` and `estimates.status = 'voided'`; requires `manage`; does not unlock the estimate
- `rejectProposal` server action transitions `sent` → `rejected` on estimates; `proposal_structures` remains at `sent`; requires `manage`
- `unlockProposal` removed; sent proposals cannot be reverted to draft
- Worksheet mutations protected at both app (`edit` guard) + RLS layers
- Health indicators visible (non-blocking)
- Send validation enforced server-side
- Canonical send path is `sendProposal` via `send_proposal` RPC (SECURITY DEFINER)

### Action permission guards

| Action                    | File                       | Level    |
|---------------------------|----------------------------|----------|
| `getEstimatesForJob`      | estimate-actions.ts        | `view`   |
| `createEstimate`          | estimate-actions.ts        | `edit`   |
| `setActiveEstimate`       | estimate-actions.ts        | `edit`   |
| `archiveEstimate`         | estimate-actions.ts        | `edit`   |
| `restoreEstimate`         | estimate-actions.ts        | `edit`   |
| `stageEstimate`           | estimate-actions.ts        | `edit`   |
| `unstageEstimate`         | estimate-actions.ts        | `edit`   |
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
| `rejectProposal`          | proposal-actions.ts        | `manage` |
| `signProposal`            | proposal-actions.ts        | `manage` |
| `voidProposal`            | proposal-actions.ts        | `manage` |
| `createProposalSnapshot`  | document-actions.ts        | `edit`   |
| `sendProposal`            | document-actions.ts        | `manage` |
| `voidProposalDocument`    | document-actions.ts        | `manage` |

### Data model / DB enforcement

- RLS enforced for worksheet mutation safety
- `estimate_status` DB enum now accepts all TypeScript lifecycle values, plus legacy `approved`
- `send_proposal` RPC runs as SECURITY DEFINER; `sendProposal` applies `manage` guard before invoking it; RPC now atomically sets `estimates.status = 'sent'` and enforces `staged` precondition at the DB layer (Supabase-direct change version `20260505001007`)
- `set_active_estimate` RPC verified SECURITY INVOKER; RLS applies inside the function

---

## 4. Known gaps (verified)

- No pricing resolution logic
- `unstageEstimate` uses `set_active_estimate` RPC; if the RPC has internal status guards that reject staged estimates, a dedicated `unstage_estimate` RPC will be needed
- `createProposalSnapshot` still checks `status === 'active'`; it does not support staged estimates and would need updating if used from the staged proposal flow
- `createProposalSnapshot` and `sendProposal` still create/store `snapshot_json`; target architecture says estimate is durable truth and proposal artifacts must not become competing source of truth
- `rejectProposal` only updates `estimates.status`; `proposal_structures.proposal_status` remains `sent` (ProposalStatus does not include 'rejected'); future UI may need to check `estimates.status` for rejected state
- `pricing-access-actions.ts` does not use `requireModuleAccess` and does not check `is_admin`; inconsistency with estimate/proposal paths

---

## 5. Next recommended work

1. **Proposal artifact source-of-truth cleanup**
   - Ensure proposal documents are audit/output artifacts only
   - Prevent `snapshot_json` from becoming competing authoritative estimate truth

---

## 6. Summary

The permission/status foundation, archive/restore behavior, DB enum, staging flow, sign/void transitions, and documentation report paths are now aligned:

- Three-level permission model: `view` / `edit` / `manage`
- Existing DB mapping: `can_view` / `can_manage` / `can_assign`
- `manage` includes `edit`; `edit` includes `view`
- DB and TypeScript lifecycle statuses now include draft, active, staged, sent, signed, rejected, voided, archived
- Server and UI allow archiving draft/active estimates, including active estimates
- Archive confirmation is implemented with minimal inline UI
- Archived estimates restore to `draft`, not `active`
- `stageEstimate` transitions `active` → `staged` only; `setActiveEstimate` blocked while staged estimate exists
- `unstageEstimate` transitions `staged` → `active` via the `set_active_estimate` RPC
- Stage/Unstage buttons are wired in `EstimateSelector.tsx`; rejected estimates show Copy only
- `sendProposal` requires staged status; `send_proposal` RPC atomically sets `estimates.status = 'sent'` inside the same transaction that locks the estimate, transitions the proposal, and inserts the snapshot
- `signProposal` transitions both proposal structure and estimate to signed
- `voidProposal` transitions both proposal structure and estimate to voided and keeps the estimate locked
- `rejectProposal` transitions `sent` → `rejected` on estimates, requires `manage`
- `unlockProposal` removed; sent proposals are permanently locked
- SQL changes are applied directly in Supabase, not committed as repo migration files unless explicitly requested
- Slice reports are written to module directories under `docs/modules/`, not legacy slice/audit/archive paths

The next meaningful work is proposal artifact source-of-truth cleanup.
