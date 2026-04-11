# Schedule Module — R7 Deliverables

**Date:** 2026-04-11
**Branch:** `dev`
**Files changed:**
- `src/lib/schedule/dependencies.ts` (new)

---

## A. Full Contents of `src/lib/schedule/dependencies.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScheduleItemDependency } from '@/lib/db'
import { getJobWithDetails } from '@/lib/db'
import { buildScheduleNodes } from './nodes'

export type DependencyNodeRef = {
  type: 'schedule' | 'procurement'
  id: string
}

export type DependencyWriteInput = {
  predecessor: DependencyNodeRef
  successor: DependencyNodeRef
  referencePoint: 'start' | 'end'
  offsetWorkingDays: number
}

function makeDependencyNodeKey(ref: DependencyNodeRef): string {
  return `${ref.type}:${ref.id}`
}

async function getValidJobNodeKeys(
  supabase: SupabaseClient,
  jobId: string
): Promise<Set<string>> {
  const job = await getJobWithDetails(supabase, jobId)
  const nodes = buildScheduleNodes({
    subSchedule: job.sub_schedule,
    procurementItems: job.procurement_items,
  })
  return new Set(Object.keys(nodes))
}

function validateDependencyInput(
  input: DependencyWriteInput,
  validKeys: Set<string>
): void {
  const predKey = makeDependencyNodeKey(input.predecessor)
  const succKey = makeDependencyNodeKey(input.successor)

  if (predKey === succKey) {
    throw new Error(
      'Invalid dependency: predecessor and successor cannot be the same node'
    )
  }
  if (!validKeys.has(predKey)) {
    throw new Error('Invalid dependency: predecessor node not found on job')
  }
  if (!validKeys.has(succKey)) {
    throw new Error('Invalid dependency: successor node not found on job')
  }
}

function buildDependencyRow(jobId: string, input: DependencyWriteInput) {
  return {
    job_id: jobId,
    predecessor_type: input.predecessor.type,
    predecessor_id: input.predecessor.id,
    successor_type: input.successor.type,
    successor_id: input.successor.id,
    reference_point: input.referencePoint,
    offset_working_days: input.offsetWorkingDays,
  }
}

export async function createScheduleDependencies(
  supabase: SupabaseClient,
  jobId: string,
  inputs: DependencyWriteInput[]
): Promise<ScheduleItemDependency[]> {
  if (inputs.length === 0) return []

  const validKeys = await getValidJobNodeKeys(supabase, jobId)

  for (const input of inputs) {
    validateDependencyInput(input, validKeys)
  }

  const rows = inputs.map((input) => buildDependencyRow(jobId, input))

  const { data, error } = await supabase
    .from('schedule_item_dependencies')
    .insert(rows)
    .select()

  if (error) throw error
  return (data ?? []) as ScheduleItemDependency[]
}

export async function deleteScheduleDependenciesForJob(
  supabase: SupabaseClient,
  jobId: string
): Promise<void> {
  const { error } = await supabase
    .from('schedule_item_dependencies')
    .delete()
    .eq('job_id', jobId)

  if (error) throw error
}

