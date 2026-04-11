# Schedule Module — R10 Deliverables

**Date:** 2026-04-11
**Branch:** `dev`
**Files changed:**
- `src/app/schedule/page.tsx` (updated)

---

## A. Exact Files Changed

### `src/app/schedule/page.tsx`

Four targeted additions to the existing file:

1. **Two new imports** at the top:
   ```typescript
   import { getResolvedScheduleGraph } from '@/lib/schedule/resolver'
   import type { ScheduleNode } from '@/lib/schedule/nodes'
   ```

2. **New `resolvedHint` helper function** added after `getProcurementSource`:
   Renders a small "Resolved: <date>" line below a stored date, with an orange "Shifted" pill badge when the resolved date differs from the stored date.

3. **`resolvedNodes` loading** added after the existing parallel query block:
   ```typescript
   let resolvedNodes: Record<string, ScheduleNode> | null = null
   if (jobFilter) {
     try {
       const graph = await getResolvedScheduleGraph(supabase, jobFilter)
       resolvedNodes = graph.resolvedNodes
     } catch {
       // Graceful fallback — engine errors do not break the page
     }
   }
   ```

4. **Cell updates** in both table rows:
   - Labor map: `resolvedNode` constant added, used in Start and End `<td>` cells
   - Procurement map: `resolvedNode` constant added, used in Need By `<td>` cell

No other changes were made. No other files were touched.

---

## B. Exact UI Behavior Added

**When `?job=<jobId>` is NOT in the URL:** page behaves exactly as before. No resolved output is shown. No extra queries are made.

**When `?job=<jobId>` IS in the URL and the resolver succeeds:**

For each labor schedule row where the node exists in `resolvedNodes`:
- **Start column cell**: below the stored start date, shows a small muted line: `Resolved: <formatted date>`. If the resolved date differs from stored, an orange `Shifted` pill appears inline.
- **End column cell**: same treatment for end date.

For each procurement row where the node exists in `resolvedNodes`:
- **Need By column cell**: below the stored required-on-site date, shows `Resolved: <formatted date>` with the same `Shifted` badge if different.

**Visual spec of `resolvedHint` output:**
```
Dec 15            ← stored date (existing display)
Resolved: Jan 3   ← new muted line (fontSize: 12px, color: var(--text-muted))
  [Shifted]       ← orange rounded pill, only when dates differ
                    (background: rgba(234,88,12,0.1), color: #ea580c)
```

**When the resolver throws** (e.g., job not found, cycle in graph): the `try/catch` swallows the error and `resolvedNodes` remains `null`. The page renders exactly as without `?job=`. No error boundary needed.

**When a node key is not found in `resolvedNodes`** (spec: "fall back gracefully"): the `resolvedNode && resolvedHint(...)` guard short-circuits. Nothing is rendered for that row. No error, no crash.

---

## C. How Resolved Graph Data Is Loaded

`getResolvedScheduleGraph(supabase, jobFilter)` is called once, sequentially, after the existing `Promise.all([scheduleQuery, procurementQuery])` completes.

**Call path:** `getResolvedScheduleGraph` (R6) → `getJobWithDetails` + `getScheduleDependencies` (parallel via Promise.all internally) → `buildScheduleNodes` (R4) → `resolveScheduleGraph` (R5, topological sort + date propagation).

**Scope:** called only when `jobFilter` is set. On the all-jobs view (`/schedule` with no query param), `resolvedNodes` is `null` and no additional DB calls are made.

**Why not parallel with the existing queries:** `getResolvedScheduleGraph` calls `getJobWithDetails` which re-fetches the job's sub_schedule and procurement_items. Running it in parallel with the existing schedule/procurement queries would start overlapping fetches for the same rows. The sequential approach is simpler and the latency difference is negligible at this scale.

---

## D. How Row Comparison Is Performed

**Labor rows:**

Node key: `` `schedule:${item.id}` ``

```typescript
const resolvedNode: ScheduleNode | undefined = resolvedNodes?.[`schedule:${item.id}`]
```

If `resolvedNode` is defined:
- Start comparison: `resolvedHint(item.start_date, resolvedNode.start_date)`
  - `changed = item.start_date !== resolvedNode.start_date`
- End comparison: `resolvedHint(item.end_date, resolvedNode.end_date)`
  - `changed = item.end_date !== resolvedNode.end_date`

**Procurement rows:**

Node key: `` `procurement:${item.id}` ``

```typescript
const resolvedNode: ScheduleNode | undefined = resolvedNodes?.[`procurement:${item.id}`]
```

