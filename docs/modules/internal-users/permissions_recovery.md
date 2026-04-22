# Internal Users / Permissions Recovery — Smoke Test Report (R02)

**Date:** 2026-04-20  
**Branch:** dev  
**Follows:** `internal_users_permissions_recovery_audit_r01.md`

---

## Summary

After the R01 recovery (access-control.ts, access-control-server.ts, access-actions.ts, templates/page.tsx, [id]/page.tsx), a `tsc --noEmit` smoke test was run against all recovered files. This report documents the TypeScript errors found and the exact fixes applied.

All five files are now clean. No blocking errors remain in the internal-users permissions surface.

---

## Errors Found and Fixed

### 1. `src/lib/access-control-server.ts` — TS2339 (9 sites)

**Root cause:** `new Map(array.map((item) => [item.id, item]))` without explicit type parameters. TypeScript cannot infer a tuple `[K, V]` from an array literal `[item.id, item]`; it widens to `(string | T)[][]`. The Map constructor sees a non-tuple iterable and resolves to `Map<unknown, unknown>`. After a truthiness guard, `.get()` values narrow to `{}`, so property accesses (`template.key`, `row.id`, etc.) fail with TS2339.

A secondary cause: `sortPermissionRows<T extends { key: PermissionRowKey }>(rows: T[]): T[]` — without an explicit return type annotation on the callee, the inferred return type of `getAccessControlCatalog` computed `permissionRows` as `{ key: PermissionRowKey }[]` (the generic constraint bound) rather than `PermissionRowRecord[]`.

**Fixes applied:**
```typescript
// Before
const templateById = new Map(catalog.templates.map((template) => [template.id, template]))
const rowById = new Map(catalog.permissionRows.map((row) => [row.id, row]))
const rowByKey = new Map(catalog.permissionRows.map((row) => [row.key, row]))

// After
const templateById = new Map<string, PermissionTemplateRecord>(catalog.templates.map(...))
const workflowById = new Map<string, WorkflowRoleRecord>(catalog.workflowRoles.map(...))
const rowById = new Map<string, PermissionRowRecord>(catalog.permissionRows.map(...))
const rowByKey = new Map<PermissionRowKey, PermissionRowRecord>(catalog.permissionRows.map(...))

// Also: explicit annotation at declaration site
const permissionRows: PermissionRowRecord[] = sortPermissionRows(...)
```

---

### 2. `src/app/more/internal-users/access-actions.ts` — Union type leakage (4 sites)

**Root cause:** `if ('error' in result) return result` — returning the full callee result leaks the callee's success union member into the caller's inferred return type. Downstream consumers then see a union that includes unexpected shapes (e.g. `{ selectedTemplate: {} }` rather than `{ selectedTemplate: PermissionTemplateRecord | null }`).

**Pattern:** `return result` → `return { error: result.error }`

**Fixed in:** `getInternalUserAccessEditor`, `saveInternalUserAccessEditor`, `savePermissionTemplateAction`, and the `getPermissionTemplateManagerAction` path was already fixed in R01.

---

### 3. `src/app/more/internal-users/[id]/page.tsx` — TS2339 + TS7053 (6 sites)

**TS2339 at line 291** — `accessRes?.selectedTemplate?.key` typed as `{}` because:
- `if (!accessRes?.error)` is not a narrowing check — `?.error` doesn't discriminate the union
- The union type leakage from `access-actions.ts` left `selectedTemplate` typed as `{}`

**Fix:** Changed to `if (!('error' in accessRes))` and removed `?.` from all property accesses inside the block (`accessRes.templates`, `accessRes.workflowRoles`, etc.). The `'error' in` check is the established discriminant pattern for this codebase.

**TS7053 (implicit any index) — 4 sites:**

| Line | Expression | Fix |
|------|-----------|-----|
| 250 | `DEFAULT_WORKFLOWS_BY_TEMPLATE[selectedTemplateKey]` | `as PermissionTemplateKey` |
| 518 | `PERMISSION_TEMPLATE_LABELS[selectedTemplateKey]` | `as PermissionTemplateKey` |
| 570 | `APP_ROLE_LABELS[role]` | `as AppRole` |
| 737 | `PERMISSION_ROW_LABELS[row.rowKey]` | `as PermissionRowKey` |

TypeScript 5.x TS7053 fires when a `PermissionTemplateKey | ''` union is used as an index into `Record<PermissionTemplateKey, string>` even after a truthiness guard, because the narrowing does not flow into computed property access in all contexts.

**Also fixed:** `handleSaveAccess` error branch changed from `if (res?.error)` to `if ('error' in res)` with `setError(res.error ?? '')`.

---

### 4. `src/app/more/internal-users/templates/page.tsx` — TS7053 (2 sites)

Same TS7053 pattern as above — `selectedTemplateKey` and `row.rowKey` index sites. Fixed with `as PermissionTemplateKey` and `as PermissionRowKey` casts.

---

### 5. `src/app/more/internal-users/actions.ts` — TS2339 (6 sites)

**Root cause:** `const authUsers = new Map(authUsersResult.users.map((user) => [user.id, user]))` — same untyped Map constructor issue. `.get()` returned `{}`, so `authUser?.email` failed.

**Fix:** `new Map<string, { id: string; email: string | null }>(...)` and `new Map<string, any>(...)` for profiles.

---

## Patterns Established in This Recovery

| Pattern | Use case |
|---------|----------|
| `new Map<K, V>(array.map(...))` | Always add explicit type params — TypeScript cannot infer `[K, V]` tuple from array literal |
| `return { error: x.error }` | Never `return x` from an error branch — leaks success union members into caller's return type |
| `if ('error' in res)` | Discriminant narrowing for `{ error: string } \| { ...success }` unions |
| `res.error ?? ''` | After `'error' in res`, `res.error` is `string \| undefined` (discriminant adds `error?: undefined` to success members) |
| Explicit type annotation on generic return | When `sortFn<T extends Constraint>(arr: T[]): T[]` is called without explicit T, annotate the receiving variable: `const x: ConcreteType[] = sortFn(arr)` |

---

## Files Modified

| File | Commit |
|------|--------|
| `src/lib/access-control-server.ts` | d69a1e6 |
| `src/app/more/internal-users/access-actions.ts` | d69a1e6 |
| `src/app/more/internal-users/actions.ts` | d69a1e6 |
| `src/app/more/internal-users/[id]/page.tsx` | d69a1e6 |
| `src/app/more/internal-users/templates/page.tsx` | d69a1e6 |

---

## Outstanding Items

- **New DB tables required** (unchanged from R01): `permission_templates`, `workflow_roles`, `permission_rows`, `template_permissions`, `user_workflow_eligibility`, `user_permission_snapshots`, plus `internal_access.permission_template_id` column. The permissions UI will silently show empty state until these are provisioned.
- Pre-existing TS errors in unrelated files (`jobs/`, `companies/`, `FilesTab.tsx`, etc.) are out of scope for this recovery.