export async function replaceScheduleDependenciesForJob(
  supabase: SupabaseClient,
  jobId: string,
  inputs: DependencyWriteInput[]
): Promise<ScheduleItemDependency[]> {
  if (inputs.length > 0) {
    const validKeys = await getValidJobNodeKeys(supabase, jobId)
    for (const input of inputs) {
      validateDependencyInput(input, validKeys)
    }
  }

  await deleteScheduleDependenciesForJob(supabase, jobId)

  if (inputs.length === 0) return []

  const rows = inputs.map((input) => buildDependencyRow(jobId, input))

  const { data, error } = await supabase
    .from('schedule_item_dependencies')
    .insert(rows)
    .select()

  if (error) throw error
  return (data ?? []) as ScheduleItemDependency[]
}
```

---

## B. Import / Export Changes Required in Other Files

None. All required exports (`getJobWithDetails`, `buildScheduleNodes`, `ScheduleItemDependency`) were already in place from R4 and R6. No existing files were modified.

---

## C. Assumptions Made

1. **`SupabaseClient` is the first parameter.** All existing DB helpers in `db.ts` take `supabase: SupabaseClient` as their first argument. This file follows the same convention. The spec showed only function signatures without the supabase parameter; the repo pattern takes precedence.

2. **`getValidJobNodeKeys` makes a full round-trip to the DB.** Both `createScheduleDependencies` and `replaceScheduleDependenciesForJob` call `getJobWithDetails` internally to build the valid key set. This is two extra DB calls per write operation. Caching or passing pre-fetched node data was not added because no caller pattern exists to thread it through, and premature optimization was not requested.

3. **`validateDependencyInput` throws on first invalid input, not after collecting all errors.** The `for` loop in both create and replace exits on the first failure. Bulk error collection (returning all violations at once) was not implemented — it was not requested and adds complexity without a UI consumer yet.

4. **No deduplication before insert.** If the caller passes two inputs that are logically identical, both rows are sent to the DB. The DB unique constraint on `(job_id, predecessor_type, predecessor_id, successor_type, successor_id, reference_point)` (if present) will reject the second insert. If no unique constraint exists, both rows are stored. No in-memory deduplication is performed here — enforcing data integrity is the DB's responsibility.

5. **`replaceScheduleDependenciesForJob` is not atomic.** The delete and insert are two separate Supabase calls with no transaction wrapping. If the insert fails after the delete succeeds, the job is left with no dependencies. This is the same pattern used throughout the repo; there is no existing transaction or RPC pattern to follow. The window is small, but callers should be aware of this risk and may want to implement an API-level retry or wrap in a Postgres function in the future.

6. **`replaceScheduleDependenciesForJob` with empty inputs validates nothing and deletes all.** An empty `inputs` array causes an unconditional delete and returns `[]`. This is intentional: "replace with nothing" means "clear all dependencies." Validation is skipped because there is nothing to validate.

7. **`buildDependencyRow` does not include `created_at` or `updated_at`.** These are expected to be DB-generated (`DEFAULT NOW()`). If they are not, Supabase will return an error, which propagates naturally.

---

## D. TypeScript Errors Encountered

One error in `src/lib/schedule/dependencies.ts`:
```
src/lib/schedule/dependencies.ts(1,37): error TS2307: Cannot find module '@supabase/supabase-js'
or its corresponding type declarations.
```

This is the same pre-existing environment error present in `src/lib/db.ts`, `src/lib/schedule/resolver.ts`, and all other files importing from `@supabase/supabase-js`. It is caused by `node_modules` not being installed in the development environment, not by anything in this file. No new errors were introduced.

---

## E. Edge Cases Intentionally Deferred

1. **Self-referencing dependency (`predecessor === successor`).** `validateDependencyInput` throws `'Invalid dependency: predecessor and successor cannot be the same node'` when `predKey === succKey`. This catches same-id, same-type self-loops. A cross-type self-loop (e.g., `schedule:X` → `procurement:X`) produces different keys and would pass validation — but `schedule:X` and `procurement:X` are different entities, so this is not actually a self-loop.

2. **Cycle detection is not performed at write time.** `validateDependencyInput` only checks that both nodes exist on the job. It does not check whether the new dependency would create a cycle in the existing dependency graph. A newly written dependency that closes a cycle will be accepted here and will only fail later when `resolveScheduleGraph` (via `topologicalSort`) attempts to process the graph. Cycle detection at write time would require fetching all existing dependencies and running a topological sort — expensive and not requested.

3. **`offsetWorkingDays` is not range-validated.** Any integer (positive, zero, or negative) is accepted. Extreme values (e.g., `offset = -9999`) are passed through to the engine unchanged. Product-level validation (e.g., clamping to ±365) is deferred.

4. **Concurrent writes.** If two clients simultaneously call `replaceScheduleDependenciesForJob` for the same job, both will delete and then insert, potentially interleaving in destructive ways. No locking mechanism is in place. Deferred — requires a Postgres-level advisory lock or serializable transaction.

5. **`getJobWithDetails` errors on non-existent job.** If `jobId` does not exist, `getJobWithDetails` throws `'Job not found'`. This propagates up unchanged from all three exported functions. Callers own error handling.
