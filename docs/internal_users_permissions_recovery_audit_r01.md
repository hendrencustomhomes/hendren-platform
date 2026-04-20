# Internal Users / Permissions Stack — Recovery Audit R01

**Audit date:** 2026-04-20  
**Auditor:** Claude (automated, read-only)  
**Branch audited:** `backup/internal-users-permissions-fail-stack-20260419`  
**Baseline commit:** `4707e5c` — Internal users: separate archive restore from active state  
**Current dev tip:** `5de8750` — Merge dev into main (origin/main)  

---

## Audit Summary

The fail-stack branch carries 13 commits on top of the baseline. It contains a
full internal-users CRUD implementation, a multi-level permission template system,
a per-user permission matrix editor, and a template manager page. The stack was
abandoned before it could be merged; `origin/main` was left with a placeholder
`page.tsx` and a standalone `permissions.ts` fix that was cherry-picked back
separately.

Two TypeScript compiler errors were present during development:

| Error | Introduced | Fixed in stack |
|---|---|---|
| `Expected '</', got '}'` — missing `}` closing JSX expression in map | `3328733` | **Yes — fixed in `77448fd`** |
| `Argument of type 'string' is not assignable to 'InternalUsersView \| undefined'` — type widening on `effectiveStatuses` | `3328733` | **No — survives at tip** |

The JSX error is gone at the tip. One TS error remains and blocks a clean build.
It is a trivial one-line fix (add explicit type annotation).

A second structural hazard discovered during the audit: the merge commit
`5de8750` silently dropped `actions.ts` and `[id]/page.tsx` from the codebase.
Those files are present in the baseline ancestry of `origin/main` but not in
its current working tree. Any recovery must restore them.

---

## Commit Inventory

All 13 commits after baseline, oldest to newest:

| # | Hash | Message | Files touched | Notes |
|---|---|---|---|---|
| 1 | `3328733` | Internal users: add filter dropdowns for status and role | `page.tsx` | Introduces both TS errors |
| 2 | `a306cf8` | Internal users: refine profile header and archive state actions | `[id]/page.tsx` | Applied on pre-existing file |
| 3 | `ba04627` | Permissions: add sales and operations role support without changing live auth model | `permissions.ts` | **Identical to `3dc0db5` already on main** |
| 4 | `4ffc028` | Permissions: add V1 access control constants and helpers | `access-control.ts` | New file |
| 5 | `bde6393` | Permissions: add server helpers for templates workflows and user snapshots | `access-control-server.ts` | New file |
| 6 | `a878149` | Internal users: add dedicated permission template and access actions | `access-actions.ts` | New file |
| 7 | `1a6bf65` | Internal users: add permissions tab with template workflow and matrix editor | `[id]/page.tsx` | Major addition to existing file |
| 8 | `d343387` | Internal users: add permission template manager page | `templates/page.tsx` | New file |
| 9 | `3fca1db` | Internal users: return plain template permission maps to client | `access-actions.ts` | Fixup |
| 10 | `e68e71e` | Internal users: fix template manager data shape and typing | `templates/page.tsx` | Fixup |
| 11 | `ae061a2` | Internal users: avoid fake workflow defaults when no template is selected | `access-actions.ts` | Fixup |
| 12 | `4f72bbb` | Internal users: show live template and workflow summaries on profile tab | `[id]/page.tsx` | Appends summary UI |
| 13 | `77448fd` | Internal users: add template manager entry point on list page | `page.tsx` | Fixes JSX bug; adds Templates link |

---

## File-Level Risk Review

### `src/lib/permissions.ts`

**Status in dev/main:** Present, identical content to fail-stack tip.  
Commit `3dc0db5` on main applied the same operations/sales additions as commit
`ba04627` on the fail-stack. Both diffs are byte-for-byte identical.  
**Classification: Not worth recovering — already applied.**

---

### `src/lib/access-control.ts` (211 lines)

