# Slice 12.5 — Proposal Builder Auto-Sync + Lock Foundation

**Date:** 2026-05-02
**Branch:** claude/audit-worksheet-stability-nIwtF → dev
**Reference:** design/estimate_system_execution_plan_r02.md, docs/slices/slice_12_proposal_builder.md

---

## Objective

Fix the Slice 12 gap where saved proposal structures did not automatically include new
worksheet rows, and introduce the proposal/estimate lock foundation needed before
preview/send/sign flows.

---

## Locked Business Rules (Implemented)

| Rule | Implementation |
|---|---|
| Proposal auto-syncs with estimate unless locked | `reconcileStructure` called on every page render |
| Locking proposal also locks estimate | `lockProposal` writes `locked_at` to both tables |
| Locking occurs when proposal is "sent" | `lockProposal` transitions draft → sent |
| Sent proposals CAN be unlocked | `unlockProposal` is available for 'sent' status |
| Signed proposals CANNOT be unlocked | `unlockProposal` returns error if status = 'signed' |
| Signed proposal: void or duplicate only | `voidProposal` works from 'signed'; `unlockProposal` blocked |
| Void requires confirmation | Client-side `window.confirm()` before calling `voidProposal` |
| No actual send/sign workflow | Status transitions are admin controls, not real send/sign |

---

## Schema Changes

### `estimates` — three new columns

```sql
ALTER TABLE estimates
  ADD COLUMN locked_at TIMESTAMPTZ,      -- NULL = editable
  ADD COLUMN locked_by UUID REFERENCES auth.users(id),
  ADD COLUMN locked_reason TEXT;          -- audit: 'proposal_sent', 'proposal_signed'
```

### `proposal_structures` — four new columns

```sql
ALTER TABLE proposal_structures
  ADD COLUMN proposal_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (proposal_status IN ('draft', 'sent', 'signed', 'voided')),
  ADD COLUMN locked_at TIMESTAMPTZ,
  ADD COLUMN locked_by UUID REFERENCES auth.users(id),
  ADD COLUMN locked_reason TEXT;
```

### `job_worksheet_items` RLS — write paths now check estimate lock

Three policies updated:

| Policy | Before | After |
|---|---|---|
| `jwi_internal_insert` | `is_internal()` | `is_internal() AND estimates.locked_at IS NULL` |
| `jwi_internal_update` | `is_internal()` | `is_internal() AND estimates.locked_at IS NULL` |
| `jwi_internal_delete` | `is_internal() AND locked_at IS NULL` | same (via subquery on estimates) |

SELECT remains unchanged — locked estimates are still readable.

### `ESTIMATE_SELECT` constant

Added `ESTIMATE_SELECT` to `src/lib/estimateTypes.ts` as a shared string constant
to avoid column list drift across all estimate queries:

```typescript
export const ESTIMATE_SELECT =
  'id, job_id, title, status, is_change_order, parent_estimate_id, created_by, created_at, updated_at, locked_at, locked_by'
```

Used in: `estimate-actions.ts`, `proposal-actions.ts`, `worksheet/page.tsx`,
`proposal/page.tsx`, `proposal/builder/page.tsx`.

---

## Auto-Sync Algorithm

### `reconcileStructure(saved, worksheetRows)` — new in `proposalStructure.ts`

Called in both the summary view and the builder page when the proposal is NOT locked.

**Steps:**
1. Build `rowsById` from current worksheet rows
2. Find all top-level rows (parent_id null or parent not found)
3. Collect all `source_row_ids` already present in any saved section → `knownIds`
4. For each top-level row NOT in `knownIds`: create a new section (visible=true, title=null)
5. If no new rows: return saved structure unchanged (no unnecessary re-render)
6. If new rows: return `{ sections: [...saved.sections, ...newSections] }`

**Key properties:**
- Pure function — no DB writes on the path that just reads
- Preserved: saved section order, visibility, title overrides
- New sections: appended at the end in worksheet sort_order
- Deleted rows: left in saved sections (applyStructure skips missing source_row_ids)
- Locked proposals: `reconcileStructure` is NOT called — structure frozen

**When structure is persisted:**
The reconciled structure is NOT auto-saved. It is only used for display. The user saves
explicitly from the builder. On save, the reconciled (already-appended) sections are
persisted, so the next load sees them as "known".

---

## Lock / Status Model

### Status transitions

```
draft ──[lockProposal]──→ sent ──[signProposal]──→ signed
  ↑                         │                         │
  └──[unlockProposal]───────┘                         │
                             └──[voidProposal]──→ voided ←───[voidProposal]──┘
```

| Transition | Action | Estimate effect |
|---|---|---|
| draft → sent | `lockProposal` | Locks estimate (sets `locked_at`) |
| sent → draft | `unlockProposal` | Unlocks estimate (clears `locked_at`) |
| sent → signed | `signProposal` | Estimate stays locked |
| sent → voided | `voidProposal` | Unlocks estimate |
| signed → voided | `voidProposal` | Estimate stays locked |

### Why signed → void keeps estimate locked

Once signed, the proposal represents a contractual commitment. The estimate that backs it
must remain frozen as an audit record. The user can duplicate the estimate (via
EstimateSelector) to get an editable copy for a new proposal.

### Unlock guard

`unlockProposal` checks `proposal_status` before doing anything:
- `status = 'signed'` → returns `{ error: 'A signed proposal cannot be unlocked.' }`
- `status ≠ 'sent'` → returns error (idempotent guard)

---

## Estimate Lock Behavior

When `estimates.locked_at IS NOT NULL`:

