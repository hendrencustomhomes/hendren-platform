# Bug Fix Sweep — Report R01

**Date:** 2026-04-21  
**Branch:** `claude/fix-critical-bugs-EbYOs`  
**Scope:** Four bounded bug fixes across Companies, Takeoffs, Schedule, and Internal Users.

---

## 1. Companies > New Company — "Failed to create company."

### Root Cause

`createCompany` in `src/lib/companies.ts` throws the raw Supabase `PostgrestError` object:

```typescript
if (error) throw error   // PostgrestError, not an Error instance
```

The catch block in `src/app/more/companies/new/page.tsx` uses:

```typescript
setError(e instanceof Error ? e.message : 'Failed to create company.')
```

`PostgrestError` is not a subclass of JavaScript's `Error`, so `instanceof Error` is always `false`. The actual Supabase error message (RLS violation, constraint failure, etc.) is swallowed and the generic fallback always shows instead.

### Fix

`src/lib/companies.ts` — `createCompany`:

```diff
- if (error) throw error
+ if (error) throw new Error(error.message)
```

This ensures the real error message (e.g., `"new row violates row-level security policy"`) reaches the UI via `e instanceof Error ? e.message : ...`.

### Files Changed

- `src/lib/companies.ts`

---

## 2. Takeoffs — "Takeoff structure migration is not applied yet."

### Root Cause

This is a **database migration issue, not a repo code bug.** The guard in `src/app/jobs/[id]/TakeoffTab.tsx` is intentional and correct:

```typescript
function getTakeoffSchemaErrorMessage(message?: string | null) {
  const normalized = message?.toLowerCase() ?? ''
  if (
    normalized.includes('row_kind') ||
    normalized.includes('item_kind') ||
    normalized.includes('parent_id') ||
    normalized.includes('column')
  ) {
    return 'Takeoff structure migration is not applied yet. Run the latest takeoff migration, then refresh.'
  }
  return 'Failed to save takeoff row. Please try again.'
}
```

The `refreshTakeoffItems` effect selects `row_kind, item_kind, parent_id` from `takeoff_items`. If those columns don't exist in the live DB, Postgres returns an error containing those column names, which triggers the guard message.

The code expects `takeoff_items` to have:

| Column | Type | Notes |
|--------|------|-------|
| `row_kind` | `text` (CHECK `'assembly'` OR `'item'`) | NOT NULL |
| `item_kind` | `text` (CHECK `'scope'` OR `'cost'`) | nullable |
| `parent_id` | `uuid` REFERENCES `takeoff_items(id)` | nullable |

### Required DB Action

Run the following migration in the Supabase SQL editor (or via migration tooling):

```sql
ALTER TABLE takeoff_items
  ADD COLUMN IF NOT EXISTS row_kind  text CHECK (row_kind IN ('assembly', 'item')),
  ADD COLUMN IF NOT EXISTS item_kind text CHECK (item_kind IN ('scope', 'cost')),
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES takeoff_items(id) ON DELETE SET NULL;
```

After applying, refresh the Takeoff tab — the error will clear and the workspace will load normally.

### Files Changed

None — no repo code change needed. The guard is correct; the DB schema just needs to catch up.

---

## 3. Schedule > Create Schedule Item — "Missing jobId in URL."

### Root Cause

`src/app/schedule/sub/new/page.tsx` read `jobId` via a manual `useEffect` + `window.location.search`:

```typescript
const [jobId, setJobId] = useState<string | null>(null)

useEffect(() => {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  setJobId(params.get('jobId'))
}, [])
```

On first render (and during SSR/hydration), `jobId` is `null`. The component immediately shows the warning banner and disables the submit button. In Next.js App Router, the `useEffect` fires after hydration, but for a brief window the page is in an error state. More critically, any error during hydration or navigation timing could leave `jobId` stuck at `null`.

The sibling page `src/app/schedule/order/new/page.tsx` correctly used `useSearchParams()` from `next/navigation` + a Suspense boundary, making `jobId` available synchronously on first render.

### Fix

Refactored `sub/new/page.tsx` to match the `order/new` pattern:

1. Renamed the main function to `NewSubScheduleForm` (internal).
2. Import `useSearchParams` from `next/navigation`; derive `jobId` synchronously: `const jobId = searchParams.get('jobId')`.
3. Removed the `useState<string | null>` + `useEffect` block.
4. Added a new `export default function NewSubSchedulePage` that wraps `NewSubScheduleForm` in `<Suspense fallback={null}>`.

`jobId` is now available on first render — no flash, no hydration race.

### Files Changed

- `src/app/schedule/sub/new/page.tsx`

---

## 4. Internal Users > Profile > Permissions — permissions do not reflect template

### Root Cause

Two compounding issues:

**A. Template permissions not returned to the client.**  
`getUserAccessModel` (in `src/lib/access-control-server.ts`) fetched `template_permissions` from the DB but only used it as a fallback when the user had no saved snapshots. It did not return the per-template permission map to the caller.

**B. Template dropdown change did not update the matrix.**  
In `src/app/more/internal-users/[id]/page.tsx`, changing the template `<select>` only updated `selectedTemplateKey`:

```typescript
onChange={(e) => setSelectedTemplateKey(e.target.value as PermissionTemplateKey)}
```

The `permissionMatrix` state was never touched. So the checkboxes always showed whatever the user's current snapshots said — regardless of which template was selected. If a user's snapshots were stale or from a prior template, the displayed permissions were wrong.

### Fix

**`src/lib/access-control-server.ts` — `getUserAccessModel`:**  
Added logic to build a `Record<templateKey, PermissionMatrixCell[]>` map from the already-fetched `template_permissions` data, and return it as `templatePermissions` in the result.

**`src/app/more/internal-users/[id]/page.tsx`:**  
- Added `allTemplatePermissions` state.
- In `load()`: capture `accessRes.templatePermissions` and store it.
- In the template `<select>` `onChange`: when the user picks a template key, also call `setPermissionMatrix(allTemplatePermissions[key])` to immediately snap the checkboxes to that template's defined permissions.

This means: selecting a template now sets the permission matrix to that template's defaults, which the admin can then adjust before saving.

### Files Changed

- `src/lib/access-control-server.ts`
- `src/app/more/internal-users/[id]/page.tsx`

---

## Summary Table

| Area | Root Cause | Fix Type | Files Changed |
|------|-----------|----------|---------------|
| Companies > New Company | `PostgrestError` not `instanceof Error`; catch swallowed real message | Code fix | `src/lib/companies.ts` |
| Takeoffs | DB missing `row_kind`, `item_kind`, `parent_id` columns on `takeoff_items` | **DB migration required** (see SQL above) | None |
| Schedule > New Sub Item | `useEffect` + `window.location.search` → `null` on first render | Code fix | `src/app/schedule/sub/new/page.tsx` |
| Internal Users Permissions | Template permissions not sent to client; dropdown didn't update matrix | Code fix | `src/lib/access-control-server.ts`, `src/app/more/internal-users/[id]/page.tsx` |

## Required Separate DB Action

**Takeoffs only:** Apply the `ALTER TABLE` migration shown in §2 above against the live Supabase database. No code changes are needed for this issue — the error guard in `TakeoffTab.tsx` is correct and will clear automatically once the columns exist.
