# Permission and Estimate Status Architecture Rewrite

**Date:** 2026-05-04  
**Branch:** dev  
**Type:** Architecture rewrite — code + docs

---

## 1. Files Changed

### Code

| File | Change |
|---|---|
| `src/lib/access-control-server.ts` | Updated `requireModuleAccess` to support `'view' \| 'edit' \| 'manage'`; added `canAssign` to perms resolution; updated level→DB column mapping and error messages |
| `src/lib/estimateTypes.ts` | Replaced `EstimateStatus` with 8-member lifecycle type; exported `NON_ARCHIVABLE_STATUSES`; updated `isEstimateEditable` comment |
| `src/app/actions/estimate-actions.ts` | Remapped all mutation guards from `'manage'` to `'edit'`; rewrote archive guard: removed active-estimate blocker, added `NON_ARCHIVABLE_STATUSES` check |
| `src/app/actions/worksheet-item-actions.ts` | Remapped all 5 mutation guards from `'manage'` to `'edit'` |
| `src/app/actions/proposal-actions.ts` | Remapped `saveProposalStructure` from `'manage'` to `'edit'`; `unlockProposal`/`signProposal`/`voidProposal` remain `'manage'` |
| `src/app/actions/document-actions.ts` | Remapped `createProposalSnapshot` from `'manage'` to `'edit'`; `sendProposal`/`voidProposalDocument` remain `'manage'` |
| `src/components/patterns/estimate/EstimateSelector.tsx` | Added all new `EstimateStatus` values to `STATUS_STYLE` record; removed `'approved'` |

### Docs

| File | Change |
|---|---|
| `docs/design/module_structure` | Replaced view/manage/assign section with view/edit/manage; documented DB column mapping; defined edit/manage boundary |
| `docs/actions/current.md` | Full rewrite: new permission model table, status lifecycle table, action guard table, updated gaps and next slices |
| `docs/actions/architecture/permission_status_rewrite.md` | This document |

---

## 2. Permission Model Implemented

### Three-level model

| Code level | DB column   | Meaning                                           |
|------------|-------------|---------------------------------------------------|
| `view`     | `can_view`  | Read access to module records                     |
| `edit`     | `can_manage`| Build, create, update, mutate active work         |
| `manage`   | `can_assign`| Workflow authority: stage, send, sign, void, reject |

### Hierarchy

```
manage satisfies edit + view
edit   satisfies view
```

This hierarchy is already enforced by `normalizePermissionState` in `access-control.ts` (unchanged):
- `canAssign` implies `canManage` implies `canView`
- Code labels map: `canAssign` = manage, `canManage` = edit, `canView` = view

**No change was needed to `normalizePermissionState` or `PermissionMatrixCell`.** The existing DB hierarchy perfectly matches the new code semantics. Only `requireModuleAccess` needed updating.

### Action guard mapping

| Level    | Actions |
|----------|---------|
| `view`   | `getEstimatesForJob`, `getProposalStructure` |
| `edit`   | `createEstimate`, `setActiveEstimate`, `archiveEstimate`, `duplicateEstimate`, `importEstimate`, `renameEstimate`, all 5 worksheet mutations, `saveProposalStructure`, `createProposalSnapshot` |
| `manage` | `unlockProposal`, `signProposal`, `voidProposal`, `sendProposal`, `voidProposalDocument` |

---

## 3. Status Model Implemented

### New `EstimateStatus` type

```typescript
type EstimateStatus =
  | 'draft'     // editable option
  | 'active'    // selected editable working estimate
  | 'staged'    // locked for management review/send
  | 'sent'      // proposal sent; permanently locked
  | 'signed'    // client accepted; permanently locked
  | 'rejected'  // rejected; permanently locked; may duplicate manually
  | 'voided'    // canceled; permanently locked; may duplicate manually
  | 'archived'  // hidden/recoverable; only draft/active may be archived
```

**Removed:** `'approved'` — replaced by the structured terminal statuses above.

### Editability