**Status in dev/main:** Does not exist.  
New file introduced in `4ffc028`. Contains only pure TypeScript: constants,
discriminated union types, and small utility functions. No Supabase calls, no
React imports, no side effects. Zero conflict risk.  
One structural note: `PERMISSION_TEMPLATE_KEYS` includes `accountant` and
`media` which are not present in `APP_ROLES` in `permissions.ts`. The two
permission systems are parallel and will drift if not kept in sync explicitly.  
**Classification: Safe to cherry-pick.**

---

### `src/lib/access-control-server.ts` (339 lines)

**Status in dev/main:** Does not exist.  
New file introduced in `bde6393`. Reads from six DB tables via the Supabase
admin client:

| Table | Purpose |
|---|---|
| `permission_templates` | Catalog of named templates (admin, ops, estimator, …) |
| `workflow_roles` | Catalog of workflow role slots |
| `permission_rows` | Catalog of module rows (jobs, takeoffs, schedule, …) |
| `template_permissions` | Matrix of template × row × (view/manage/assign) |
| `user_workflow_eligibility` | Per-user workflow role assignments |
| `user_permission_snapshots` | Per-user override permission matrix |

**None of these tables exist in the current codebase.** No migrations were
found under `supabase/migrations/` (the migration system was removed in commit
`26718b9`). The code will compile but every server action that calls into this
module will error at runtime until the tables are created in Supabase.

Code quality is high: no any-type leakage in returns, defensive null guards,
correct use of `.maybeSingle()`. Safe to add now as code; blocked at runtime
until DB is ready.  
**Classification: Safe to cherry-pick (code). Blocked on DB migrations.**

---

### `src/app/more/internal-users/actions.ts` (389 lines)

**Status in dev/main:** Does not exist in current tree.  
This file existed at the baseline commit `4707e5c` and was in the ancestry of
`origin/main`. It was silently dropped when the merge commit `5de8750` resolved
the merge by keeping only the `fbecda1` parent's version of the
`internal-users/` directory, which did not include `actions.ts`.

The fail-stack's tip version is the evolved form from baseline through 2
additional commits (`a306cf8` for archive state, `3328733` for view parameter).
The file imports only from `@/lib/permissions` (already in main) and
`@/utils/supabase/{admin,server}` (already in main).

No known errors. Logic is complete: `getInternalUsers`, `getInternalUser`,
`createInternalUser`, `updateInternalUser`, `deactivateInternalUser`,
`activateInternalUser`, `archiveInternalUser`, `restoreInternalUser`,
`resendResetEmail`, `generateResetLink`.  
**Classification: Safe to copy directly from fail-stack tip.**  
(Cannot cherry-pick individual commits cleanly because each commit was a diff
against a file no longer in the main tree.)

---

### `src/app/more/internal-users/access-actions.ts` (102 lines)

**Status in dev/main:** Does not exist.  
New file added in `a878149`, refined across commits `3fca1db` and `ae061a2`.
Depends on `access-control.ts` and `access-control-server.ts`. The file is a
thin server-action wrapper: admin check, delegate to server helper, revalidate
path. No known errors at tip.  
**Classification: Safe to cherry-pick (or copy from tip). Requires both
`access-control.ts` and `access-control-server.ts` to be present first.**

---

### `src/app/more/internal-users/[id]/page.tsx` (764 lines)

**Status in dev/main:** Does not exist in current tree.  
Same drop-by-merge situation as `actions.ts`. The baseline version existed but
was lost in `5de8750`. The fail-stack evolved this file across four commits
(`a306cf8`, `1a6bf65`, `4f72bbb`). The tip version adds a full Permissions
tab with template selector, workflow role checkboxes, and a 13-module permission
matrix.

Imports: `actions.ts`, `access-actions.ts`, `access-control.ts`,
`permissions.ts` — all recoverable. No known errors at tip.

Cannot cherry-pick individual commits cleanly (each was a diff against a
continuously-moving file not in main tree).  
**Classification: Safe to copy directly from fail-stack tip.**

---

### `src/app/more/internal-users/page.tsx` (485 lines at tip vs 107 lines placeholder in main)

**Status in dev/main:** Placeholder present — static page listing rules,
fields, and legacy notes. No live data, no state, no imports from `actions`.

The fail-stack version is a full client component: status and role filter
dropdowns with outside-click handling, multi-view loading, user list with
badge rendering, add-user form, and a Templates link.

