# Schedule Module — R13 Deliverables

**Date:** 2026-04-11
**Branch:** `dev`
**Files changed:**
- `src/lib/schedule/taskTriggers.ts` (new)

---

## A. Full Contents of `src/lib/schedule/taskTriggers.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConfirmedStartShiftImpact } from './impacts'

export type CreateScheduleTriggeredTasksResult = {
  createdTaskIds: string[]
  skippedExistingImpactScheduleIds: string[]
}

const CALL_TASK_TYPE = 'call_task'
const DEFAULT_TASK_STATUS = 'open'

function isOpenTaskStatus(status: string | null | undefined): boolean {
  if (status == null) return true
  const lower = status.toLowerCase()
  return !['complete', 'completed', 'closed', 'cancelled'].includes(lower)
}

function buildCallTaskTitle(companyName: string | null): string {
  const trimmed = companyName?.trim()
  return trimmed ? `Call ${trimmed}` : 'Call company'
}

export async function createScheduleTriggeredCallTasks(
  supabase: SupabaseClient,
  impacts: ConfirmedStartShiftImpact[]
): Promise<CreateScheduleTriggeredTasksResult> {
  if (impacts.length === 0) {
    return { createdTaskIds: [], skippedExistingImpactScheduleIds: [] }
  }

  const createdTaskIds: string[] = []
  const skippedExistingImpactScheduleIds: string[] = []

  for (const impact of impacts) {
    // Step B — check for an existing open matching task
    const { data: existing, error: queryError } = await supabase
      .from('job_tasks')
      .select('id, status')
      .eq('job_id', impact.jobId)
      .eq('linked_schedule_id', impact.scheduleId)
      .eq('task_type', CALL_TASK_TYPE)

    if (queryError) throw queryError

    const hasOpenTask = (existing ?? []).some((t: { status: string | null }) =>
      isOpenTaskStatus(t.status)
    )

    // Step C — skip if open task already exists
    if (hasOpenTask) {
      skippedExistingImpactScheduleIds.push(impact.scheduleId)
      continue
    }

    // Step D — create new task
    const title = buildCallTaskTitle(impact.companyName)
    const description =
      `Confirmed start date shifted: ${impact.oldStartDate ?? '—'} → ${impact.newStartDate ?? '—'}`

    const payload: Record<string, unknown> = {
      job_id: impact.jobId,
      linked_schedule_id: impact.scheduleId,
      task_type: CALL_TASK_TYPE,
      status: DEFAULT_TASK_STATUS,
      title,
      description,
    }

    if (impact.pmId !== null) {
      payload.assignee_profile_id = impact.pmId
    }

    const { data: created, error: insertError } = await supabase
      .from('job_tasks')
      .insert(payload)
      .select('id')
      .single()

    if (insertError) throw insertError
    if (created) createdTaskIds.push((created as { id: string }).id)
  }

  return { createdTaskIds, skippedExistingImpactScheduleIds }
}
```

---

## B. Exact Duplicate-Prevention Rule Implemented

For each impact, before creating a task the function queries:

```
job_tasks WHERE
  job_id            = impact.jobId
  linked_schedule_id = impact.scheduleId
  task_type          = 'call_task'
