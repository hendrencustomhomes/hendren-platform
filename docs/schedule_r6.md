# Schedule Module — R6 Deliverables

**Date:** 2026-04-10
**Branch:** `dev`
**Files changed:**
- `src/lib/schedule/resolver.ts` (new)
- `src/lib/db.ts` (select update in `getJobWithDetails` only)

---

## A. Full Contents of `src/lib/schedule/resolver.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { JobWithDetails, ScheduleItemDependency } from '@/lib/db'
import type { ScheduleNode } from './nodes'
import { getJobWithDetails, getScheduleDependencies } from '@/lib/db'
import { buildScheduleNodes } from './nodes'
import { resolveScheduleGraph } from './engine'

export type ResolvedScheduleGraph = {
  job: JobWithDetails
  dependencies: ScheduleItemDependency[]
  nodes: Record<string, ScheduleNode>
  resolvedNodes: Record<string, ScheduleNode>
}

export async function getResolvedScheduleGraph(
  supabase: SupabaseClient,
  jobId: string
): Promise<ResolvedScheduleGraph> {
  const job = await getJobWithDetails(supabase, jobId)
  const dependencies = await getScheduleDependencies(supabase, jobId)

  const nodes = buildScheduleNodes({
    subSchedule: job.sub_schedule,
    procurementItems: job.procurement_items,
  })

  const resolvedNodes = resolveScheduleGraph({ nodes, dependencies })

  return { job, dependencies, nodes, resolvedNodes }
}
```

No internal helpers were needed. The four calls are direct delegations; no validation logic was added.

---

## B. Import / Export Changes Required in Other Files

### `src/lib/db.ts` — `getJobWithDetails` select update

The sub_schedule and procurement_items selects in `getJobWithDetails` did not include the schedule engine fields added in R1–R4. Without them, `buildScheduleNodes` would receive `undefined` at runtime for `buffer_working_days`, `include_saturday`, `include_sunday`, and `duration_working_days`, even though TypeScript considers them required on `JobSubSchedule`.

**Fields added to `sub_schedule` select:**
- `duration_working_days`
- `buffer_working_days`
- `include_saturday`
- `include_sunday`
- `is_locked`

**Fields added to `procurement_items` select:**
- `buffer_working_days`

No other behavior in `getJobWithDetails` was changed. The return type and cast remain unchanged.

No other files required changes. All necessary exports (`getJobWithDetails`, `getScheduleDependencies`, `buildScheduleNodes`, `resolveScheduleGraph`) were already in place from R1–R5.

---

## C. Assumptions Made

1. **`getJobWithDetails` errors are allowed to propagate.** The spec says "let existing helper errors throw naturally." If the job is not found, `getJobWithDetails` throws `new Error('Job not found')`. `getResolvedScheduleGraph` does not catch or wrap this. Callers own error handling.

2. **`getScheduleDependencies` runs as a second query, not a join.** This is consistent with the R4 spec which said "do not join anything yet." The two round-trips are intentional; collapsing them into a single query is a future optimization.

3. **No validation of `job.sub_schedule` or `job.procurement_items` shape.** Both are cast via `as JobWithDetails` inside `getJobWithDetails`. The resolver trusts the cast. If the DB returns unexpected nulls for required fields (e.g., `buffer_working_days`), the engine will silently use `undefined` where `number` is expected. This is a known risk documented in section E.

4. **`resolveScheduleGraph` cycle errors are not caught.** If the dependency graph has a cycle, `topologicalSort` throws `'Cycle detected in schedule dependency graph'`. This propagates up through `getResolvedScheduleGraph` to the caller. No suppression.

5. **No optional internal validation helper was added.** The spec allowed a small internal validator for job shape but it was not needed — the existing `getJobWithDetails` signature already guarantees the required fields at the TypeScript level.

---

## D. TypeScript Errors Encountered

No errors introduced by these changes.

Pre-existing error in `src/lib/db.ts`:
```
src/lib/db.ts(1,32): error TS2307: Cannot find module '@supabase/supabase-js'
or its corresponding type declarations.
```
Unchanged from previous rounds. Caused by `node_modules` not installed in environment.

`src/lib/schedule/resolver.ts` — zero TypeScript errors.

---

## E. Data-Shape Mismatches Discovered While Wiring

### 1. `getJobWithDetails` did not select engine fields (fixed in this round)

The `getJobWithDetails` Supabase select query was written before the schedule engine fields existed. It selected only the original `sub_schedule` and `procurement_items` columns. When `buildScheduleNodes` reads `row.buffer_working_days`, `row.include_saturday`, etc., those values would be `undefined` at runtime despite the TypeScript type saying `number` / `boolean`.

**Fix applied:** Added all missing engine fields to both the `sub_schedule` and `procurement_items` selects within `getJobWithDetails`. This is the only change made to `db.ts` in this round.

### 2. `JobWithDetails.sub_schedule` is typed as `JobSubSchedule[]` but runtime data depends on the select

`JobWithDetails` uses `Record<string, unknown>` intersection with a cast, meaning TypeScript cannot verify that the Supabase response actually contains all `JobSubSchedule` fields. Any field omitted from the select will silently be `undefined` at runtime. The select update in this round closes the gap for the engine fields, but this structural weakness remains: adding a new field to `JobSubSchedule` without updating the select will compile cleanly but fail silently at runtime.

### 3. `is_locked` is now fetched but not yet used

`is_locked` was added to the `JobSubSchedule` type in R1 and is now fetched by `getJobWithDetails`. It is available on every `JobSubSchedule` row but is not read by `buildScheduleNodes` or `resolveScheduleGraph`. When lock-aware resolution is implemented, the engine field is available without another query change.

### 4. `JobSubSchedule.confirmed_date` is still not in the select

`confirmed_date` is typed as optional (`?`) on `JobSubSchedule` and is written during confirm actions, but it is not selected in `getJobWithDetails`. The resolver does not need it at this stage. If future resolution logic needs to treat confirmed items differently, the select will need to be updated again.
