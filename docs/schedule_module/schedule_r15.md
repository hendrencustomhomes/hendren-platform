# Schedule Module — R15 Deliverables

**Date:** 2026-04-11
**Branch:** `dev`
**Files changed:**
- `src/app/schedule/actions.ts` (new)
- `src/app/schedule/ScheduleEditClient.tsx` (new)
- `src/app/schedule/page.tsx` (modified)

---

## A. Summary of Changes

R15 builds the first UI/state architecture skeleton for Schedule Edit Mode on `/schedule`. No full dependency editor is introduced. No new DB writes are added beyond what already exists in the pipeline.

### New: `src/app/schedule/actions.ts`

Server action file with `'use server'` directive. Exposes:

- `DraftScheduleItemUpdate` — shape of a single item's draft field changes
- `SaveDraftActionResult` — `{ ok: boolean; error?: string }`
- `saveScheduleDraftAction(jobId, updates)` — writes draft fields to `sub_schedule` (serial loop), then calls `runScheduleApplyPipeline`, then `revalidatePath('/schedule')`

### New: `src/app/schedule/ScheduleEditClient.tsx`

`'use client'` component. Receives pre-fetched data from the server component and owns all edit-mode state. See Section B for full props/state contract.

### Modified: `src/app/schedule/page.tsx`

- Removed `getResolvedScheduleGraph` and `ScheduleNode` imports
- Removed `resolvedHint` function (now lives in `ScheduleEditClient`)
- Added `getScheduleDependencies` import from `@/lib/db`
- Added `ScheduleEditClient` import
- Replaced the `resolvedNodes` block with a `dependencies` fetch (single `getScheduleDependencies` call, graceful `.catch(() => [])`)
- When `jobFilter` is set: renders `<ScheduleEditClient>` instead of both table sections
- When no `jobFilter`: renders existing read-only tables (unchanged logic, resolved hints removed since they only applied in the job-filter case)

---

## B. `ScheduleEditClient` Props and State Contract

### Props

```typescript
type Props = {
  jobId: string
  jobClientName: string | null   // sourced from first schedule or procurement item's jobs join
  jobColor: string | null        // sourced from same
  scheduleItems: JobSubSchedule[]
  procurementItems: ProcurementItem[]
  dependencies: ScheduleItemDependency[]
}
```

### State

| Variable | Type | Purpose |
|---|---|---|
| `editMode` | `boolean` | Whether edit controls are active |
| `draftOverrides` | `Record<string, ScheduleDraftOverride>` | Keyed by item.id; only changed items present |
| `saveError` | `string \| null` | Last save error message |
| `isPending` | `boolean` | From `useTransition`; true while server action is running |

### `ScheduleDraftOverride` shape

```typescript
type ScheduleDraftOverride = {
  start_date: string | null
  duration_working_days: number | null
  include_saturday: boolean
  include_sunday: boolean
  buffer_working_days: number
}
```

### `isDirty`

```typescript
const isDirty = Object.keys(draftOverrides).length > 0
```

---

## C. Computed Values (useMemo)

### `effectiveScheduleItems`

```
scheduleItems.map(item => draftOverrides[item.id] ? { ...item, ...override } : item)
```

Depends on: `scheduleItems`, `draftOverrides`.

### `previewNodes`

```
buildScheduleNodes({ subSchedule: effectiveScheduleItems, procurementItems })
  → resolveScheduleGraph({ nodes, dependencies })
```

Wrapped in `try/catch` — cycle detection throws; fallback returns the unresolved `buildScheduleNodes` output so the UI does not crash.

Depends on: `effectiveScheduleItems`, `procurementItems`, `dependencies`.

### `confirmedShiftCount`

```
scheduleItems.filter(item =>
  item.status === 'confirmed' &&
  previewNodes[`schedule:${item.id}`]?.start_date !== item.start_date
).length
```

Counts confirmed labor items whose preview start differs from their stored start. Drives the "N confirmed shifts — call tasks will be created" warning in the toolbar.

---

## D. Edit Mode Toolbar Behavior

| Condition | Rendered |
|---|---|
| `!editMode` | "Edit Schedule" button only |
| `editMode && !isDirty` | Status text ("no changes yet"), Cancel, Save (disabled) |
| `editMode && isDirty` | Status text ("N items changed"), Cancel, Save (active) |
| `editMode && confirmedShiftCount > 0` | Orange pill: "N confirmed shifts — call tasks will be created" |
| `isPending` | Save shows "Saving…"; both buttons disabled/styled |

---

## E. Edit Controls (Labor Schedule Only)

In edit mode, the **Start** cell replaces the date display with:
1. `<input type="date">` — updates `start_date` override
2. `<input type="number" min=1>` — updates `duration_working_days` override
3. Two checkboxes (Sat / Sun) — update `include_saturday` / `include_sunday` overrides

The **End** cell in edit mode shows the preview end date (`previewNode.end_date`) with a "preview" label beneath it. The end date is read-only — it is computed by the engine from start + duration.

Procurement items have no edit controls in R15. Their "Need By" cell still shows the resolved hint (`previewNode.start_date` vs `required_on_site_date`) in both modes.

---

## F. Save Flow

```
handleSave()
  → build updates[] from draftOverrides (only changed items)
  → if updates.length === 0: setEditMode(false), return
  → startTransition(async () => {
      result = await saveScheduleDraftAction(jobId, updates)
      if ok:  setDraftOverrides({}), setEditMode(false)
      if !ok: setSaveError(result.error)
    })
```