```

The query returns all matching rows regardless of status. Each returned row is passed through `isOpenTaskStatus(row.status)`.

**`isOpenTaskStatus` rule:**
- `null` or `undefined` → `true` (no status = treated as open)
- `'complete'`, `'completed'`, `'closed'`, `'cancelled'` (case-insensitive) → `false`
- Everything else (including `'open'`, `'in_progress'`, `'blocked'`, any unknown value) → `true`

If **any** matching row is open, the impact is skipped and `impact.scheduleId` is pushed to `skippedExistingImpactScheduleIds`. No new task is created.

If **all** matching rows are closed/complete/cancelled, or **no** matching rows exist, a new task is created.

**What is NOT used for duplicate detection:**
- `title` — title text is not part of the match key
- `description` — not part of the match key
- `assignee_profile_id` — not part of the match key
- Date fields — not part of the match key

The identity of a "duplicate" is: same job + same schedule item + same task type, and the existing task is still open.

---

## C. Exact Task Fields Written

| Field | Value | Notes |
|---|---|---|
| `job_id` | `impact.jobId` | Required |
| `linked_schedule_id` | `impact.scheduleId` | Links task to the schedule item |
| `task_type` | `'call_task'` | Constant |
| `status` | `'open'` | Constant on creation |
| `title` | `buildCallTaskTitle(impact.companyName)` | `'Call ${companyName}'` or `'Call company'` |
| `description` | `'Confirmed start date shifted: {old} → {new}'` | Short summary |
| `assignee_profile_id` | `impact.pmId` | Only written when `impact.pmId !== null` |

**Fields intentionally omitted:**
- `due_at` — no due date is appropriate for a system-triggered call task; the urgency is implicit from the schedule shift
- `requires_file_upload` — defaults to `false` in DB; not relevant for a call task
- `visible_to_external` — defaults to `false` in DB; call tasks are internal PM reminders

**`buildCallTaskTitle` behavior:**
- `companyName = 'Smith Framing'` → `'Call Smith Framing'`
- `companyName = '  '` (whitespace only) → `'Call company'`
- `companyName = null` → `'Call company'`

**Description format:**
```
Confirmed start date shifted: 2026-04-01 → 2026-04-15
```
Null dates render as `—`.

---

## D. Assumptions Made

1. **`linked_schedule_id` and `assignee_profile_id` are spec-required but absent from existing UI insert code.** The existing `job_tasks` insert in `JobTabs.tsx` does not write these fields — the UI task form does not expose them yet. However, the spec explicitly names them. They are assumed to exist as DB columns (the schedule module is purpose-built to use them) but simply have no UI surface yet. If they do not exist in the DB schema, Supabase will return an error on insert, which will be thrown per the "throw on any Supabase error" rule. This is the fail-loudly behavior appropriate for a schema mismatch.

2. **`call_task` is not in the current UI's `TASK_TYPE_OPTIONS` list but is valid as a DB value.** The UI restricts its dropdown to `['general', 'inspection', 'delivery', 'approval', 'meeting', 'punch_list', 'other']`. There is no DB-level enum constraint visible in the codebase — `task_type` is a plain string column. System-triggered tasks using `'call_task'` can coexist with manually-created tasks; they are distinguished by `task_type` rather than by a separate table.

3. **Serial execution (not parallel).** Each impact is checked and potentially inserted one at a time in `for...of` order. This preserves impact order in both output arrays and avoids race conditions where two concurrent calls for the same impact could both pass the open-task check before either creates. For the expected volume (< 10 impacts per apply), serial performance is acceptable.

4. **`isOpenTaskStatus` returns `true` for `null`/`undefined` status.** A task row with no status value is treated as open (it will block duplicate creation). This is conservative: it is safer to skip a task creation when the existing status is ambiguous than to create a duplicate.

5. **`isOpenTaskStatus` returns `true` for unknown status values.** Any status not in the closed list (including custom or future statuses like `'in_progress'`, `'blocked'`, `'on_hold'`) is treated as open. This is also conservative and consistent with the intent of the check: if there is any active engagement on the task, do not create another.

6. **`assignee_profile_id` is conditionally included.** The key is only added to the insert payload when `impact.pmId !== null`. Omitting it (rather than setting it to `null`) allows the DB default to apply and avoids sending an explicit null for a foreign key that might have a NOT NULL constraint. If the column is nullable, sending `null` would also be fine, but conditional inclusion is the safer pattern.

7. **The description is a single line.** The spec says "short summary." A one-line format is used rather than multi-line markdown to keep the task list clean for the PM reviewing it.

8. **Errors are not wrapped or enriched.** Both query and insert Supabase errors are thrown exactly as received. The caller (a future server action or API route) owns error handling and messaging.

---

## E. TypeScript Errors Encountered

One error in `src/lib/schedule/taskTriggers.ts`:
```
src/lib/schedule/taskTriggers.ts(1,37): error TS2307: Cannot find module '@supabase/supabase-js'
or its corresponding type declarations.
```

Pre-existing environment error from missing `node_modules`. Identical to all other files importing from `@supabase/supabase-js`. No new errors introduced.

The `(t: { status: string | null })` annotation on the `.some()` callback and the `(created as { id: string })` cast on the insert result are required because `job_tasks` has no TypeScript row type in the codebase — the table is queried via `any`-typed Supabase calls throughout. These casts narrow the `any` to the minimum shape needed.

---

## F. Edge Cases Intentionally Deferred

1. **Race condition between check and create.** Two concurrent calls to `createScheduleTriggeredCallTasks` for the same impact could both pass the "no open task exists" check before either has inserted, resulting in two tasks being created. A DB unique constraint on `(job_id, linked_schedule_id, task_type)` (filtered to `status = 'open'`) would be the correct mitigation. That constraint is a DB migration, not a TypeScript change, and is deferred.

2. **Closed task exists, then a new shift occurs.** If a previous call task for a schedule item was closed (`complete`/`cancelled`), and then the schedule shifts again (a new apply is run), a new task will be created. This is the intended behavior — a new shift is a new action item. However, the closed task remains in `job_tasks` alongside the new one, which may cause UI clutter. No archival or filtering logic is implemented here.

3. **Company name from the `companies` table.** `companyName` comes from `sub_name` on the schedule item (a denormalized free-text field). The canonical company record with verified name, phone, and contacts lives in `companies`. A future improvement could look up the canonical name, especially if the sub changed companies after the item was created. Deferred per spec.

4. **`assignee_profile_id` behavior when column does not exist.** If the DB does not have this column yet, the insert will fail. The Supabase error will propagate. No fallback to inserting without the field is implemented — the spec says throw on errors, not silently degrade.

5. **PM task visibility and routing.** `visible_to_external` is left at its DB default (`false`). A future product decision may want `call_task` items to be visible to a client portal or sub portal. Not applicable for an internal PM call reminder, but deferred.

6. **Bulk insert optimization.** Each impact results in one SELECT (check) + optionally one INSERT. For N impacts that all need tasks, this is 2N round trips. A future optimization could batch the SELECT checks into a single query and the inserts into a single `.insert([...])` call. Not implemented — the expected volume is small.
