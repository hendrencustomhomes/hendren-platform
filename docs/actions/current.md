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

Latest completed slice: **Slice 39D — Permission Repo Cleanup**

Recent completed work:
- **Slice 38 — Pricing Permission Alignment**
- **Slice 39A — Permission additive SQL pass**
- **Slice 39B — Permission repo transition**
- **Slice 39C — Permission SQL cleanup**
- **Slice 39D — Permission repo cleanup**

Reports:
- `docs/modules/pricing/slice_38_pricing_permission_alignment.md`
- `docs/modules/platform/slice_39b_permission_repo_transition.md`
- `docs/modules/platform/slice_39c_permission_sql_cleanup.md`
- `docs/modules/platform/slice_39d_permission_repo_cleanup.md`

Verified files after latest work:
- `docs/actions/START_HERE.md`
- `docs/actions/current.md`
- `docs/modules/platform/slice_39c_permission_sql_cleanup.md`
- `docs/modules/platform/slice_39d_permission_repo_cleanup.md`
- `src/lib/access-control.ts`
- `src/lib/access-control-server.ts`
- `src/app/actions/worksheet-pricing-actions.ts`

---

## 3. Current platform state

### SQL / DB process rule

SQL / schema / RPC / RLS / enum changes are made directly in Supabase through Claude Chat or another SQL-focused tool.

Do NOT create, modify, or commit files under `supabase/migrations/` unless explicitly requested.

Mixed DB + repo work must be split:
1. SQL / DB prompt first
2. Claude Code repo prompt second

SQL slice reports must be written from SQL execution output or by Actions GPT using the SQL execution output. Claude Code must not reconstruct SQL reports from repo context alone.

### Slice report location rule

Slice reports go under `docs/modules/`:
- Estimate / proposal / worksheet-in-estimate / send pipeline → `docs/modules/estimate/`
- Pricing / catalog / pricing sources → `docs/modules/pricing/`
- Cross-cutting platform / permissions / shared foundation / repo-wide bugfixes → `docs/modules/platform/`

### Permission model — final state

| Code level | DB column | Meaning |
|------------|-----------|---------|
| `view` | `can_view` | Read access |
| `edit` | `can_edit` | Build/mutate active work |
| `manage` | `can_manage` | Workflow authority |

Hierarchy:
- `manage` satisfies `edit` and `view`
- `edit` satisfies `view`

Current status:
- DB cleanup is complete
- Repo cleanup is complete
- No `can_assign` column remains
- No `can_manage_next` column remains
- Repo reads and writes only `can_view`, `can_edit`, and `can_manage`
- `can_manage` now means manage/workflow authority, not edit

Guard:
- `requireModuleAccess(profileId, rowKey, 'view' | 'edit' | 'manage')` in `src/lib/access-control-server.ts`

Admin/superuser policy:
- `is_admin = true` in `internal_access` remains a SQL/admin-assigned superuser flag
- feature code must not check `is_admin` directly
- all feature authorization routes through `requireModuleAccess`
- admin bypass lives only inside the shared access-control layer

Pricing access:
- `getCurrentPricingAccess` delegates to `requireModuleAccess`
- `unlinkRowFromPricing` requires estimate edit access before unlinking pricing from an estimate worksheet row

### Estimate status lifecycle

| Status | Editable | Archivable | Notes |
|--------|----------|------------|-------|
| `draft` | yes | yes | Default new estimate state |
| `active` | yes | yes | Selected working estimate for a job |
| `staged` | no | no | Locked for management review/send |
| `sent` | no | no | Proposal sent; permanently locked |
| `signed` | no | no | Client accepted; permanently locked |
| `rejected` | no | no | Rejected; locked; may duplicate manually |
| `voided` | no | no | Canceled; locked; may duplicate manually |
| `archived` | no | n/a | Hidden/recoverable; restores to `draft` |

### Estimate / Proposal

- End-to-end pipeline exists
- Estimate editability enforced via `isEstimateEditable()` — `draft` + `active` + `!locked_at`
- Archive allowed for `draft` / `active`; staged/sent/signed/rejected/voided cannot be archived
- Archived estimates restore to `draft`
- `stageEstimate` transitions `active` → `staged`
- `unstageEstimate` transitions `staged` → `active` via `set_active_estimate`
- `sendProposal` requires staged status and uses the `send_proposal` RPC
- `signProposal` transitions proposal structure and estimate to signed
- `voidProposal` transitions proposal structure and estimate to voided and keeps the estimate locked
- `rejectProposal` transitions estimates from `sent` to `rejected`; proposal structure intentionally remains `sent`
- `snapshot_json` is a write-once audit artifact only
- `createProposalSnapshot` accepts `active` and `staged`; terminal statuses and `archived` are rejected
- Sent proposals are permanently locked; `unlockProposal` was removed

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

---

## 4. Known gaps

- No pricing resolution logic
- `unstageEstimate` uses `set_active_estimate`; if that RPC rejects staged estimates internally, a dedicated `unstage_estimate` RPC will be needed
- `SnapshotCreateButton` UI only surfaces on the preview page when an active estimate exists; staged-flow snapshot button wiring is not implemented
- UI components that read only `proposal_structures.proposal_status` show `sent` for rejected proposals; UI that needs rejected state must read `estimates.status`

---

## 5. Next recommended work

1. **Pricing resolution logic**
   - Define how linked pricing source rows populate worksheet item pricing and metadata
   - Decide override behavior and preservation of manual edits
   - Keep pricing truth in the estimate/worksheet path consistent

2. **Proposal snapshot / staged-flow UX**
   - Make snapshot creation and preview flow work cleanly for staged estimates
   - Avoid changing terminal-status behavior

3. **Remaining workflow edge cases**
   - Verify unstage RPC behavior against live DB
   - Add dedicated unstage RPC only if required

---

## 6. Summary

The permission system is now normalized and no longer in migration mode.

Current important truth:
- Permission DB columns are `can_view`, `can_edit`, `can_manage`
- Repo reads and writes those final columns only
- `is_admin` remains shared-guard-only superuser behavior
- SQL changes stay Supabase-direct unless migration files are explicitly requested
- Slice reports stay under `docs/modules/`

Next meaningful product work is pricing resolution.
