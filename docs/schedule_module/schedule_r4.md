# Schedule Module — R4 Deliverables

**Date:** 2026-04-10
**Branch:** `dev`
**Files changed:**
- `src/lib/db.ts` (new type + new helper)
- `src/lib/schedule/nodes.ts` (new)

---

## A. Full `ScheduleItemDependency` Type

```typescript
export type ScheduleItemDependency = {
  id: string
  job_id: string
  predecessor_type: 'schedule' | 'procurement'
  predecessor_id: string
  successor_type: 'schedule' | 'procurement'
  successor_id: string
  reference_point: 'start' | 'end'
  offset_working_days: number
  created_at: string
  updated_at: string
}
```

Added to `src/lib/db.ts` after `JobWithDetails`, before `CompanyType`.

---

## B. Full `getScheduleDependencies()` Helper

```typescript
export async function getScheduleDependencies(
  supabase: SupabaseClient,
  jobId: string
): Promise<ScheduleItemDependency[]> {
  const { data, error } = await supabase
    .from('schedule_item_dependencies')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as ScheduleItemDependency[]
}
```

Added to `src/lib/db.ts` immediately before `getCompanies`.

---

## C. Full Contents of `src/lib/schedule/nodes.ts`

```typescript
import type { JobSubSchedule, ProcurementItem } from '@/lib/db'

export type ScheduleNodeType = 'schedule' | 'procurement'

export type ScheduleNode = {
  key: string
  id: string
  type: ScheduleNodeType
  start_date: string | null
  end_date: string | null
  duration_working_days: number | null
  include_saturday: boolean
  include_sunday: boolean
  lead_days: number | null
  buffer_working_days: number
}

function makeScheduleNodeKey(type: ScheduleNodeType, id: string): string {
  return `${type}:${id}`
}

export function buildScheduleNodes(input: {
  subSchedule: JobSubSchedule[]
  procurementItems: ProcurementItem[]
}): Record<string, ScheduleNode> {
  const nodes: Record<string, ScheduleNode> = {}

  for (const row of input.subSchedule) {
    const key = makeScheduleNodeKey('schedule', row.id)
    nodes[key] = {
      key,
      id: row.id,
      type: 'schedule',
      start_date: row.start_date,
      end_date: row.end_date,
      duration_working_days: row.duration_working_days ?? null,
      include_saturday: row.include_saturday,
      include_sunday: row.include_sunday,
      lead_days: null,
      buffer_working_days: row.buffer_working_days,
    }
  }

  for (const row of input.procurementItems) {
    const key = makeScheduleNodeKey('procurement', row.id)
    nodes[key] = {
      key,
      id: row.id,
      type: 'procurement',
      start_date: row.required_on_site_date,
      end_date: row.required_on_site_date,
      duration_working_days: 1,
      include_saturday: false,
      include_sunday: false,
      lead_days: row.lead_days,
      buffer_working_days: row.buffer_working_days,
    }
  }

  return nodes
}
```

`makeScheduleNodeKey` is intentionally left unexported — it is an internal consistency helper with no current need to be called from outside this module.

---

## D. Assumptions Made

1. **`getScheduleDependencies` takes `SupabaseClient` as its first parameter.** The spec shows the signature as `getScheduleDependencies(jobId: string)` without a supabase parameter, but then says "use the existing server Supabase pattern already used in db.ts." Every existing helper in `db.ts` (`getJobFiles`, `getCompanyCompliance`, `getJobWithDetails`, `getCompanies`) takes `SupabaseClient` as its first argument — that is the pattern. Matching this keeps the function consistent with all callers in the file and avoids a hidden import that would require a different client initialization strategy.

2. **`select('*')` used for `schedule_item_dependencies`.** The spec says "do not join anything yet." A `select('*')` on a narrow table with a typed return is safe and explicit. If columns are added later, the type definition is the source of truth, not the query.

3. **`duration_working_days ?? null` for labor schedule nodes.** `JobSubSchedule.duration_working_days` is typed as `number | null | undefined` (optional `?`). `ScheduleNode.duration_working_days` is `number | null`. The `?? null` coercion collapses `undefined` to `null` cleanly.

4. **Procurement nodes use `required_on_site_date` for both `start_date` and `end_date`.** A procurement item is a point-in-time requirement, not a range. `duration_working_days = 1` reflects this. The engine can extend this when lead-time dependency traversal is implemented.

5. **`makeScheduleNodeKey` left unexported.** No current caller outside this module needs it. It can be exported later without a breaking change.

---

## E. TypeScript Errors Encountered

No errors introduced by these changes.

Pre-existing error in `src/lib/db.ts`:
```
src/lib/db.ts(1,32): error TS2307: Cannot find module '@supabase/supabase-js'
or its corresponding type declarations.
```
Caused by `node_modules` not being installed in the environment. Present before this session.

`src/lib/schedule/nodes.ts` — zero TypeScript errors.
