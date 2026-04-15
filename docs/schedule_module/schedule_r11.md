# Schedule Module — R11 Deliverables

**Date:** 2026-04-11
**Branch:** `dev`
**Files changed:**
- `src/lib/schedule/apply.ts` (new)

---

## A. Full Contents of `src/lib/schedule/apply.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ResolvedScheduleGraph } from './resolver'

export type ApplyResolvedScheduleResult = {
  updatedScheduleIds: string[]
  updatedProcurementIds: string[]
  skippedScheduleIds: string[]
  skippedProcurementIds: string[]
}

function laborChanged(
  storedStart: string | null,
  storedEnd: string | null,
  resolvedStart: string | null,
  resolvedEnd: string | null
): boolean {
  return storedStart !== resolvedStart || storedEnd !== resolvedEnd
}

export async function applyResolvedScheduleGraph(
  supabase: SupabaseClient,
  graph: ResolvedScheduleGraph
): Promise<ApplyResolvedScheduleResult> {
  const { job, resolvedNodes } = graph

  const updatedScheduleIds: string[] = []
  const skippedScheduleIds: string[] = []
  const updatedProcurementIds: string[] = []
  const skippedProcurementIds: string[] = []

  const updates: Promise<void>[] = []

  // Step A — labor schedule rows
  for (const item of job.sub_schedule) {
    const resolved = resolvedNodes[`schedule:${item.id}`]

    if (
      !resolved ||
      !laborChanged(item.start_date, item.end_date, resolved.start_date, resolved.end_date)
    ) {
      skippedScheduleIds.push(item.id)
      continue
    }

    updatedScheduleIds.push(item.id)
    updates.push(
      (async () => {
        const { error } = await supabase
          .from('sub_schedule')
          .update({ start_date: resolved.start_date, end_date: resolved.end_date })
          .eq('id', item.id)
        if (error) throw error
      })()
    )
  }

  // Step B — procurement rows
  for (const item of job.procurement_items) {
    const resolved = resolvedNodes[`procurement:${item.id}`]

    if (!resolved || item.required_on_site_date === resolved.start_date) {
      skippedProcurementIds.push(item.id)
      continue
    }

    updatedProcurementIds.push(item.id)
    updates.push(
      (async () => {
        const { error } = await supabase
          .from('procurement_items')
          .update({ required_on_site_date: resolved.start_date })
          .eq('id', item.id)
        if (error) throw error
      })()
    )
  }

  await Promise.all(updates)

  return {
    updatedScheduleIds,
    updatedProcurementIds,
    skippedScheduleIds,
    skippedProcurementIds,
  }
}
```

---

## B. Import / Export Changes Required in Other Files

None. `ResolvedScheduleGraph` was already exported from `./resolver` (R6). No other files were modified.

---

## C. Exact Update Behavior for Labor and Procurement

### Labor (`sub_schedule` table)

Source of stored values: `graph.job.sub_schedule` — the array of `JobSubSchedule` rows fetched by `getJobWithDetails`.

Node key: `` `schedule:${item.id}` ``

**Change detection (`laborChanged`):**
```
storedStart !== resolvedStart || storedEnd !== resolvedEnd
```
Both sides are `string | null`. Strict `!==` comparison. Two `null` values are equal. A stored date of `'2026-04-15'` and a resolved date of `'2026-04-15'` are equal — no update. Only one field needs to differ to trigger an update; both `start_date` and `end_date` are always written together in the same `.update()` call.

**Supabase call (when changed):**
```typescript
supabase
  .from('sub_schedule')
  .update({ start_date: resolved.start_date, end_date: resolved.end_date })
  .eq('id', item.id)
```

Fields written: `start_date`, `end_date` only. No other columns are touched.

**Skip conditions:**
- Resolved node not found in `resolvedNodes` → skipped (no crash)
- Both dates match stored → skipped

### Procurement (`procurement_items` table)

Source of stored values: `graph.job.procurement_items` — the array of `ProcurementItem` rows fetched by `getJobWithDetails`.

Node key: `` `procurement:${item.id}` ``

**Change detection:**
```
item.required_on_site_date !== resolved.start_date
```
The procurement node's `start_date` in the resolved graph corresponds to `required_on_site_date` in the DB row, matching how `buildScheduleNodes` maps procurement rows (R4: `start_date: row.required_on_site_date`).

**Supabase call (when changed):**
```typescript
supabase
  .from('procurement_items')
  .update({ required_on_site_date: resolved.start_date })
  .eq('id', item.id)
