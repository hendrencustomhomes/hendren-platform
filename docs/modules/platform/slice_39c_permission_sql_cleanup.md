# Slice 39C — Permission SQL Cleanup

**Status:** Complete  
**Date:** 2026-05-05  
**Branch:** dev

---

## 1. What Changed

DB-side SQL rename executed directly in Supabase. No migration file — applied as a one-time DDL operation.

### Column changes on `user_permission_snapshots` and `template_permissions`

| Action | Column |
|---|---|
| Dropped | `can_assign` (legacy manage-level) |
| Dropped | `can_manage_next` (transition manage-level) |
| Renamed | `can_manage` → `can_edit` (edit-level, was kept dual-write in 39B) |

### Final column state (both tables)

| Column | Level |
|---|---|
| `can_view` | view |
| `can_edit` | edit |
| `can_manage` | manage (final) |

---

## 2. Out of Scope

- No application code changed in this slice
- No RLS policies updated (handled in 39D repo cleanup)
- `can_manage_next` rename to `can_manage` was the key outcome

---

## 3. Follow-up

Repo-side cleanup (removing stale field references and updating write/read sites) is covered in Slice 39D.