`isEstimateEditable` unchanged in logic: `(status === 'draft' || status === 'active') && !locked_at`.

The new statuses (staged, sent, signed, rejected, voided) are all non-editable by definition since they are outside draft/active.

### Archive behavior

**Removed:** the blocker preventing archival of active estimates ("Set another estimate as active first").  
**Added:** `NON_ARCHIVABLE_STATUSES` guard — staged, sent, signed, rejected, voided may not be archived.

Both draft and active estimates can now be archived without restrictions.

---

## 4. Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass — no errors |

---

## 5. Remaining DB / Migration Debt

### No migration required for this rewrite

The DB already has `can_view`, `can_manage`, `can_assign` columns. The new code semantics map directly to these existing columns without any schema change.

### DB enum for estimate status

The DB `estimates.status` column uses a Postgres enum (`estimate_status` or similar). The current enum values are `draft`, `active`, `approved`, `archived`. The new TypeScript type adds `staged`, `sent`, `signed`, `rejected`, `voided` and removes `approved`.

**Status:** A DB migration will be required before any code can write these new statuses to the `estimates` table. The TypeScript type is defined now to establish the code contract. Until the migration runs:
- No action currently writes `staged`, `sent`, `signed`, `rejected`, or `voided` to `estimates.status` directly (the `send_proposal` RPC writes to `proposal_structures`, not `estimates.status`)
- The type change does not break existing writes
- The missing enum values will cause a DB error only when a new action attempts to write them

**Required migration (deferred):**
```sql
-- Add new values to the estimate status enum
ALTER TYPE estimate_status ADD VALUE IF NOT EXISTS 'staged';
ALTER TYPE estimate_status ADD VALUE IF NOT EXISTS 'sent';
ALTER TYPE estimate_status ADD VALUE IF NOT EXISTS 'signed';
ALTER TYPE estimate_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE estimate_status ADD VALUE IF NOT EXISTS 'voided';
-- 'approved' can be deprecated after confirming no existing rows use it
```

---

## 6. Risks / Follow-up

### Archived estimate restore behavior

The current `setActiveEstimate` action (called "Restore" in `EstimateSelector.tsx`) sets status to `active` via the `set_active_estimate` RPC. The design intent is that archived estimates restore to `draft`, not `active`. This behavioral mismatch exists now but is non-breaking:
- Archived estimates currently have no rows being restored in production with the new statuses
- A dedicated `restoreEstimate` action that sets `status = 'draft'` is the correct fix
- **Deferred:** create `restoreEstimate` server action and update `EstimateSelector` to call it

### `staged` and `rejected` actions not yet implemented

The `staged` and `rejected` statuses are defined in the type but no server actions exist to transition estimates to those states. These are deferred to future slices.

### `pricing-access-actions.ts` inconsistency

This file does not use `requireModuleAccess` and does not check `is_admin`. It predates the canonical guard. Not changed here — out of scope.

### `unlockProposal` non-atomic dual write

Remains as-is. Active UI path. Flagged in prior slices. Not changed here.

---

## 7. Intentionally Not Changed

- `src/lib/access-control.ts` — `normalizePermissionState`, `PermissionMatrixCell`, `ASSIGN_DISABLED_ROWS`, and all other exports unchanged. The existing hierarchy is correct for the new model.
- `src/lib/access-control-server.ts` — all functions other than `requireModuleAccess` unchanged
- DB schema — no migrations written or run
- `src/app/actions/proposal-actions.ts` — `getProposalStructure` (`view`) and workflow actions (`unlockProposal`, `signProposal`, `voidProposal`, all `manage`) unchanged in level
- `src/app/actions/document-actions.ts` — `sendProposal` and `voidProposalDocument` remain `manage`
- RLS policies — not modified
- Supabase DB functions — not modified
- All UI components other than `EstimateSelector.tsx` (minimal fix for compile) — not modified
- `pricing-access-actions.ts` — not modified
- `worksheet-pricing-actions.ts` — not modified