**Outstanding TS error at tip (not fixed):**

```typescript
// src/app/more/internal-users/page.tsx ~line 212
async function loadUsers(statuses: InternalUsersView[]) {
  setListLoading(true)
  const effectiveStatuses = statuses.length > 0 ? statuses : ['active']
  //    ^^^^^^^^^^^^^^^^^ inferred as string[] — widens the union
  const uniqueStatuses = Array.from(new Set(effectiveStatuses))
  const results = await Promise.all(uniqueStatuses.map((view) => getInternalUsers(view)))
  //                                                              ^^^^^^^^^^^^^^^^
  //  Error: Argument of type 'string' is not assignable to
  //         parameter of type 'InternalUsersView | undefined'
```

Fix is one character: add explicit type annotation:
```typescript
const effectiveStatuses: InternalUsersView[] = statuses.length > 0 ? statuses : ['active']
```

Because the main placeholder and the fail-stack full implementation are
structurally unrelated, a cherry-pick of any individual commit will conflict.
The cleanest recovery is to replace the placeholder wholesale with the tip file
content and apply the type fix inline.  
**Classification: Manual rebuild — replace placeholder with tip file, apply
type fix before merging.**

---

### `src/app/more/internal-users/templates/page.tsx` (241 lines)

**Status in dev/main:** Does not exist.  
New file added in `d343387`, refined in `e68e71e`. Standalone page: template
selector tabs, permission matrix grid (view/manage/assign checkboxes per
module), save action. Imports only from `access-control.ts` and
`access-actions.ts`. No known errors at tip.  
**Classification: Safe to cherry-pick (or copy from tip).**

---

## Recommended Recovery Plan

Perform recovery as a single clean commit on dev (not a cherry-pick train).
The individual commits cannot be replayed cleanly against the current main tree
because three files were dropped by the merge and two files received conflicting
edits.

**Phase 1 — Code recovery (no DB changes needed to merge):**

1. Add `src/lib/access-control.ts` — copy from fail-stack tip verbatim.
2. Add `src/lib/access-control-server.ts` — copy from fail-stack tip verbatim.
3. Add `src/app/more/internal-users/actions.ts` — copy from fail-stack tip verbatim.
4. Add `src/app/more/internal-users/access-actions.ts` — copy from fail-stack tip verbatim.
5. Add `src/app/more/internal-users/[id]/page.tsx` — copy from fail-stack tip verbatim.
6. Add `src/app/more/internal-users/templates/page.tsx` — copy from fail-stack tip verbatim.
7. Replace `src/app/more/internal-users/page.tsx` — copy from fail-stack tip, then apply the `effectiveStatuses` type fix (one line, see above).
8. Skip `permissions.ts` — already identical in main.

**Phase 2 — DB migrations (required before the permission template system works):**

Create migrations (or seed data) for:
- `permission_templates` (catalog rows for each template key)
- `workflow_roles` (catalog rows for each workflow role key)
- `permission_rows` (catalog rows for each module row key)
- `template_permissions` (default matrix values per template)
- `user_workflow_eligibility` (per-user, starts empty)
- `user_permission_snapshots` (per-user, starts empty)

Also add `permission_template_id` column to `internal_access` table (referenced
in `access-control-server.ts` → `getUserAccessModel`).

The Phase 1 code is safe to land on dev without Phase 2 complete. The
permission tab in `[id]/page.tsx` will render a loading state and surface a
Supabase "relation does not exist" error until Phase 2 lands. The user list
page and user profile (non-permissions tabs) will continue to work.

---

## Cherry-Pick Candidate List

These commits introduce new files only and have no conflicts with the current
main tree. If a commit-by-commit approach is preferred over the single-commit
plan above, these can be applied in order:

| Commit | File | Safe to cherry-pick? | Prerequisite |
|---|---|---|---|
| `4ffc028` | `access-control.ts` | Yes | None |
| `bde6393` | `access-control-server.ts` | Yes | `4ffc028` |
| `a878149` | `access-actions.ts` (initial) | Yes | `4ffc028`, `bde6393` |
| `d343387` | `templates/page.tsx` (initial) | Yes | `a878149` |
| `3fca1db` | `access-actions.ts` fixup | Yes | `a878149` |
| `e68e71e` | `templates/page.tsx` fixup | Yes | `d343387` |
| `ae061a2` | `access-actions.ts` fixup | Yes | `3fca1db` |