| Path | Enforcement |
|---|---|
| INSERT worksheet row | RLS `jwi_internal_insert` blocks |
| UPDATE worksheet row | RLS `jwi_internal_update` blocks |
| DELETE worksheet row | RLS `jwi_internal_delete` blocks |
| Import into locked estimate | Prevented — import always creates a NEW unlocked estimate |
| Duplicate locked estimate | Allowed — creates a new unlocked draft copy |
| Worksheet page | Shows yellow locked banner with link to Proposal Builder |
| Add row / Import CSV buttons | Hidden in worksheet orchestrator when `isLocked` |
| Export CSV | Still available — read-only, no write needed |

---

## Protected Write Paths

| Write path | Enforcement layer | Behaviour when locked |
|---|---|---|
| `persistRow` (client SDK UPDATE) | RLS `jwi_internal_update` | Supabase returns 0 rows; `.single()` throws; row enters error state |
| `createRow` (client SDK INSERT) | RLS `jwi_internal_insert` | Supabase returns error; row enters error state |
| `deleteRow` (client SDK DELETE) | RLS `jwi_internal_delete` | RLS filters out matching rows; 0 affected; no error thrown |
| `persistSortOrders` (client SDK UPDATE ×N) | RLS `jwi_internal_update` | Each returns 0 rows; `.single()` throws |
| `saveProposalStructure` (server action) | App-layer check + RLS | Returns `{ error: 'Proposal is locked…' }` |
| `importEstimate` (server action) | Always creates new unlocked estimate | Not affected |

---

## Files Added / Changed

| File | Change |
|---|---|
| DB migration `add_estimate_lock_fields` | `locked_at`, `locked_by`, `locked_reason` on `estimates` |
| DB migration `add_proposal_status_and_lock_fields` | `proposal_status`, lock fields on `proposal_structures` |
| DB migration `update_jwi_rls_for_estimate_lock` | Lock-aware INSERT/UPDATE/DELETE policies |
| `src/lib/estimateTypes.ts` | Added `locked_at`, `locked_by` to `Estimate`; added `ESTIMATE_SELECT` |
| `src/lib/proposalStructure.ts` | Added `ProposalStatus` type; added `reconcileStructure` |
| `src/app/actions/proposal-actions.ts` | Full rewrite: added `lockProposal`, `unlockProposal`, `signProposal`, `voidProposal`; updated `saveProposalStructure` with lock check; updated `getProposalStructure` to return status+locked_at |
| `src/app/actions/estimate-actions.ts` | Use `ESTIMATE_SELECT` everywhere; comment on importEstimate lock non-applicability |
| `src/app/jobs/[id]/proposal/page.tsx` | Use `ESTIMATE_SELECT`; read status+locked_at; call `reconcileStructure` when unlocked; show status badge |
| `src/app/jobs/[id]/proposal/builder/page.tsx` | Use `ESTIMATE_SELECT`; read status+locked_at; call `reconcileStructure` when unlocked; pass `proposalStatus` + `isLocked` to orchestrator |
| `src/components/patterns/proposal/ProposalBuilderOrchestrator.tsx` | Full rewrite: locked UI (read-only controls), admin action buttons (lock/unlock/sign/void), void confirmation, status badge, locked notice |
| `src/app/jobs/[id]/worksheet/page.tsx` | Use `ESTIMATE_SELECT`; derive `isLocked`; pass to orchestrator |
| `src/components/patterns/estimate/JobWorksheetPageOrchestrator.tsx` | `isLocked` prop; yellow locked banner; hide Add row / Import CSV when locked |

---

## Intentionally Not Implemented

- Actual client send flow (email, link generation)
- E-signature integration
- PDF generation
- Proposal snapshots with duplicated pricing data
- Full approval/signing workflow UI
- Role-based access control (deferred to permissions slice)
- Cascade voiding of child change orders

---

## Validation Run

| Stage | Result |
|---|---|
| DB migration 1 (estimate lock fields) | Applied successfully |
| DB migration 2 (proposal status + lock) | Applied successfully |
| DB migration 3 (jwi RLS update) | Applied successfully |
| Compilation (Turbopack) | Pass — 4.5s |
| TypeScript | Pass — 7.1s |
| Static prerender | Pre-existing Supabase env-var failure — unrelated |

---

## Risks / Follow-up Items

1. **`deleteRow` silently no-ops when locked**: The RLS USING filter removes the row from
   the delete target, returning 0 affected rows with no error. The worksheet UI has
   already removed the row locally, so there's a visual inconsistency until reload.
   A future slice should add a client-side lock check before calling delete.

2. **Worksheet rows enter error state on locked edit**: When a user types in a locked
   worksheet, the persistence hook fails at the RLS layer and marks rows as 'error'.
   The locked banner explains why, but the UX could be improved with a client-side
   guard that prevents editing entirely (not just shows an error after the fact).

3. **No "duplicate signed estimate" shortcut in proposal UI**: A signed proposal's estimate
   is permanently locked. The user must navigate to the worksheet EstimateSelector to
   duplicate the estimate. A "Duplicate estimate" button in the builder would improve this.

4. **`voidProposal` from 'signed' leaves estimate locked**: Intentional (see lock model
   above). May surprise users who expect voiding to free the estimate. Documented.

5. **Structure auto-sync is display-only until user saves**: New worksheet rows appear
   in the builder and summary but are not persisted to `proposal_structures` until the
   user explicitly saves. If the user never opens the builder, new rows always appear via
   `reconcileStructure` (correct behavior, but the structure record stays stale).
