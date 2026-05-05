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

Latest completed work: **Slice 39C — Permission SQL Cleanup** (Supabase-direct DB change; repo report file not yet committed)

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
- **Slice 35 — `snapshot_json` usage audited and constrained as write-once audit output only**
- **Slice 36 — `createProposalSnapshot` eligibility widened to include staged estimates**
- **Slice 37 — rejected proposal status asymmetry documented as intentional design**
- **Slice 38 — pricing access now delegates to `requireModuleAccess`; admin bypass inherited from shared guard**
- **Slice 39A — Supabase additive permission columns applied directly in DB**
- **Slice 39B — repo permission reads transitioned to transitional new columns; permission writes dual-write through one mapper; pricing unlink guard added**
- **Slice 39C — Supabase permission SQL cleanup dropped legacy permission columns/constraints and renamed `can_manage_next` to `can_manage`**
- **Design update — `is_admin` retained as SQL/admin-only superuser flag; feature code must route through `requireModuleAccess`**
- **Process update — Claude prompt selection now requires DB-vs-code classification before drafting**

Reports:
- `docs/modules/estimate/slice_29_archive_restore_fix.md`
- `docs/modules/estimate/slice_30_stage_estimate_action.md`
- `docs/modules/estimate/slice_31_stage_unstage_ui.md`
- `docs/modules/estimate/slice_32_reject_and_lock.md`
- `docs/modules/estimate/slice_33_send_rpc_atomic_status_cleanup.md`
- `docs/modules/estimate/slice_34_void_sign_status_alignment.md`
- `docs/modules/estimate/slice_35_proposal_snapshot_constraints.md`
- `docs/modules/estimate/slice_36_snapshot_staged_support.md`
- `docs/modules/estimate/slice_37_reject_status_asymmetry.md`
- `docs/modules/pricing/slice_38_pricing_permission_alignment.md`
- `docs/modules/platform/slice_39b_permission_repo_transition.md`

Missing report to create next:
- `docs/modules/platform/slice_39c_permission_sql_cleanup.md`

Verified files after latest work:
- `docs/actions/START_HERE.md`
- `docs/actions/templates/claude_chat_sql_prompt.md`
- `docs/actions/templates/claude_code_prompt.md`
- `docs/actions/current.md`
- `docs/design/module_structure`
- `src/lib/access-control.ts`
- `src/lib/access-control-server.ts`
- `src/app/actions/pricing-access-actions.ts`
- `src/app/actions/worksheet-pricing-actions.ts`
- `src/app/actions/document-actions.ts`
- `src/app/actions/proposal-actions.ts`
- `src/lib/proposalSnapshot.ts`
- `src/lib/proposalStructure.ts`
- `docs/modules/platform/slice_39b_permission_repo_transition.md`

Note: `docs/modules/estimate/slice_30_stage_estimate_action.md` originally said the enum migration was deferred, but the DB enum was applied separately and the report now has a post-slice correction. Current DB enum values are confirmed as: `draft`, `active`, `approved`, `archived`, `staged`, `sent`, `signed`, `rejected`, `voided`.

---

## 3. Current platform state (verified)

### SQL / DB process rule

SQL / schema / RPC / RLS / enum changes are made directly in Supabase through Claude Chat or another SQL-focused tool.

Do NOT create, modify, or commit files under `supabase/migrations/` unless the user explicitly asks for repo migration files.

This rule is recorded in:
- `docs/actions/START_HERE.md`
- `docs/actions/templates/claude_chat_sql_prompt.md`

Claude prompt selection must be classified before drafting:
- DB / SQL / schema / RPC / RLS / enum / trigger / policy / data backfill work → use `docs/actions/templates/claude_chat_sql_prompt.md`
- Repo/code/docs-only work → use `docs/actions/templates/claude_code_prompt.md`
- Mixed DB + repo work → split into SQL first, Code second

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

Three levels, DB cleanup complete but repo cleanup still pending:

| Code level | Final DB column | Meaning |
|------------|-----------------|---------|
| `view`     | `can_view`      | Read access |
| `edit`     | `can_edit`      | Build/mutate active work |
| `manage`   | `can_manage`    | Workflow authority: send/sign/void/reject/finalize |

Hierarchy: `manage` satisfies `edit` + `view`. `edit` satisfies `view`.

Guard: `requireModuleAccess(profileId, rowKey, 'view' | 'edit' | 'manage')` in `src/lib/access-control-server.ts`.

