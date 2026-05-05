# Slice 39D — Permission Repo Cleanup

**Status:** Complete  
**Date:** 2026-05-05  
**Branch:** dev

---

## 1. Files Changed

| File | Change |
|---|---|
| `src/lib/access-control.ts` | `normalizePermissionState` input type simplified; stale fields removed; resolution updated |
| `src/lib/access-control-server.ts` | `toPermissionDbColumns` simplified to 3 final columns; SELECTs updated; comments updated |
| `docs/modules/platform/slice_39c_permission_sql_cleanup.md` | DB-side description of 39C |
| `docs/modules/platform/slice_39d_permission_repo_cleanup.md` | This report |

---

## 2. What Changed

### Final DB column mapping (authoritative after Slice 39C)

| DB Column | Code variable | Level |
|---|---|---|
| `can_view` | `canView` | view |
| `can_edit` | `canManage` | edit |
| `can_manage` | `canAssign` | manage |

Internal code variable names (`canView`, `canManage`, `canAssign`) are unchanged. Only the DB column names changed.

### `normalizePermissionState` — input type simplified (`access-control.ts`)

Removed stale legacy fields from the input type:

- Removed: `can_manage?` (old edit-level legacy — was `can_manage` before the 39C rename)
- Removed: `can_assign?` (dropped from DB in 39C)
- Removed: `can_manage_next?` (renamed to `can_manage` in 39C)

Final input type:

```typescript
input: {
  canView?: boolean | null
  canManage?: boolean | null
  canAssign?: boolean | null
  can_view?: boolean | null
  can_edit?: boolean | null    // DB edit-level
  can_manage?: boolean | null  // DB manage-level (final column name)
}
```

Resolution updated to match final column semantics:

```typescript
let canManage = input.canManage === true || input.can_edit === true
let canAssign = input.canAssign === true || input.can_manage === true
```

**Critical:** `can_manage` in the DB is now manage-level (maps to `canAssign`). Previously it was edit-level. The resolution order is correct.

### `toPermissionDbColumns` simplified (`access-control-server.ts`)

Before (dual-write with stale columns):

```typescript
return {
  can_view: row.canView,
  can_edit: row.canManage,
  can_manage_next: row.canAssign,   // dropped
  can_manage: row.canManage,        // was legacy edit-level
  can_assign: row.canAssign,        // dropped
}
```

After (final, 3 columns only):

```typescript
return {
  can_view: row.canView,
  can_edit: row.canManage,
  can_manage: row.canAssign,  // manage-level, final column name
}
```

### SELECTs updated (`access-control-server.ts`)

Two query sites in `requireModuleAccess`:

```
Before: .select('can_view, can_edit, can_manage_next')
After:  .select('can_view, can_edit, can_manage')
```

### Comments updated (`access-control-server.ts`)

Permission level → column mapping:

```
view   → can_view   (unchanged)
edit   → can_edit   (unchanged)
manage → can_manage (was can_manage_next)
```

Removed reference to dual-write and transition language.

---

## 3. Out of Scope

- No DB changes — all DB work was done in Slice 39C
- `normalizePermissionState` camelCase input fields (`canView`, `canManage`, `canAssign`) unchanged — callers using code-side variables continue to work
- No RLS policy changes needed — policies use the DB columns directly and those are now correct

---

## 4. Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass — no errors |
| `grep can_manage_next` | Zero matches |
| `grep can_assign` | Zero matches (outside this doc) |

---

## 5. Risks / Follow-up

None. The permission column transition is complete. The three final DB columns (`can_view`, `can_edit`, `can_manage`) are the only write and read targets. No further migration steps are needed for this subsystem.
