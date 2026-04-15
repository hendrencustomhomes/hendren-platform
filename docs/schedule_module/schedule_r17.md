# Schedule Module — R17 Deliverables

**Date:** 2026-04-11
**Branch:** `dev`
**Files changed:**
- `src/lib/schedule/baseline.ts` (new)

---

## A. Full Contents of `src/lib/schedule/baseline.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export type JobBaseline = {
  id: string
  job_id: string
  created_at: string
  created_by: string | null
}

export type SetJobBaselineResult = {
  baseline: JobBaseline
  updatedScheduleIds: string[]
}

export async function getJobBaseline(
  supabase: SupabaseClient,
  jobId: string
): Promise<JobBaseline | null> {
  const { data, error } = await supabase
    .from('job_baselines')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle()

  if (error) throw error
  return (data as JobBaseline) ?? null
}

export async function setJobBaseline(
  supabase: SupabaseClient,
  jobId: string,
  createdBy: string | null
): Promise<SetJobBaselineResult> {
  // Step A — guard: throw if baseline already active
  const existing = await getJobBaseline(supabase, jobId)
  if (existing) {
    throw new Error('Baseline already active for this job')
  }

  // Step B — insert baseline record
  const insertPayload: Record<string, unknown> = { job_id: jobId }
  if (createdBy !== null) {
    insertPayload.created_by = createdBy
  }

  const { data: baselineRow, error: insertError } = await supabase
    .from('job_baselines')
    .insert(insertPayload)
    .select('*')
    .single()

  if (insertError) throw insertError

  const baseline = baselineRow as JobBaseline

  // Step C — fetch all sub_schedule rows for the job
  const { data: scheduleRows, error: fetchError } = await supabase
    .from('sub_schedule')
    .select('id, start_date, end_date, baseline_start_date, baseline_end_date')
    .eq('job_id', jobId)

  if (fetchError) throw fetchError

  const rows = (scheduleRows ?? []) as {
    id: string
    start_date: string | null
    end_date: string | null
    baseline_start_date: string | null
    baseline_end_date: string | null
  }[]

  // Step D — snapshot missing baseline fields from current dates
  const updatedScheduleIds: string[] = []

  for (const row of rows) {
    const needsStart = row.baseline_start_date === null
    const needsEnd = row.baseline_end_date === null

    if (!needsStart && !needsEnd) continue

    const patch: Record<string, unknown> = {}
    if (needsStart) patch.baseline_start_date = row.start_date
    if (needsEnd) patch.baseline_end_date = row.end_date

    const { error: updateError } = await supabase
      .from('sub_schedule')
      .update(patch)
      .eq('id', row.id)

    if (updateError) throw updateError

    updatedScheduleIds.push(row.id)
  }

  // Step E — return
  return { baseline, updatedScheduleIds }
}
```

---

## B. Import/Export Changes in Other Files

None. `baseline.ts` is a standalone new file. No existing file was modified.

No re-export from `src/lib/schedule/index.ts` was added because no such barrel file exists in the codebase. Callers import directly from `@/lib/schedule/baseline` as is consistent with all other schedule library files.

---

## C. Exact Baseline Activation Behavior Implemented

```
setJobBaseline(supabase, jobId, createdBy)

  1. getJobBaseline(supabase, jobId)
         ↓ if row found: throw 'Baseline already active for this job'
         ↓ if null: continue

  2. INSERT INTO job_baselines { job_id, created_by (if non-null) }
         ↓ select inserted row → baseline: JobBaseline

  3. SELECT id, start_date, end_date, baseline_start_date, baseline_end_date
     FROM sub_schedule WHERE job_id = jobId

  4. FOR EACH row:
       - if baseline_start_date IS NULL AND baseline_end_date IS NULL:
           UPDATE sub_schedule SET baseline_start_date = start_date,
                                   baseline_end_date   = end_date
           WHERE id = row.id
       - if only baseline_start_date IS NULL:
           UPDATE sub_schedule SET baseline_start_date = start_date
           WHERE id = row.id
       - if only baseline_end_date IS NULL:
           UPDATE sub_schedule SET baseline_end_date = end_date
           WHERE id = row.id
       - if both are non-null: skip row entirely
       - push updated row id to updatedScheduleIds

  5. return { baseline, updatedScheduleIds }
