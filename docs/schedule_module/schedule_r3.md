# Schedule Module — R3 Deliverables

**Date:** 2026-04-10
**Branch:** `dev`
**Files changed:**
- `src/lib/schedule/labor.ts` (new)
- `src/app/schedule/sub/new/page.tsx` (import + state + handlers + UI + payload)
- `src/app/schedule/sub/[id]/edit/page.tsx` (import + type + state + handlers + load + UI + payload)

---

## A. Full Contents of `src/lib/schedule/labor.ts`

```typescript
import { workingDayAdd, workingDayDiff } from './engine'
import type { WeekendFlags } from './engine'

export type { WeekendFlags }

export function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDateToISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function normalizeFromStartAndEnd(
  start: Date,
  end: Date,
  flags: WeekendFlags
): { durationWorkingDays: number } {
  return { durationWorkingDays: workingDayDiff(start, end, flags) }
}

export function normalizeFromStartAndDuration(
  start: Date,
  duration: number,
  flags: WeekendFlags
): { endDate: Date } {
  return { endDate: workingDayAdd(start, duration, flags) }
}

export function applyWeekendInference(
  start: Date,
  flags: WeekendFlags
): WeekendFlags {
  const day = start.getDay()
  return {
    includeSaturday: day === 6 ? true : flags.includeSaturday,
    includeSunday: day === 0 ? true : flags.includeSunday,
  }
}
```

**Notes:**
- `parseDateLocal` and `formatDateToISO` are exported because both pages need them for safe local-timezone date roundtripping. `new Date('YYYY-MM-DD')` parses as UTC midnight and can shift the date in negative-offset timezones; parsing as local avoids this.
- `normalizeFromStartAndEnd` and `normalizeFromStartAndDuration` delegate entirely to `workingDayAdd` / `workingDayDiff` from `engine.ts`. No logic is duplicated.
- `WeekendFlags` is re-exported from `labor.ts` so pages only need one import source.

---

## B. Exact Changes in `/schedule/sub/new`

### Import added
```typescript
import {
  normalizeFromStartAndEnd,
  normalizeFromStartAndDuration,
  applyWeekendInference,
  formatDateToISO,
  parseDateLocal,
} from '@/lib/schedule/labor'
```

### Form state — new fields added
```typescript
const [form, setForm] = useState({
  // ... existing fields unchanged ...
  duration_working_days: 1,
  include_saturday: false,
  include_sunday: false,
  buffer_working_days: 0,
})
```

### Handlers added (before `handleReleaseToggle`)

`handleStartDateChange(value: string)`
- If value is empty: clears start, end, resets duration to 1
- Calls `applyWeekendInference` on the new start date
- If a valid end exists (end >= start): recomputes duration via `normalizeFromStartAndEnd`
- If no valid end: sets end = start, duration = 1 (first date tap behavior)

`handleEndDateChange(value: string)`
- If value is empty or no start: sets end only, no recomputation
- If end < start: sets end without recomputation (allows correction)
- If end >= start: recomputes duration via `normalizeFromStartAndEnd`

`handleDurationChange(value: string)`
- Ignores invalid or < 1 input (no state update, field snaps back)
- If no start date: updates duration only
- If start exists: recomputes end via `normalizeFromStartAndDuration`, updates both

`handleWeekendFlagChange(flag, value)`
- If no start: updates flag only
- If start exists: recomputes end from start + current duration + new flags

### onChange handlers updated in JSX
```tsx
// Start date
onChange={(e) => handleStartDateChange(e.target.value)}

// End date
onChange={(e) => handleEndDateChange(e.target.value)}
```

### UI added (after Start/End date grid, before Status)
- 2-column grid: **Duration (Working Days)** input + **Buffer (Working Days)** input
- Flex row: **Include Saturdays** checkbox + **Include Sundays** checkbox

### Submit payload — new fields added
```typescript
duration_working_days: form.duration_working_days,
buffer_working_days: form.buffer_working_days,
include_saturday: form.include_saturday,
include_sunday: form.include_sunday,
```

No existing fields removed. No API route changed.

---

## C. Exact Changes in `/schedule/sub/[id]/edit`

### Import added
Same as create page.

### `ScheduleFormState` type — new fields added
```typescript
type ScheduleFormState = {
  // ... existing fields unchanged ...
  duration_working_days: number
  include_saturday: boolean
  include_sunday: boolean
  buffer_working_days: number
}
```

### `EMPTY_FORM` — new defaults added
```typescript
const EMPTY_FORM: ScheduleFormState = {
  // ... existing defaults unchanged ...
  duration_working_days: 1,
  include_saturday: false,
  include_sunday: false,
  buffer_working_days: 0,
}
```

### DB select — new columns added
```
duration_working_days,
include_saturday,
include_sunday,
buffer_working_days
```
Added to existing `sub_schedule` select. No joins changed, no other queries touched.

### `setForm` in load — duration inference added
```typescript
const includeSat: boolean = data.include_saturday ?? false
const includeSun: boolean = data.include_sunday ?? false
const startStr: string = data.start_date || ''
const endStr: string = data.end_date || ''

let durationWorkingDays: number = data.duration_working_days ?? 1
if (!data.duration_working_days && startStr && endStr) {
  const s = parseDateLocal(startStr)
  const e = parseDateLocal(endStr)
  if (e >= s) {
    const { durationWorkingDays: computed } = normalizeFromStartAndEnd(
      s, e,
      { includeSaturday: includeSat, includeSunday: includeSun }
    )
    durationWorkingDays = computed
  }
}
```
For existing rows without `duration_working_days` stored: duration is computed from `start_date` + `end_date` on load. If neither is stored or end < start, defaults to 1.

### Handlers added (before `handleSave`)
Same four handlers as create page: `handleStartDateChange`, `handleEndDateChange`, `handleDurationChange`, `handleWeekendFlagChange`. Identical logic.

### onChange handlers updated in JSX
Same as create page.

### UI added (after Start/End date grid, before Status)
Same UI as create page: Duration + Buffer inputs, Include Saturdays + Include Sundays checkboxes.

### `handleSave` payload — new fields added
```typescript
duration_working_days: form.duration_working_days,
buffer_working_days: form.buffer_working_days,
include_saturday: form.include_saturday,
include_sunday: form.include_sunday,
```
Added after `updated_at`. No existing fields removed. Release/confirm behavior unchanged.

---

## D. Remaining Duplicate Normalization Logic

None. The four handlers (`handleStartDateChange`, `handleEndDateChange`, `handleDurationChange`, `handleWeekendFlagChange`) are structurally identical in both pages but are not extracted to a shared location. This is intentional at this stage — the handlers are co-located with their form state and have no cross-page dependencies. Extracting them would require a custom hook or higher-order component, which is out of scope for R3.

The date math itself (`workingDayAdd`, `workingDayDiff`) is centralized in `engine.ts`. The normalization wrappers are centralized in `labor.ts`. The pages contain only wiring logic, no arithmetic.

---

## E. TypeScript Errors Encountered

No errors introduced by these changes.

`src/lib/schedule/labor.ts` — zero TypeScript errors.

Pre-existing errors in the page files (present before this work):
- `Cannot find module 'react'` / `Cannot find module 'next/navigation'` — `node_modules` not installed in environment
- Implicit `any` parameter errors in existing callbacks — pre-existing
- JSX intrinsic element errors — caused by missing React type declarations; pre-existing

The new imports (`@/lib/schedule/labor`) produce no errors in either page file.
