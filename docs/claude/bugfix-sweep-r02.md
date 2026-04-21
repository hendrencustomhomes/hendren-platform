# Bug Fix Sweep — R02

**Date:** 2026-04-21  
**Branch:** `claude/fix-critical-bugs-EbYOs` → pushed to `origin/dev`  
**Based on:** R01 + Claude SQL analysis session

---

## Status After R01

| Issue | R01 Status |
|-------|-----------|
| Companies > New Company | Partially fixed: error now surfaces real message, but the actual insert still failed |
| Schedule > Create Schedule Item | **Fully fixed in R01** |
| Internal Users > Permissions | **Fully fixed in R01** |
| Takeoffs migration | DB-only; no code change needed |

---

## 1. Companies > New Company — Actual Root Cause (R02 Fix)

### What R01 Fixed

R01 changed `throw error` → `throw new Error(error.message)` so the real Postgres error message reached the UI. That made the failure debuggable, but did not prevent it.

### Confirmed Root Cause

The `companies` table has two name columns due to schema migration drift:

| Column | Constraint | Default |
|--------|-----------|---------|
| `name` | `NOT NULL` | none |
| `company_name` | nullable | — |

The current `Company` type (and all app code) uses `company_name`. The `createCompany` function inserted `payload` directly — which contains `company_name` but **not** the legacy `name` column. Postgres rejected every insert with a NOT NULL constraint violation on `name`. This was the real error R01 made visible.

### Fix — `src/lib/companies.ts`

Inside `createCompany`, augment the insert payload with the legacy column before sending:

```typescript
const insertPayload = { ...payload, name: payload.company_name ?? '' }
```

`payload.company_name` is always a non-empty trimmed string at this point (the page validates it before calling `createCompany`). The fallback `''` is a safety net only.

No callers change. No schema migration needed. The legacy `name` column continues to be populated as a mirror of `company_name` until a future migration removes it.

### Manual Test Steps

1. Navigate to **More > Companies > New Company**
2. Fill in company name, select at least one type
3. Click **Save Company**
4. Should redirect to the new company's detail page — no error

### Files Changed

- `src/lib/companies.ts`

---

## 2. Schedule > Create Schedule Item — Verified Clean (No R02 Changes)

R01's `useSearchParams` + Suspense fix is correctly committed. All three navigation paths into `/schedule/sub/new` were audited:

| Entry point | URL constructed | Status |
|-------------|----------------|--------|
| `/schedule?job=<id>` → "+ Labor Schedule" | `/schedule/sub/new?jobId=<id>` | ✅ correct |
| Job detail page → Schedule tab → "+ Add Sub Schedule" | `/schedule/sub/new?jobId=<jobId>` (`JobTabs.tsx:2049`) | ✅ correct |
| `/schedule` (no job selected) | `/schedule/sub/new` (no jobId) | ✅ expected — shows warning, submit disabled |

No action taken.

### Manual Test Steps

1. Open any job → Schedule tab → click **+ Add Sub Schedule**
2. Create schedule item form should load **without** the "Missing jobId" warning
3. The back button and post-save redirect should both return to the job page

---

## 3. Internal Users > Profile > Permissions — Verified Clean (No R02 Changes)

R01 fixes are committed:
- `getUserAccessModel` now returns `templatePermissions: Record<templateKey, PermissionMatrixCell[]>`
- The UI `allTemplatePermissions` state is populated on load
- The template `<select>` `onChange` calls `setPermissionMatrix(allTemplatePermissions[key])` to snap the matrix to the selected template's defaults
- `access-actions.ts` correctly propagates all errors from both `requireAdmin()` and `saveUserAccessModel()` — no silent swallowing

### Manual Test Steps

1. Open **More > Internal Users** → click any user
2. Switch to **Permissions** tab
3. Change the **Permission Template** dropdown to a different template
4. Confirm: checkboxes immediately update to reflect the new template's defaults (View, Manage, Assign per row)
5. Click **Save**
6. Reload the page
7. Confirm: the saved template is selected and the checkboxes match what was saved

---

## 4. Takeoffs — DB Migration Required (Unchanged)

No repo code change needed. The error guard in `TakeoffTab.tsx` is intentional and correct.

### Required SQL (run in Supabase SQL Editor)

```sql
ALTER TABLE takeoff_items
  ADD COLUMN IF NOT EXISTS row_kind  text CHECK (row_kind IN ('assembly', 'item')),
  ADD COLUMN IF NOT EXISTS item_kind text CHECK (item_kind IN ('scope', 'cost')),
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES takeoff_items(id) ON DELETE SET NULL;
```

After applying: refresh the Takeoff tab. The error clears automatically.

---

## Summary

| Area | Root Cause | Fixed In | Files Changed |
|------|-----------|---------|---------------|
| Companies | Legacy `name` column NOT NULL, insert missing it | **R02** | `src/lib/companies.ts` |
| Schedule sub/new | `useEffect`+`window.location.search` hydration timing | R01 | `src/app/schedule/sub/new/page.tsx` |
| Internal Users permissions | Template permission map not returned to client; dropdown didn't update matrix | R01 | `src/lib/access-control-server.ts`, `src/app/more/internal-users/[id]/page.tsx` |
| Takeoffs | Missing DB columns `row_kind`, `item_kind`, `parent_id` | **DB only** | None |