```

**Sequential writes.** Step 4 updates are performed one at a time in a `for...of` loop. Parallel `Promise.all` is not used because the volume of rows is expected to be small (< 50 per job) and serial execution avoids any risk of partial-state confusion if an update throws mid-loop. If the loop throws, the `job_baselines` insert in step 2 is already committed — see deferred edge case 1.

**`createdBy` handling.** The field is conditionally included in the insert payload. When `createdBy` is `null`, the key is omitted entirely so the DB default applies. This matches the pattern used in `taskTriggers.ts` for `assignee_profile_id` and avoids sending an explicit null against a column that may have a NOT NULL constraint.

**`maybeSingle()` for `getJobBaseline`.** `.maybeSingle()` returns `null` when no row matches without throwing, and throws on genuine query errors. `.single()` would throw when zero rows are returned, which is the expected state for jobs without a baseline. Using `.maybeSingle()` keeps error semantics clean.

---

## D. Assumptions Made

1. **`job_baselines` table exists with at least `id`, `job_id`, `created_at`, `created_by` columns.** The schema is marked as complete in Supabase per the task brief. If the table or any column is missing, Supabase will return an error on insert or select, which will propagate as thrown. No silent degradation.

2. **`sub_schedule` has `baseline_start_date` and `baseline_end_date` columns.** Per the architecture doc (`baseline_model.md`). Supabase will error on the select if these columns do not exist.

3. **One baseline per job is enforced in application code, not by a DB unique constraint.** `getJobBaseline` checks for an existing row before inserting. A DB unique constraint on `job_baselines(job_id)` would be the correct additional safeguard but is not verified to exist. If two concurrent `setJobBaseline` calls race through the check simultaneously, both may insert — see deferred edge case 2.

4. **`created_by` maps to a profile/user ID as a string.** The column is treated as `string | null` throughout. No type narrowing beyond null check is applied.

5. **Null `start_date` or `end_date` on a schedule row is a valid value.** When `baseline_start_date` is null and the current `start_date` is also null, the baseline snapshot writes null to `baseline_start_date`. This is intentional — the baseline records the state at activation time, including null dates. A null baseline date produces a null variance in reporting, which correctly signals that the item had no date when the baseline was set.

6. **Step 4 uses partial patching.** If only one of the two baseline fields is null, only that field is written. This handles the edge case where a row was partially populated (e.g., `baseline_start_date` set by a previous operation but `baseline_end_date` still null). The row is included in `updatedScheduleIds` even if only one field was written.

7. **Procurement items are not snapshotted.** Per task scope. `procurement_items` has no baseline fields in v1. The baseline covers labor schedule only.

8. **No transaction wraps the full pipeline.** Steps 2–4 each make independent DB writes. A failure in step 3 (fetch) or step 4 (update loop) leaves the `job_baselines` row inserted but with zero or partial `sub_schedule` snapshots. This matches the no-atomicity pattern used throughout the codebase (see `runApplyPipeline.ts` assumptions). Atomicity across all three steps requires a Postgres RPC, which is deferred.

---

## E. TypeScript Errors Encountered

One error in `src/lib/schedule/baseline.ts`:

```
src/lib/schedule/baseline.ts(1,37): error TS2307: Cannot find module '@supabase/supabase-js'
or its corresponding type declarations.
```

Pre-existing environment error from missing `node_modules`. Identical across all files importing from `@supabase/supabase-js`. No new errors introduced.

---

## F. Edge Cases Intentionally Deferred

1. **Partial failure after `job_baselines` insert.** If step 3 (fetch `sub_schedule`) or any iteration of step 4 (update loop) throws, the baseline row in `job_baselines` is already committed. The job will have a `job_baselines` record but with zero or partial `baseline_start_date`/`baseline_end_date` values on `sub_schedule`. The guard in step A will now prevent a second `setJobBaseline` call from succeeding. Recovery requires either a Postgres-level transaction wrapping all writes, or a repair operation that re-runs the snapshot step independently of the insert. A DB-level RPC is the correct long-term fix.

2. **Race condition between check and insert.** Two simultaneous `setJobBaseline` calls for the same job can both pass the `getJobBaseline` null check before either has inserted. Both will then insert into `job_baselines`, violating the one-baseline-per-job rule. A unique constraint on `job_baselines(job_id)` would prevent this at the DB level and cause the second insert to throw. Whether that constraint exists is not verified here. Without it, the race window is open.

3. **Large schedules.** Step 4 updates rows serially. For a job with many schedule items (hypothetically 100+), this produces N round trips. A bulk update via `.in('id', idsToUpdate)` with a single write call is the optimization, but requires pre-building the patch object, which is non-trivial when the patch varies per row (some need start only, some need end only, some need both). Deferred given expected row volumes.

4. **`job_id` referential integrity.** The function does not verify that the job exists before inserting the baseline row. If `jobId` is invalid, the insert will either fail on a foreign key constraint (correct behavior, error propagates) or succeed if no FK exists (incorrect — orphaned baseline). The FK constraint is assumed to exist in the schema.

5. **Return value when `sub_schedule` is empty.** If a baseline is set on a job with no schedule items, step 3 returns an empty array, step 4 is a no-op, and the function returns `{ baseline, updatedScheduleIds: [] }`. This is correct — the baseline record exists, and new items added later will be auto-populated per the architecture rules. The empty `updatedScheduleIds` array accurately reflects that no rows were snapshotted.