```

Fields written: `required_on_site_date` only. `order_by_date` is never written — it is DB-generated and must not be touched.

**Skip conditions:**
- Resolved node not found in `resolvedNodes` → skipped
- `required_on_site_date` matches `resolved.start_date` → skipped

### Execution model

All update Promises (both labor and procurement) are collected into a single `updates` array and executed via `Promise.all`. This means:
- All changed rows are updated concurrently, not serially
- If any single `.update()` returns a Supabase error, `Promise.all` rejects immediately with that error
- The error propagates to the caller unchanged — no wrapping, no swallowing
- There is no rollback; rows that completed before the failure remain updated

---

## D. Assumptions Made

1. **`graph.job.sub_schedule` and `graph.job.procurement_items` are the authoritative stored values.** These come directly from `getJobWithDetails` (called inside `getResolvedScheduleGraph`). The caller does not need to provide a separate current-state snapshot; the graph already carries it.

2. **Rows missing from `resolvedNodes` are silently skipped.** If a `sub_schedule` or `procurement_items` row has no corresponding entry in `resolvedNodes` (e.g., the node was absent from the graph due to a dangling key), it is added to the skipped list. No error is thrown. This is consistent with R10's fallback behavior.

3. **IDs are pushed to `updatedScheduleIds` / `updatedProcurementIds` at decision time, before the Promises resolve.** If a Promise later rejects, `Promise.all` throws before the return statement executes. The caller receives an exception, not a result, so the pre-populated ID lists are never observed. This ordering is safe.

4. **Both `start_date` and `end_date` are written atomically per row.** Even if only one of the two changed, both are included in the single `.update()` call. This avoids the overhead of checking which specific field changed and keeps the update logic simple. The values written are always the resolved values (which may equal the stored values for one of the two fields).

5. **No row-level locking or optimistic concurrency.** If another process modifies a row between `getResolvedScheduleGraph` and `applyResolvedScheduleGraph`, the apply will overwrite with the resolved dates computed from the now-stale graph. Callers should treat this as a best-effort operation and re-resolve if they suspect concurrent modification.

6. **`order_by_date` is never written.** This column is Postgres-generated (computed from `required_on_site_date` and `lead_days`) and must not be touched by the application layer. The update payload for procurement rows contains only `required_on_site_date`. Supabase will return the DB-recomputed `order_by_date` in any subsequent select, without any action from this layer.

7. **No confirmed-status inspection.** A labor row with `status: 'confirmed'` is updated exactly the same as a row with `status: 'tentative'`. Detecting whether a confirmed item was shifted and generating a PM task is explicitly deferred to a later round per spec.

---

## E. TypeScript Errors Encountered

One error in `src/lib/schedule/apply.ts`:
```
src/lib/schedule/apply.ts(1,37): error TS2307: Cannot find module '@supabase/supabase-js'
or its corresponding type declarations.
```

Pre-existing environment error — same as all other files importing from `@supabase/supabase-js`. Caused by `node_modules` not being installed. No new errors introduced.

---

## F. Edge Cases Intentionally Deferred

1. **Confirmed-item shift detection.** If a labor row with `status: 'confirmed'` receives a new start/end date from the resolver, it is silently updated. The product intent (generate a `Call ${company_name}` PM task, flag the shift for review) is deferred. This round only applies dates; impact detection is the next layer.

2. **No atomicity across rows.** All updates run in parallel via `Promise.all`. If row 3 fails after rows 1 and 2 have already been written, there is no rollback. A future implementation could wrap the entire apply in a Postgres transaction via an RPC function, but no such pattern exists in the repo yet.

3. **Stale graph.** The caller is responsible for calling `getResolvedScheduleGraph` and then `applyResolvedScheduleGraph` in close sequence. If the job's data changes between those two calls (another user edits a schedule row), the apply will write dates computed from the older state. No staleness check is performed.

4. **`resolved.end_date` for procurement nodes.** `buildScheduleNodes` sets `end_date: row.required_on_site_date` for procurement nodes — the same as `start_date`. After resolution, `resolvedNode.end_date` would be recomputed if `duration_working_days` applies (hardcoded to `1` in the node builder). Only `resolved.start_date` is written back to `required_on_site_date`; `resolved.end_date` is ignored for procurement rows. This matches the spec and the R10 comparison rule.

5. **`null` resolved dates written back.** If the resolver produces `start_date: null` for a labor row (e.g., the predecessor also had `start_date: null`), and the stored value is non-null, the apply will write `null` to `start_date` and `end_date`. This is correct behavior per the spec (write what the resolver says), but callers should be aware that the resolver can clear dates, not only advance them.

6. **Large jobs with many changed rows.** `Promise.all` launches all update requests concurrently. For a job with hundreds of schedule rows all needing updates, this could generate a large burst of parallel Supabase requests. Batching into smaller groups or using an RPC is a future optimization if needed.