Transition status:
- Slice 39A added `can_edit` and `can_manage_next` to `template_permissions` and `user_permission_snapshots`, then backfilled them from legacy `can_manage` and `can_assign`
- Slice 39B switched repo reads to `can_view`, `can_edit`, and transitional `can_manage_next`, and centralized dual-writes in `toPermissionDbColumns`
- Slice 39C completed Supabase cleanup: legacy `can_assign` and legacy edit-level `can_manage` were dropped; `can_manage_next` was renamed to final `can_manage`; final constraints now enforce `can_edit` requires `can_view` and `can_manage` requires `can_edit` + `can_view`
- Current DB columns on both `template_permissions` and `user_permission_snapshots` are now exactly `can_view`, `can_edit`, `can_manage`
- Repo code is stale until Slice 39D removes references to `can_manage_next`, `can_assign`, and legacy dual-write scaffolding

Admin/superuser policy:
- `is_admin = true` in `internal_access` is retained as a SQL/admin-assigned superuser flag
- feature code must not check `is_admin` directly
- all feature authorization must route through `requireModuleAccess`
- any admin bypass must live only inside the shared access-control layer
- there must be no normal UI for assigning or removing `is_admin`

This policy is recorded in:
- `docs/design/module_structure`

Pricing access alignment:
- `getCurrentPricingAccess` delegates to `requireModuleAccess` for `view`, `edit`, and `manage`
- return shape remains `{ canView, canManage, canAssign, error? }` for caller compatibility
- admin bypass and template/snapshot fallback are inherited from the shared guard
- `unlinkRowFromPricing` checks `requireModuleAccess(auth.user.id, 'estimates', 'edit')` before unlinking pricing from an estimate worksheet row

### Estimate status lifecycle

| Status     | Editable | Archivable | Notes |
|------------|----------|------------|-------|
| `draft`    | yes      | yes        | Default new estimate state |
| `active`   | yes      | yes        | Selected working estimate for a job |
| `staged`   | no       | no         | Locked for management review/send |
| `sent`     | no       | no         | Proposal sent; permanently locked |
| `signed`   | no       | no         | Client accepted; permanently locked |
| `rejected` | no       | no         | Rejected; locked; may duplicate manually |
| `voided`   | no       | no         | Canceled; locked; may duplicate manually |
| `archived` | no       | n/a        | Hidden/recoverable; restores to `draft` |

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
- `rejectProposal` server action transitions `sent` → `rejected` on estimates only; `proposal_structures.proposal_status` intentionally remains `sent` because rejection is an estimate lifecycle outcome, not a document workflow state
- `ProposalStatus` intentionally excludes `rejected` and `staged`; code that needs rejected state must read `estimates.status`
- `unlockProposal` removed; sent proposals cannot be reverted to draft
- `snapshot_json` is explicitly documented as a write-once audit artifact only; it must not be read for status, scope, pricing, or other business decisions
- `createProposalSnapshot` accepts `active` and `staged` estimates; terminal statuses (`sent`, `signed`, `voided`, `rejected`) and `archived` are rejected
- Worksheet mutations protected at both app (`edit` guard) + RLS layers
- Health indicators visible (non-blocking)
- Send validation enforced server-side
- Canonical send path is `sendProposal` via `send_proposal` RPC (SECURITY DEFINER)

### Action permission guards

| Action | File | Level |
|--------|------|-------|
| `getEstimatesForJob` | estimate-actions.ts | `view` |
| `createEstimate` | estimate-actions.ts | `edit` |
| `setActiveEstimate` | estimate-actions.ts | `edit` |
| `archiveEstimate` | estimate-actions.ts | `edit` |
| `restoreEstimate` | estimate-actions.ts | `edit` |
| `stageEstimate` | estimate-actions.ts | `edit` |
| `unstageEstimate` | estimate-actions.ts | `edit` |
| `duplicateEstimate` | estimate-actions.ts | `edit` |
| `importEstimate` | estimate-actions.ts | `edit` |
| `renameEstimate` | estimate-actions.ts | `edit` |
| `persistWorksheetRow` | worksheet-item-actions.ts | `edit` |
| `createWorksheetRow` | worksheet-item-actions.ts | `edit` |
| `restoreWorksheetRows` | worksheet-item-actions.ts | `edit` |
| `deleteWorksheetRow` | worksheet-item-actions.ts | `edit` |
| `persistWorksheetSortOrders` | worksheet-item-actions.ts | `edit` |
| `unlinkRowFromPricing` | worksheet-pricing-actions.ts | `edit` |
| `getProposalStructure` | proposal-actions.ts | `view` |
| `saveProposalStructure` | proposal-actions.ts | `edit` |
| `rejectProposal` | proposal-actions.ts | `manage` |
| `signProposal` | proposal-actions.ts | `manage` |
| `voidProposal` | proposal-actions.ts | `manage` |
| `createProposalSnapshot` | document-actions.ts | `edit` |
| `sendProposal` | document-actions.ts | `manage` |
| `voidProposalDocument` | document-actions.ts | `manage` |

### Data model / DB enforcement