If `resolvedNode` is defined:
- Need-by comparison: `resolvedHint(item.required_on_site_date, resolvedNode.start_date)`
  - Stored field: `required_on_site_date`
  - Resolved field: `resolvedNode.start_date` (the resolver advances start_date of procurement nodes)
  - `changed = item.required_on_site_date !== resolvedNode.start_date`

`order_by_date` is not used in comparison (per spec: "Do not use order_by_date for comparison in this round").

Comparison is strict string equality (`!==`). Both values are ISO date strings (`'YYYY-MM-DD'`) or `null`. Two `null` values compare equal and produce no "Shifted" badge.

---

## E. Assumptions Made

1. **Resolved dates are only shown when `?job=` is present.** The all-jobs view would require N calls to `getResolvedScheduleGraph` — one per distinct job across all schedule/procurement rows. This is not a safe operation for an MVP pass. The job-filtered view makes the resolver cost bounded and predictable (one call, one job).

2. **`getResolvedScheduleGraph` re-fetches job data rather than reusing the existing query results.** The existing queries select from `sub_schedule` and `procurement_items` directly with a join to `jobs(id, client_name, color)`. `getJobWithDetails` selects from `jobs` with nested relations. These are structurally different queries with different shapes. Merging them would require significant refactoring that is out of scope for R10.

3. **`fmtDate` is reused for resolved dates.** The existing `fmtDate` formats via `new Date(value).toLocaleDateString(...)`, which applies UTC midnight interpretation to ISO strings. This is a pre-existing behavior. Resolved date strings are produced by the engine using local-safe formatting (`getFullYear/getMonth/getDate`), but they are displayed via the same `fmtDate` for visual consistency. The UTC offset risk exists for both stored and resolved dates equally, so comparisons remain consistent.

4. **Errors from the resolver are silently suppressed.** A cycle in the dependency graph, a missing job, or any unexpected DB error causes the page to render without resolved dates rather than throwing. This is appropriate for a read-only inspection view where the primary content (stored dates, risk alerts) must always be available.

5. **`resolvedNode` is looked up per-row, not pre-built into a separate list.** The optional chaining `resolvedNodes?.[key]` is O(1) per row and doesn't require a preprocessing step. The `resolvedNodes` map is keyed exactly by the node key format used here.

6. **No indicator is shown on rows where `resolvedNode` is absent.** A missing node (key not in `resolvedNodes`) silently renders as stored-only. There is no "Not in graph" annotation. The spec states "fall back gracefully: show stored values only."

---

## F. TypeScript Errors Encountered

**New errors introduced by R10:** None.

**Pre-existing errors in `src/app/schedule/page.tsx`** (unchanged from before R10):
- `TS2307: Cannot find module 'next/link'` — missing `node_modules`
- `TS2307: Cannot find module 'next/navigation'` — missing `node_modules`
- `TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists` — missing React types from `node_modules`
- `TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist` — same root cause

All pre-existing. Caused by `node_modules` not being installed in the CI/audit environment. Unchanged across all rounds.

---

## G. Performance Concerns Noticed But Not Addressed

1. **Double-fetch of schedule/procurement data.** The page fetches `sub_schedule` and `procurement_items` once via the direct Supabase queries, then `getResolvedScheduleGraph` fetches them again via `getJobWithDetails`. For a job-filtered view this is 2 extra round trips (sub_schedule + procurement_items inside `getJobWithDetails`) plus 1 for `getScheduleDependencies`. Total: 4 queries for the job-filtered path (2 original + 2 inside resolver) vs 2 queries without `?job=`. At typical page load sizes this is negligible, but a future optimization could accept a pre-fetched `JobWithDetails` instead of re-fetching inside the resolver.

2. **Sequential resolver call.** `getResolvedScheduleGraph` runs after the `Promise.all` finishes. It could potentially be parallelized with the existing queries by splitting the resolver's internal steps, but the shared `supabase` client is a Supabase SSR client that should handle concurrent queries fine. The simple sequential implementation is correct and safe.

3. **`resolveScheduleGraph` processes all nodes even if only a few have dependencies.** For a job with 50 schedule items and 2 dependencies, the topological sort still visits all 50 nodes. This is already O(N) in the engine and is not a concern at realistic schedule sizes.

4. **No caching of resolved graph across requests.** Each page load re-runs the resolver. If this page is frequently loaded per-job, a short-lived server cache (e.g., React's `cache()` or `unstable_cache`) on `getResolvedScheduleGraph` could reduce latency. Not implemented — premature at this stage.
