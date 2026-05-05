# Slice 38 — Pricing Permission Alignment

**Status:** Completed
**Date:** 2026-05-05
**Branch:** dev
**File:** `src/app/actions/pricing-access-actions.ts`

---

## 1. Context

`current.md` listed as a known gap:

> `pricing-access-actions.ts` does not use `requireModuleAccess` and does not check
> `is_admin`; inconsistency with estimate/proposal paths.

---

## 2. Stop Condition Evaluation

| Condition | Result |
|---|---|
| Pricing module uses fundamentally different permission semantics | **Clear** — same DB tables (`internal_access`, `user_permission_snapshots`, `template_permissions`), same `normalizePermissionState` logic |
| Required access levels unclear | **Clear** — view → `canView`, edit → `canManage`, manage → `canAssign` |
| Alignment would break expected behavior | **Clear** — return shape `{canView, canManage, canAssign, error?}` preserved; all caller access patterns verified |

---

## 3. Audit Findings

### `getCurrentPricingAccess` (before)

- Used `createAdminClient` directly and re-implemented permission resolution inline.
- Selected `permission_template_id, is_active` from `internal_access` — **missing `is_admin`**.
- Admins received the same row-level permission check as regular users instead of a bypass.
- Duplicated snapshot + template fallback logic already present in `requireModuleAccess`.

### Callers in `worksheet-pricing-actions.ts`

| Call site | Access checked | Pattern |
|---|---|---|
| `getAvailablePricingHeaders` | `canView` on both pricing_sources + bids | `!access.error && access.canView` |
| `getAvailablePricingRows` | `canView` on header kind | `access.error \|\| !access.canView` |
| `linkRowToPricing` | `canManage` on header kind | `access.error \|\| !access.canManage` |
| `unlinkRowFromPricing` | — (no pricing permission check) | n/a |

All caller access patterns are compatible with the new return shape.

Note: `unlinkRowFromPricing` has no pricing permission check — only `isEstimateEditable`. This pre-existing gap is out of scope for this slice.

---

## 4. Change

Rewrote `getCurrentPricingAccess` to delegate all permission resolution to `requireModuleAccess`:

```typescript
const [viewResult, editResult, manageResult] = await Promise.all([
  requireModuleAccess(user.id, rowKey, 'view'),
  requireModuleAccess(user.id, rowKey, 'edit'),
  requireModuleAccess(user.id, rowKey, 'manage'),
])

return {
  canView: viewResult === null,
  canManage: editResult === null,
  canAssign: manageResult === null,
  ...(viewResult !== null && { error: viewResult.error }),
}
```

**What this gains:**
- Admin bypass (`is_admin = true`) is now handled by `requireModuleAccess` — admins get full access without a row-level lookup.
- Snapshot resolution and template fallback are handled identically to all other modules.
- Duplicated resolution logic removed from this file entirely.

**Error propagation rule:**
- Only the `view` result's error is propagated. A user who can view but not manage gets `canManage = false` with no `error` field — which matches the original behavior (callers check `access.error || !access.canManage`).
- Fundamental failures (inactive user, DB error) surface through the view check, which is always run.

**Imports removed:** `createAdminClient`, `normalizePermissionState`

**Imports added:** `requireModuleAccess` from `@/lib/access-control-server`

Return type `PricingAccessResult` and `SupportedPricingPermissionRowKey` are unchanged.

---

## 5. Files Changed

| File | Change |
|---|---|
| `src/app/actions/pricing-access-actions.ts` | Full rewrite — delegates to `requireModuleAccess` |
| `docs/modules/pricing/slice_38_pricing_permission_alignment.md` | This report |

---

## 6. Validation

- TypeScript: `npx tsc --noEmit` — no errors
- All caller access patterns verified compatible with return shape
- Admin bypass now active via `requireModuleAccess`
- No behavioral regression for non-admin users

---

## 7. Risks / Follow-up

**`unlinkRowFromPricing` has no pricing permission check** — only checks `isEstimateEditable`. This pre-existing gap was identified during audit. Fixing it is a separate slice: it would require adding a `getCurrentPricingAccess` call (or a `requireModuleAccess` guard) to `worksheet-pricing-actions.ts`.

**Three parallel DB calls vs one** — `requireModuleAccess` runs 2–4 queries each; three parallel calls are 3× the individual query count. In practice they run concurrently and the wall-clock difference is minimal. If this becomes a concern, a dedicated `getPermissionState(profileId, rowKey)` helper could be added to `access-control-server.ts` to return all three levels in a single resolution chain.

---

## 8. Intentionally Not Changed

- `worksheet-pricing-actions.ts` — caller access patterns unchanged; `unlinkRowFromPricing` permission gap deferred
- `PricingAccessResult` type shape — unchanged; all callers compatible
- `SupportedPricingPermissionRowKey` type — unchanged
- DB schema — no changes
- UI components — no changes