- RLS enforced for worksheet mutation safety
- `estimate_status` DB enum now accepts all TypeScript lifecycle values, plus legacy `approved`
- `send_proposal` RPC runs as SECURITY DEFINER; `sendProposal` applies `manage` guard before invoking it; RPC now atomically sets `estimates.status = 'sent'` and enforces `staged` precondition at the DB layer (Supabase-direct change version `20260505001007`)
- `set_active_estimate` RPC verified SECURITY INVOKER; RLS applies inside the function

---

## 4. Known gaps (verified)

- Repo permission cleanup is now required after SQL cleanup: `access-control-server.ts` still selects/writes transitional or legacy columns that no longer exist in live DB
- `docs/modules/platform/slice_39c_permission_sql_cleanup.md` is missing from repo and should be created from the completed SQL report
- `schema_current.sql`, if present/used, may be stale and should be located before assuming it is authoritative
- No pricing resolution logic
- `unstageEstimate` uses `set_active_estimate` RPC; if the RPC has internal status guards that reject staged estimates, a dedicated `unstage_estimate` RPC will be needed
- `SnapshotCreateButton` UI only surfaces on the preview page when an active estimate exists; staged-flow snapshot button wiring not yet implemented
- UI components that read only `proposal_structures.proposal_status` will show `sent` for rejected proposals; any UI that needs rejected state must read `estimates.status`

---

## 5. Next recommended work

1. **Slice 39D — Repo cleanup after SQL rename**
   - Use Claude Code template
   - Verify live repo references with grep before editing: `can_manage_next`, `can_assign`, `can_edit`, `can_manage`, and `can_view`
   - Update `requireModuleAccess` SELECTs from `can_manage_next` to final `can_manage`
   - Update `toPermissionDbColumns` to write only final DB columns: `can_view`, `can_edit`, `can_manage`
   - Remove all writes to dropped legacy columns `can_assign` and legacy edit-level `can_manage`
   - Remove `can_manage_next` compatibility from `normalizePermissionState`
   - Be careful: final `can_manage` now means workflow/manage authority, not edit
   - Create `docs/modules/platform/slice_39c_permission_sql_cleanup.md` from the completed SQL report if still missing
   - Write `docs/modules/platform/slice_39d_permission_repo_cleanup.md`
   - Run TypeScript validation

2. **Post-39D verification / docs cleanup**
   - Confirm no repo references to `can_manage_next` or `can_assign` remain
   - Locate and update `schema_current.sql` only if it exists and is part of repo truth
   - Update `docs/design/module_structure` permission mapping if it still references transitional or legacy names

---

## 6. Summary

The permission/status foundation, pricing access alignment, archive/restore behavior, DB enum, staging flow, sign/void transitions, rejection asymmetry decision, snapshot audit-artifact contract, admin superuser policy, and documentation report paths are aligned, with one urgent repo cleanup needed after the SQL rename.

Current important truth:
- Three-level permission model: `view` / `edit` / `manage`
- Final DB mapping after Slice 39C: `can_view` / `can_edit` / `can_manage`
- Legacy DB columns `can_assign` and the old edit-level `can_manage` are gone from live DB
- `can_manage_next` is gone from live DB and has been renamed to final `can_manage`
- Repo code still needs Slice 39D to stop selecting/writing transitional or dropped columns
- `getCurrentPricingAccess` delegates to `requireModuleAccess`, inheriting admin bypass and canonical permission resolution
- `unlinkRowFromPricing` requires estimate edit access before mutation
- `is_admin` remains as SQL/admin-only superuser access inside the shared guard, not feature code
- DB and TypeScript lifecycle statuses include draft, active, staged, sent, signed, rejected, voided, archived
- Server and UI allow archiving draft/active estimates, including active estimates
- Archived estimates restore to `draft`, not `active`
- `stageEstimate` transitions `active` → `staged` only; `setActiveEstimate` blocked while staged estimate exists
- `unstageEstimate` transitions `staged` → `active` via the `set_active_estimate` RPC
- `sendProposal` requires staged status; `send_proposal` RPC atomically sets `estimates.status = 'sent'` inside the same transaction that locks the estimate, transitions the proposal, and inserts the snapshot
- `signProposal` transitions both proposal structure and estimate to signed
- `voidProposal` transitions both proposal structure and estimate to voided and keeps the estimate locked
- `rejectProposal` transitions `sent` → `rejected` on estimates only; proposal structure remains `sent` by design
- `snapshot_json` is constrained by comments as a write-once audit artifact; live estimate truth remains in `estimates` and `job_worksheet_items`
- `createProposalSnapshot` accepts `active` and `staged` estimates; terminal statuses and `archived` are rejected
- `unlockProposal` removed; sent proposals are permanently locked
- SQL changes are applied directly in Supabase, not committed as repo migration files unless explicitly requested
- Slice reports are written to module directories under `docs/modules/`, not legacy slice/audit/archive paths

The next meaningful work is Slice 39D repo cleanup after the SQL rename.
