# Schedule Module — R1 Deliverables

**Date:** 2026-04-10
**Branch:** `dev`
**Files changed:** `src/lib/schedule/engine.ts` (new), `src/lib/db.ts` (type update)

---

## A. Full Contents of `engine.ts`

```typescript
export type WeekendFlags = {
  includeSaturday: boolean
  includeSunday: boolean
}

export type Dependency = {
  predecessorType: 'schedule' | 'procurement'
  predecessorId: string
  successorType: 'schedule' | 'procurement'
  successorId: string
  referencePoint: 'start' | 'end'
  offsetWorkingDays: number
}

function isWorkingDay(date: Date, flags: WeekendFlags): boolean {
  const day = date.getDay() // 0 = Sunday, 6 = Saturday

  if (day === 0 && !flags.includeSunday) return false
  if (day === 6 && !flags.includeSaturday) return false

  return true
}

export function workingDayAdd(
  start: Date,
  duration: number,
  flags: WeekendFlags
): Date {
  if (duration < 1) {
    throw new Error('duration must be >= 1')
  }

  let current = new Date(start)
  let daysAdded = 0

  while (true) {
    if (isWorkingDay(current, flags)) {
      daysAdded++
      if (daysAdded === duration) {
        return new Date(current)
      }
    }

    current = new Date(current)
    current.setDate(current.getDate() + 1)
  }
}

export function workingDayDiff(
  start: Date,
  end: Date,
  flags: WeekendFlags
): number {
  if (end < start) {
    throw new Error('end date cannot be before start date')
  }

  let current = new Date(start)
  let count = 0

  while (current <= end) {
    if (isWorkingDay(current, flags)) {
      count++
    }

    current = new Date(current)
    current.setDate(current.getDate() + 1)
  }

  return count
}

export function resolveScheduleForJob(jobId: string) {
  // TODO: will be implemented after data layer is wired
  return {
    items: [],
    dependencies: []
  }
}
```

---

## B. Updated `JobSubSchedule` Type

```typescript
export type JobSubSchedule = {
  id: string
  status: string
  start_date: string | null
  end_date: string | null
  trade: string
  sub_name: string | null
  notes: string | null

  // New schedule execution fields
  cost_code: string | null
  is_released: boolean | null
  release_date: string | null
  notification_window_days: number | null

  // Schedule engine fields
  confirmed_date?: string | null
  duration_working_days?: number | null
  buffer_working_days: number
  include_saturday: boolean
  include_sunday: boolean
  is_locked: boolean
}
```

---

## C. TypeScript Errors Encountered

No errors introduced by these changes.

One pre-existing error exists in `src/lib/db.ts`:

```
src/lib/db.ts(1,32): error TS2307: Cannot find module '@supabase/supabase-js'
or its corresponding type declarations.
```

This error exists in the repo prior to this work and is caused by `node_modules` not being present in the CI/lint environment. It is unrelated to the engine or type additions.

All other TypeScript errors in the output (`src/app/jobs/[id]/JobTabs.tsx`, `next/server`, etc.) are pre-existing and were present before this session.

---

## D. Assumptions Made

1. **`confirmed_date` and `duration_working_days` typed as optional (`?`)** — the spec added them without marking them required. The existing `sub_schedule` rows in the database do not yet have these columns, so optional was the only safe choice to avoid breaking existing reads via `getJobWithDetails()`.

2. **`buffer_working_days`, `include_saturday`, `include_sunday`, `is_locked` typed as required (non-nullable, no `?`)** — the spec listed them without `| null` or `?`. These will need database column defaults set before `getJobWithDetails()` query is updated to select them, or existing callers will receive `undefined` at runtime for rows missing these columns.

3. **`isWorkingDay` left unexported** — it is an internal helper not listed in the public API. If it needs to be tested directly it can be exported later without breaking anything.

4. **No `jobId` parameter validation in `resolveScheduleForJob`** — the spec says "stub only." No behavior was added beyond the specified return shape.
