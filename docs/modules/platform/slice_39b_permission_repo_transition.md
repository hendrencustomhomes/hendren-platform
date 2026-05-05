# Slice 39B — Permission Repo Transition

**Status:** Complete  
**Date:** 2026-05-05  
**Branch:** dev

---

## 1. Files Changed

| File | Change |
|---|---|
| `src/lib/access-control.ts` | `normalizePermissionState` accepts `can_edit` and `can_manage_next` input fields |
| `src/lib/access-control-server.ts` | Reads switched to new column names; `toPermissionDbColumns` added; both write sites updated to dual-write |
| `src/app/actions/worksheet-pricing-actions.ts` | Added `requireModuleAccess` guard to `unlinkRowFromPricing` |
| `docs/modules/platform/slice_39b_permission_repo_transition.md` | This report |

---

## 2. What Changed

### DB column state (verified before editing)

Both `user_permission_snapshots` and `template_permissions` have all five columns:

| Column | Status |
|---|---|
| `can_view` | Legacy — unchanged |
| `can_manage` | Legacy (edit-level) — kept for dual-write |
| `can_assign` | Legacy (manage-level) — kept for dual-write |
| `can_edit` | New (edit-level) — authoritative for reads after this slice |
| `can_manage_next` | New (manage-level) — authoritative for reads after this slice |

### `normalizePermissionState` — new input fields accepted (`access-control.ts`)

Added `can_edit` and `can_manage_next` to the input type and resolution logic:

```typescript
let canManage = input.canManage === true || input.can_manage === true || input.can_edit === true
let canAssign  = input.canAssign === true  || input.can_assign === true  || input.can_manage_next === true
```

All three sources (camelCase, legacy snake_case, new snake_case) resolve correctly. No breaking change — existing callers passing `can_manage`/`can_assign` continue to work.

### Centralized dual-write mapper — `toPermissionDbColumns` (`access-control-server.ts`)

Added one private function at the top of the file before `requireModuleAccess`:

```typescript
function toPermissionDbColumns(row: { canView: boolean; canManage: boolean; canAssign: boolean }) {
  return {
    can_view: row.canView,
    can_edit: row.canManage,          // new authoritative column
    can_manage_next: row.canAssign,   // new authoritative column
    can_manage: row.canManage,        // legacy dual-write
    can_assign: row.canAssign,        // legacy dual-write
  }
}
```

Both write sites in `access-control-server.ts` (`saveUserAccessModel` and `saveTemplatePermissionMatrix`) now use `...toPermissionDbColumns(row)` instead of inline column writes. This is the single place to update when the legacy columns are eventually dropped.

### Reads switched to new column names (`access-control-server.ts`)

`requireModuleAccess` now SELECTs:
```
can_view, can_edit, can_manage_next
```
from both `user_permission_snapshots` and `template_permissions` (two query sites). The legacy columns (`can_manage`, `can_assign`) are no longer read. `normalizePermissionState` maps the new names correctly via the input field additions above.

### Comments updated (`access-control-server.ts`)

Permission level → column mapping updated to reflect transition:
```
view   → can_view        (unchanged)
edit   → can_edit        (was can_manage)
manage → can_manage_next (was can_assign; will be renamed to can_manage)
```

### `unlinkRowFromPricing` guard added (`worksheet-pricing-actions.ts`)

Added `requireModuleAccess(auth.user.id, 'estimates', 'edit')` as the first check after auth. This is consistent with all worksheet mutation actions in `worksheet-item-actions.ts`. Previously this function only checked user auth and estimate editability — it had no module-level permission check.

---

## 3. Out of Scope

- Legacy columns (`can_manage`, `can_assign`) are NOT dropped — dual-write keeps them in sync
- No Supabase migration files created
- `can_manage_next` is NOT renamed to `can_manage` — that rename is a future step
- No DB constraints changed
- `is_admin` enforcement untouched — remains only inside `requireModuleAccess`

---

## 4. Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass — no errors |
| DB column existence | Verified via SQL — both new columns exist in both tables |

---

## 5. Risks / Follow-up

**Legacy column drop:** When legacy `can_manage` and `can_assign` are dropped, the `can_manage` and `can_assign` lines inside `toPermissionDbColumns` must be removed. That is the only change point — no other files need to change.

**`can_manage_next` rename:** When `can_manage_next` is renamed to `can_manage`, `toPermissionDbColumns` must be updated accordingly, and the SELECT strings in `requireModuleAccess` updated. A single-file change.

**RLS policies:** Any RLS policies or DB functions that read `can_manage` or `can_assign` directly from the tables will continue to work because dual-write keeps them current. They do not need to be updated until the legacy columns are dropped.

**`normalizePermissionState` input type:** The function now accepts 8 optional boolean input fields. This is intentional for the transition period. Once legacy columns are dropped from the DB and all callers pass only the new column names, the legacy fields can be removed from the input type.
