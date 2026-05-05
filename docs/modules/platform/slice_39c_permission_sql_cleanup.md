# Slice 39C — Permission SQL Cleanup

**Status:** Complete  
**Date:** 2026-05-05  
**Branch/context:** dev  
**Execution:** Supabase-direct SQL; no repo migration file

---

## 1. Inspection Findings

| Item | Finding |
|---|---|
| Columns on both tables | All 5 present before cleanup: `can_view`, `can_manage` (legacy edit), `can_assign` (legacy manage), `can_edit`, `can_manage_next` |
| Legacy vs new column parity | Counts matched exactly; zero drift from dual-write period |
| DB dependencies | No views, functions, triggers, or RLS policies depended on `can_manage` or `can_assign` |
| RLS policies | None on either target table |
| Existing constraints | 8 total: 4 legacy constraints, 2 interim `_next` constraints, and 2 interim `can_edit` constraints from Slice 39A |
| Row counts | `template_permissions`: 120; `user_permission_snapshots`: 13 |

First attempt note: the first migration attempt failed because `chk_can_edit_requires_view`, added in Slice 39A, still existed and conflicted with the attempted final constraint name. The transaction rolled back cleanly with zero schema change. The retry dropped all 8 existing permission constraints before re-adding the final 4 with unambiguous names.

---

## 2. SQL Applied

```sql
-- template_permissions
ALTER TABLE public.template_permissions
  DROP CONSTRAINT chk_manage_requires_view,
  DROP CONSTRAINT chk_assign_requires_manage,
  DROP CONSTRAINT chk_can_edit_requires_view,
  DROP CONSTRAINT chk_can_manage_next_requires_edit;

ALTER TABLE public.template_permissions
  DROP COLUMN can_manage,
  DROP COLUMN can_assign;

ALTER TABLE public.template_permissions
  RENAME COLUMN can_manage_next TO can_manage;

ALTER TABLE public.template_permissions
  ADD CONSTRAINT chk_tp_edit_requires_view
    CHECK (can_edit = false OR can_view = true),
  ADD CONSTRAINT chk_tp_manage_requires_edit
    CHECK (can_manage = false OR (can_view = true AND can_edit = true));

-- user_permission_snapshots
ALTER TABLE public.user_permission_snapshots
  DROP CONSTRAINT chk_snapshot_manage_requires_view,
  DROP CONSTRAINT chk_snapshot_assign_requires_manage,
  DROP CONSTRAINT chk_snapshot_can_edit_requires_view,
  DROP CONSTRAINT chk_snapshot_can_manage_next_requires_edit;

ALTER TABLE public.user_permission_snapshots
  DROP COLUMN can_manage,
  DROP COLUMN can_assign;

ALTER TABLE public.user_permission_snapshots
  RENAME COLUMN can_manage_next TO can_manage;

ALTER TABLE public.user_permission_snapshots
  ADD CONSTRAINT chk_ups_edit_requires_view
    CHECK (can_edit = false OR can_view = true),
  ADD CONSTRAINT chk_ups_manage_requires_edit
    CHECK (can_manage = false OR (can_view = true AND can_edit = true));
```

---

## 3. Verification Results

| Check | Result |
|---|---|
| Final columns | Both target tables now have exactly `can_view`, `can_edit`, `can_manage`; all boolean NOT NULL DEFAULT false |
| Final constraints | 2 constraints per table, 4 total |
| Row counts | Unchanged: `template_permissions` 120, `user_permission_snapshots` 13 |
| Value distribution | `template_permissions`: view 103 / edit 42 / manage 25; `user_permission_snapshots`: view 13 / edit 13 / manage 13 |
| Constraint violations | Zero on all 4 final constraints |

Final constraints:
- `chk_tp_edit_requires_view`
- `chk_tp_manage_requires_edit`
- `chk_ups_edit_requires_view`
- `chk_ups_manage_requires_edit`

---

## 4. Data Safety Notes

- The failed first attempt rolled back atomically; no partial state was written.
- `RENAME COLUMN` was metadata-only in Postgres and preserved data.
- Dropping legacy `can_manage` and `can_assign` was safe because their values matched the new mirror columns exactly before cleanup and no DB objects depended on them.
- All constraint drops and re-adds were covered by the migration transaction.

---

## 5. Follow-up Risks

- Repo code still writing dropped columns would fail at runtime until Slice 39D removed dual-write scaffolding.
- Snapshot rebuild logic needed to write final `can_view`, `can_edit`, and `can_manage` only after this cleanup.
- Any schema snapshot file, if present and authoritative, needed update to the final 3-column shape.

---

## 6. Repo Updates Required Next

Slice 39D must:
- Remove dual-write scaffolding from `toPermissionDbColumns`.
- Replace `can_manage_next` reads with final `can_manage` reads.
- Remove `can_assign` and `can_manage_next` compatibility from permission normalization.
- Ensure TypeScript types represent the final DB shape: `can_view`, `can_edit`, `can_manage`.