---

## Manual Rebuild Candidate List

These cannot be cleanly cherry-picked. Take the file content from the fail-stack
tip and add manually, applying fixes as noted:

| File | Reason | Required fix |
|---|---|---|
| `src/app/more/internal-users/page.tsx` | Main has unrelated placeholder; cherry-pick would conflict | Add type annotation to `effectiveStatuses` |
| `src/app/more/internal-users/[id]/page.tsx` | Dropped from main by merge; 4 commits would not replay cleanly | None — tip is correct |
| `src/app/more/internal-users/actions.ts` | Dropped from main by merge; commits would not replay cleanly | None — tip is correct |

---

## Red Flags

1. **Outstanding TS error at tip.** The `effectiveStatuses` widening in
   `page.tsx` means the stack does not compile clean at its tip. Must be fixed
   before any merge or deploy.

2. **Six new DB tables with no migrations.** `access-control-server.ts` reads
   from `permission_templates`, `workflow_roles`, `permission_rows`,
   `template_permissions`, `user_workflow_eligibility`, and
   `user_permission_snapshots`. None exist in the current schema. The migration
   system was removed (`26718b9`). Tables must be created manually in Supabase
   Studio or via a re-established migration.

3. **Two parallel permission systems.** `permissions.ts` defines `APP_ROLES`
   (7 roles, no `accountant` or `media`). `access-control.ts` defines
   `PERMISSION_TEMPLATE_KEYS` (8 keys, including `accountant` and `media` not
   in `APP_ROLES`). The `deriveLegacyRoleState` helper bridges them for writes
   back to `internal_access.role`, but a role recorded as `accountant` in a
   template snapshot has no mapping in the live role system. This inconsistency
   should be resolved before shipping the permission template feature.

4. **Merge `5de8750` silently deleted working files.** `actions.ts` and
   `[id]/page.tsx` existed in the baseline ancestry of `origin/main` but were
   dropped when the merge resolved the `internal-users/` directory to the
   `fbecda1` parent's version. Anyone working from `origin/main` today does not
   have these files and may not know they existed. The placeholder `page.tsx` on
   main is a different file entirely, not a degraded version of the baseline.

5. **`ba04627` must NOT be cherry-picked.** It is byte-for-byte identical to
   `3dc0db5` which is already in `origin/main`. Applying it again would be a
   no-op at best or a conflict at worst.

6. **`permission_template_id` column.** `access-control-server.ts` queries
   `internal_access.permission_template_id` in `getUserAccessModel`. This
   column does not appear in any known migration or in the `getInternalUser`
   query in `actions.ts` (which only selects `role`, `is_active`, `is_admin`,
   `archived_at`, `archived_by`). The column must be added to `internal_access`
   as part of the DB phase.

---

## Bottom-Line Recommendation

**Do not cherry-pick the 13 commits individually.** The commit train cannot
replay against the current main tree without conflicts on three files.

**Preferred path:** one clean manual-recovery commit on dev that:
- Restores `actions.ts` and `[id]/page.tsx` from the fail-stack tip
- Adds `access-control.ts`, `access-control-server.ts`, `access-actions.ts`,
  and `templates/page.tsx` from the fail-stack tip
- Replaces the `page.tsx` placeholder with the fail-stack tip version and
  applies the `effectiveStatuses: InternalUsersView[]` type fix
- Skips `permissions.ts` (already identical in main)

**The type fix is mandatory and must be part of the same commit.** The stack
does not build clean without it.

**Block on DB migrations before the permission template feature is testable.**
Phase 1 (code) can land safely; the permission tab will surface a runtime error
until Phase 2 (6 new tables + `permission_template_id` column) is complete.

Estimated effort: Phase 1 is mechanical — copy files, apply one-line fix, commit.
Phase 2 requires schema design review before execution.
