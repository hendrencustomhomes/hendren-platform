# Schedule Module — R14 Deliverables

**Date:** 2026-04-11
**Branch:** `dev`
**Files changed:**
- `src/lib/schedule/runApplyPipeline.ts` (new)

---

## A. Full Contents of `src/lib/schedule/runApplyPipeline.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import { getResolvedScheduleGraph } from './resolver'
import { detectConfirmedStartShiftImpacts } from './impacts'
import { applyResolvedScheduleGraph } from './apply'
import { createScheduleTriggeredCallTasks } from './taskTriggers'
import type { ResolvedScheduleGraph } from './resolver'
import type { ConfirmedStartShiftImpact } from './impacts'
import type { ApplyResolvedScheduleResult } from './apply'
import type { CreateScheduleTriggeredTasksResult } from './taskTriggers'

export type RunScheduleApplyPipelineResult = {
  graph: ResolvedScheduleGraph
  impacts: ConfirmedStartShiftImpact[]
  applyResult: ApplyResolvedScheduleResult
  taskResult: CreateScheduleTriggeredTasksResult
}

export async function runScheduleApplyPipeline(
  supabase: SupabaseClient,
  jobId: string
): Promise<RunScheduleApplyPipelineResult> {
  // Step A — resolve graph from DB
  const graph = await getResolvedScheduleGraph(supabase, jobId)

  // Step B — detect confirmed start-shift impacts before any mutation
  const impacts = detectConfirmedStartShiftImpacts(graph)

  // Step C — persist resolved dates
  const applyResult = await applyResolvedScheduleGraph(supabase, graph)

  // Step D — create triggered call tasks (runs even when impacts is empty)
  const taskResult = await createScheduleTriggeredCallTasks(supabase, impacts)

  return { graph, impacts, applyResult, taskResult }
}
```

---

## B. Exact Execution Order Used

```
1. getResolvedScheduleGraph(supabase, jobId)
        ↓ graph
2. detectConfirmedStartShiftImpacts(graph)        ← pure, no DB
        ↓ impacts
3. applyResolvedScheduleGraph(supabase, graph)    ← DB writes
        ↓ applyResult
4. createScheduleTriggeredCallTasks(supabase, impacts)  ← DB writes
        ↓ taskResult
5. return { graph, impacts, applyResult, taskResult }
```

All four steps are sequential and await each other. No step starts before the previous one completes.

---

## C. Why Impact Detection Happens Before Apply

`detectConfirmedStartShiftImpacts` compares **stored** dates (from `graph.job.sub_schedule`) against **resolved** dates (from `graph.resolvedNodes`). It reads the gap between what is in the DB and what the engine computed.

If impact detection ran after `applyResolvedScheduleGraph`, the stored dates would already have been overwritten with the resolved values. The comparison `item.start_date !== resolved.start_date` would produce zero results for every row — the shift would be invisible because the old value was already gone.

By detecting impacts from the graph (which was read before any writes), the function captures the pre-apply state of every confirmed row while it is still authoritative. The graph object is immutable in this pipeline — `applyResolvedScheduleGraph` reads from it but does not mutate it — so `impacts` computed in step B remains valid throughout the rest of the pipeline.

The task creation in step D then acts on those pre-computed impacts, not on post-apply data. This is the only ordering that produces correct impact detection without requiring a separate pre-apply read.

---

## D. Assumptions Made

1. **`graph` is not mutated between steps B and C.** `applyResolvedScheduleGraph` reads `graph.job.sub_schedule`, `graph.job.procurement_items`, and `graph.resolvedNodes` but does not modify the graph object. The `impacts` array computed in step B therefore remains valid when passed to step D. This holds as long as no future change makes `applyResolvedScheduleGraph` mutate the graph in place.

2. **Step D always runs, even when `impacts` is empty.** `createScheduleTriggeredCallTasks` handles the empty case with an early return and produces `{ createdTaskIds: [], skippedExistingImpactScheduleIds: [] }`. There is no conditional guard around step D. This ensures the task-result field is always present in the return value with a consistent shape, regardless of how many impacts were detected.

3. **Errors propagate to the caller without wrapping.** If any step throws — a resolver cycle, a Supabase write failure, a missing job — the error propagates out of `runScheduleApplyPipeline` unchanged. The caller (a future server action or API route) owns error handling, user messaging, and any rollback logic.

4. **No partial-success semantics.** If step C (apply) succeeds but step D (task creation) throws, the resolved dates are already committed to the DB but no tasks are created. There is no rollback of the date writes. This matches the approach used in `applyResolvedScheduleGraph` itself (no transaction). Atomicity across the full pipeline requires a DB-level transaction or RPC, which is deferred.

5. **The `graph` field is included in the return value.** Callers (e.g., a server action that wants to show a summary) may need to inspect the resolved nodes or the raw job data. Returning `graph` avoids a second call to `getResolvedScheduleGraph` for display purposes.

6. **This function is a library helper, not a server action.** It has no `'use server'` directive and no Next.js-specific dependencies. It can be called from a server action, an API route, a test, or any other server-side context that has a `SupabaseClient`.

---

## E. TypeScript Errors Encountered

One error in `src/lib/schedule/runApplyPipeline.ts`:
```
src/lib/schedule/runApplyPipeline.ts(1,37): error TS2307: Cannot find module '@supabase/supabase-js'
or its corresponding type declarations.
```

Pre-existing environment error from missing `node_modules`. Identical across all files importing from `@supabase/supabase-js`. No new errors introduced.

---

## F. Edge Cases Intentionally Deferred

1. **No atomicity across the full pipeline.** Steps C and D each make DB writes independently. A failure mid-pipeline leaves partial state: dates may be applied without tasks, or tasks may reference schedule items whose dates were not yet applied. A Postgres transaction wrapping both writes is the correct fix but requires an RPC function and a DB migration, neither of which exists in the repo yet.

2. **Re-running the pipeline on an already-applied job.** If `runScheduleApplyPipeline` is called twice for the same job without any dependency changes between calls, step C will find all rows already matching resolved values (no updates needed), step B will find no confirmed start-shift impacts (because stored = resolved after first apply), and step D will skip all existing open tasks. The result is a no-op across all four steps. This is correct behavior, but callers should be aware that repeated runs are safe but not free (DB round trips still occur).

3. **Preview mode.** This pipeline always persists. There is no dry-run flag that would execute steps A and B (read + detect) without executing steps C and D (write). A preview-only path already exists via `getResolvedScheduleGraph` + `detectConfirmedStartShiftImpacts` called directly (as in R10). Adding a `dryRun` parameter to this function is a possible future addition.

4. **Concurrency.** Two simultaneous calls to `runScheduleApplyPipeline` for the same job (e.g., two PM users clicking "Apply" at the same time) would race: both would compute the same graph, both would write the same date values, and both would attempt task creation. The date writes are idempotent (same value written twice). The task creation uses a check-then-insert pattern that has a race window but the DB unique constraint (if added per R13's deferred item) would prevent duplicates. Without that constraint, two tasks could be created.

5. **`graph` in the return value reflects pre-apply stored dates.** The `graph.job.sub_schedule` rows still carry the original `start_date`/`end_date` values from before `applyResolvedScheduleGraph` ran. If the caller uses `graph` to display "current" dates after the apply, they will see stale values. The caller should use `graph.resolvedNodes` for post-apply date display, or re-fetch from DB.
