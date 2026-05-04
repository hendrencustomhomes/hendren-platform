# Slice 24 — Estimate Permission Enforcement (view/manage)

**Status:** Complete  
**Date:** 2026-05-04  
**Branch:** dev

---

## What Changed

### 1. `src/lib/access-control-server.ts`

Added `requireModuleAccess(profileId, rowKey, level)` — a reusable server-side guard used by any server action that needs row-level permission enforcement.

**Behavior:**
1. Looks up the user's `internal_access` record (admin client, bypasses RLS).
2. If `is_admin = true` → returns `null` immediately (admin bypass).
3. If user is not active → returns `{ error: 'Internal user access required' }`.
4. Resolves the `permission_rows.id` for the given `rowKey`.
5. Checks `user_permission_snapshots` for the user + row.
6. If no snapshot exists, falls back to `template_permissions` for the user's assigned template (consistent with the existing `pricing-access-actions.ts` pattern).
7. If neither snapshot nor template record exists → permission denied.
8. Applies `normalizePermissionState` and checks the requested level (`view` or `manage`).
9. Returns `null` (granted) or `{ error: string }` (denied).

**Return contract:** `Promise<{ error: string } | null>` — callers do `if (guard) return guard` to short-circuit.

---

### 2. `src/app/actions/estimate-actions.ts`

Added `requireModuleAccess` import and permission guards to every exported action:

| Action | Level |
|---|---|
| `getEstimatesForJob` | `view` |
| `createEstimate` | `manage` |
| `setActiveEstimate` | `manage` |
| `archiveEstimate` | `manage` |
| `duplicateEstimate` | `manage` |
| `importEstimate` | `manage` |
| `renameEstimate` | `manage` |

Guard is placed immediately after `requireUser()`, before any DB work.

---

### 3. `src/app/actions/worksheet-item-actions.ts`

Added `requireModuleAccess` import and `manage` permission guard to every exported mutation:

| Action | Guard position |
|---|---|
| `persistWorksheetRow` | After `requireUser()`, before `requireEditableEstimate()` |
| `createWorksheetRow` | After `requireUser()`, before `requireEditableEstimate()` |
| `restoreWorksheetRows` | After `requireUser()`, before `requireEditableEstimate()` |
| `deleteWorksheetRow` | After `requireUser()`, before `requireEditableEstimate()` |
| `persistWorksheetSortOrders` | After `requireUser()`, before `requireEditableEstimate()` |

The existing `requireEditableEstimate()` guard is left in place and unchanged — it enforces estimate lock/status, which is a separate concern from permission level.

---

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass — no errors |

---

## Design Decisions

**One source of truth:** `requireModuleAccess` lives in `access-control-server.ts`, which is the existing owner of server-side permission logic. No parallel system created.

**Admin bypass:** `is_admin` from `internal_access` short-circuits all permission row checks. This is consistent with how admin is handled throughout the access control model.

**Template fallback:** When no `user_permission_snapshots` row exists for a user+row combination, the function falls back to `template_permissions`. This matches `pricing-access-actions.ts` behavior and avoids locking out users who have template assignments but no personal overrides. Users with no access record at all are denied.

**Guard order in worksheet actions:** Permission check (`manage`) runs before estimate-editability check. This is intentional — permission is a more fundamental gate than estimate state.

---

## Risks / Follow-up

1. **Latency:** Each guarded action now makes 3–4 additional admin-client DB queries (internal_access, permission_rows, user_permission_snapshots, optionally template_permissions). For the worksheet autosave path (high frequency), this adds overhead. A future optimization could batch or cache the permission lookup per session.

2. **`document-actions.ts` not guarded:** `sendProposal` and snapshot actions are out of scope for this slice per the task spec. A follow-up slice should apply appropriate guards there.

3. **`assign` permission not used:** Per the task spec, `assign` is not enforced here. The module_structure doc clarifies that `assign` is workflow assignment authority only, not a prerequisite for the actions in this slice.

4. **`pricing-access-actions.ts` does not check `is_admin`:** The existing pricing helper lacks the admin bypass that `requireModuleAccess` adds. This inconsistency should be addressed in a future hardening pass.

---

## Intentionally Not Changed

- RLS policies — not modified
- Database schema — not modified  
- UI components — not modified
- `document-actions.ts` / `sendProposal` — out of scope per task spec
- `isEstimateEditable()` checks in `worksheet-item-actions.ts` — left unchanged
- `pricing-access-actions.ts` — not modified (out of scope)
- `assign` permission — not enforced (per spec)