`useTransition` keeps the UI responsive during the async server action. `isPending` gates the Save/Cancel buttons.

---

## G. `setOverrideField` Helper

```typescript
function setOverrideField<K extends keyof ScheduleDraftOverride>(
  itemId: string, field: K, value: ScheduleDraftOverride[K]
)
```

When called for a new item, seeds the full override from the original item's current values so that changing one field does not reset the others to defaults.

---

## H. Page Changes — Data Flow

```
page.tsx (server)
  ├── fetch sub_schedule for jobFilter
  ├── fetch procurement_items for jobFilter
  ├── fetch schedule_item_dependencies for jobFilter   ← NEW (replaces getResolvedScheduleGraph)
  └── render <ScheduleEditClient
        jobId scheduleItems procurementItems dependencies
        jobClientName={first item's jobs.client_name}
        jobColor={first item's jobs.color}
      />
```

No-filter path: same tables as before, minus resolved hints (which were only shown when `jobFilter` was set).

---

## I. Assumptions Made

1. **`page.tsx` server component passes `JobSubSchedule[]` (not `ScheduleRow[]`) to `ScheduleEditClient`.** The `scheduleList` variable in page.tsx is `ScheduleRow[]` (`JobSubSchedule & { jobs?: JobRef | null }`). TypeScript accepts this because `ScheduleRow` is a structural superset of `JobSubSchedule`. The `jobs` field is never accessed inside `ScheduleEditClient`; job-level display uses the separate `jobClientName`/`jobColor` props.

2. **`jobClientName` and `jobColor` are sourced from the first available item.** The page uses `scheduleList[0]?.jobs?.client_name ?? procurementList[0]?.jobs?.client_name ?? null`. When both lists are empty, both props are `null` and the client component renders `'—'` and a grey dot.

3. **`getScheduleDependencies` can throw.** The fetch is wrapped in `.catch(() => [])` in `page.tsx`. A dependency fetch error causes the component to render with an empty dependency array — the engine resolves each node independently (no propagation), which is the same behavior as a job with no dependencies.

4. **`buildScheduleNodes` and `resolveScheduleGraph` are safe to import in a `'use client'` component.** Both files (`nodes.ts`, `engine.ts`) use only `import type` for all DB-level dependencies. No server-only code (`createClient`, `getJobWithDetails`, etc.) is bundled into the client.

5. **Cycle detection in the live preview is silent.** If the user introduces a dependency cycle through edit (impossible in R15 since no dependency editing exists, but for future safety), `resolveScheduleGraph` throws. The `try/catch` in `previewNodes` falls back to the unresolved node map. The toolbar and table continue to render.

6. **Procurement items are not editable in R15.** The `DraftScheduleItemUpdate` type maps to `sub_schedule` fields only. Procurement dates are driven by the engine from labor dependencies or set manually via the existing edit form. Adding procurement edit controls is deferred.

7. **`revalidatePath('/schedule')` in the server action invalidates the entire schedule page cache.** After a successful save, Next.js re-fetches the page data. Because the client component receives fresh props, `draftOverrides` is cleared and the view reflects the newly persisted values.

---

## J. TypeScript Errors Encountered

All errors are pre-existing environment errors from missing `node_modules`.

**`src/app/schedule/actions.ts`:**
```
error TS2307: Cannot find module 'next/cache' or its corresponding type declarations.
```
Same root cause as all other files importing from `next/*`. No new errors introduced.

**`src/app/schedule/ScheduleEditClient.tsx`:**
```
src/app/schedule/ScheduleEditClient.tsx(3,50): error TS2307: Cannot find module 'react'
src/app/schedule/ScheduleEditClient.tsx(4,18): error TS2307: Cannot find module 'next/link'
```
JSX element errors and `Parameter 'prev' implicitly has an 'any' type` at line 189 cascade from the missing `react` types — `React.Dispatch` cannot be resolved so the `setDraftOverrides` updater parameter loses its type. Identical pattern across all client components in the codebase (`JobTabs.tsx`, etc.). No new errors introduced.

**`src/app/schedule/page.tsx`:**
Pre-existing `next/link` and `next/navigation` import errors, unchanged from before R15. No new errors introduced by the R15 edits.

---

## K. Edge Cases Intentionally Deferred

1. **Optimistic UI.** The current save flow uses `useTransition` but does not update the displayed dates optimistically while the server action runs. The table shows the draft values until save completes (because `effectiveScheduleItems` still merges overrides), then shows the server-refreshed values. No rollback UI is needed because `revalidatePath` replaces the data on success.

2. **Per-field reset.** There is no "reset this row" button. Cancel clears all overrides. A per-row reset would require removing a specific key from `draftOverrides`.

3. **Buffer working days UI.** `buffer_working_days` is included in `DraftScheduleItemUpdate` and `ScheduleDraftOverride` but has no edit input in the R15 UI. `setOverrideField` supports it, and the `saveScheduleDraftAction` writes it to the DB. A UI control for it is deferred.

4. **Locked items (`is_locked`).** No read-only guard is applied in edit mode for items where `is_locked === true`. The engine respects the lock during resolution, but the UI does not visually disable the edit controls. Adding a lock check to the edit controls is deferred.

5. **Concurrent edits.** Two PMs editing the same job simultaneously will both submit their changes, and the last save wins. No locking or conflict detection is implemented.

6. **No-filter view loses resolved hints.** The no-filter all-jobs table no longer shows resolved date hints. Hints were only meaningful in the job-filter context (single-job resolution), so this is not a regression. If cross-job hints are desired, a separate feature would be needed.
