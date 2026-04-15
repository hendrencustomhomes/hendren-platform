# Schedule Module — R20 Deliverables

**Date:** 2026-04-11
**Branch:** `claude/audit-schedule-module-WJyaY`
**Files changed:**
- `src/app/schedule/baseline/page.tsx` (new)
- `src/app/schedule/ScheduleEditClient.tsx` (modified)

---

## A. Exact Files Changed

### `src/app/schedule/baseline/page.tsx` (new)

New server component at route `/schedule/baseline?job=<jobId>`. Read-only overlay page showing baseline vs current dates with working-day variance per schedule item.

Key sections:

1. **Auth guard** — `redirect('/login')` if no user session.
2. **No `jobId` param** — renders "Select a job to view its baseline." with no back link.
3. **No baseline** — renders "No baseline has been set for this job." with back link to `/schedule?job=<jobId>`.
4. **Schedule fetch error** — renders "Failed to load schedule data." with back link.
5. **Main view** — header with job client name, Baseline Active badge, baseline creation date, back link; read-only table.

Local helpers:

```typescript
function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
```

Avoids UTC-to-local timezone shift that `new Date(isoString)` produces for date-only strings.

```typescript
function workingDayVariance(
  baseline: string,
  current: string,
  flags: WeekendFlags
): number {
  const b = parseDateLocal(baseline)
  const c = parseDateLocal(current)
  if (b.getTime() === c.getTime()) return 0
  const [earlier, later] = b < c ? [b, c] : [c, b]
  const sign = b < c ? 1 : -1
  return sign * (workingDayDiff(earlier, later, flags) - 1)
}
```

`workingDayDiff` counts days inclusive of both endpoints. Subtracting 1 converts it from a duration to a shift count. Positive = slip (current is later than baseline), negative = ahead.

Table columns: Trade, Company, Baseline Start, Current Start, Start Variance, Baseline End, Current End, End Variance.

Variance display:
- `+N days` in red (`#dc2626`) — schedule slipped
- `-N days` in green (`#16a34a`) — schedule ahead
- `0 days` in muted — on baseline
- `—` when either baseline or current date is null

Supabase query selects: `id, status, trade, sub_name, start_date, end_date, baseline_start_date, baseline_end_date, include_saturday, include_sunday, jobs(client_name, color)`.
Ordered by `start_date` ascending, nulls last.

### `src/app/schedule/ScheduleEditClient.tsx` (modified)

In the baseline toolbar, added a "View Baseline" `<Link>` rendered immediately after the "Baseline Active" `<span>` when `baselineStatus === true`. The two elements are wrapped in a React Fragment (`<>`).

```tsx
{baselineStatus === true ? (
  <>
    <span ...>● Baseline Active</span>
    <Link
      href={`/schedule/baseline?job=${jobId}`}
      style={{
        fontSize: '13px',
        color: 'var(--blue)',
        textDecoration: 'none',
        fontWeight: 500,
      }}
    >
      View Baseline
    </Link>
  </>
) : ...}
```

The link is only rendered when `baselineStatus === true` — it does not appear in the `false` (no baseline) or `null` (unavailable) states.

---

## B. Route and Data Flow

`/schedule/baseline?job=<jobId>` is a server component. It:

1. Creates a Supabase client and verifies auth.
2. Calls `getJobBaseline(supabase, jobId)` — same helper used in `/schedule?job=<jobId>`.
3. If baseline present, fetches `sub_schedule` rows for the job including `baseline_start_date` and `baseline_end_date`.
4. Renders the variance table client-side by computing `workingDayVariance` for each row.

No client state. No `useTransition`. No mutations. Entirely read-only.

---

## C. Variance Formula Detail

`workingDayDiff(start, end, flags)` from `engine.ts` returns an inclusive day count. Examples:

| baseline | current | diff | variance |
|---|---|---|---|
| Mon | Mon | 1 | `(1-1)*1 = 0` |
| Mon | Wed | 3 | `(3-1)*1 = +2` (slipped 2 days) |
| Wed | Mon | 3 | `(3-1)*-1 = -2` (ahead 2 days) |

The `-1` in the formula converts "duration between two dates" into "number of intervening working days the schedule moved."

---

## D. Entry Point from `/schedule?job=...`

The "View Baseline" link in `ScheduleEditClient` is the only entry point to the baseline overlay. It is:
- A standard `<Link>` (Next.js client-side navigation)
- Rendered inline in the baseline toolbar, to the right of the Baseline Active indicator
- Not a button — no click handler, no transition
- Only visible when `baselineStatus === true`

---

## E. Assumptions Made

1. **`parseDateLocal` is required for correct variance.** `new Date('2025-05-01')` in a UTC-behind timezone resolves to April 30. `parseDateLocal` constructs a local midnight date, consistent with how the schedule editor stores and displays dates.

2. **Variance is computed per-row with per-row weekend flags.** Each `sub_schedule` row carries its own `include_saturday` / `include_sunday` flags. The variance for a row is computed using those flags, matching how the schedule engine treats that row's working days.

3. **Rows with null `baseline_start_date` or `baseline_end_date` show `—` for variance.** This occurs for items added after the baseline was set — their baseline fields were not snapshotted. Displaying `—` rather than `0` correctly signals that no comparison is possible, not that the item is on schedule.

4. **The baseline page is only reachable from the schedule page.** The back link always points to `/schedule?job=<jobId>`. No standalone nav entry or breadcrumb was added.

5. **`getJobBaseline` is called independently on the baseline page.** The baseline page does not inherit state from the schedule page. It fetches the baseline row itself, ensuring the page is always correct on direct load or refresh.

---

## F. TypeScript Errors Encountered

All errors in both changed files are pre-existing environment errors from missing `node_modules`:

```
src/app/schedule/baseline/page.tsx(1,18): error TS2307: Cannot find module 'next/link'
src/app/schedule/baseline/page.tsx(2,26): error TS2307: Cannot find module 'next/navigation'
src/app/schedule/ScheduleEditClient.tsx(3,50): error TS2307: Cannot find module 'react'
src/app/schedule/ScheduleEditClient.tsx(4,18): error TS2307: Cannot find module 'next/link'
```

Cascading JSX element errors and `Parameter 'prev' implicitly has an 'any' type` in `ScheduleEditClient.tsx` are pre-existing from R18. No new errors introduced by R20 changes.

---

## G. Edge Cases Intentionally Deferred

1. **Items added after baseline show `—` for variance.** Correct behavior — no baseline to compare against. A future enhancement could display an "Added after baseline" indicator. Deferred.

2. **Items removed from schedule still have baseline rows.** Currently the page shows all rows in `sub_schedule` for the job. Cancelled or removed items are not filtered out. Deferred — row filtering by status is a product decision.

3. **No summary row.** The table shows per-item variance only. A summary row (e.g., "Project end variance: +5 days") would require identifying the last row or a critical path item. Deferred.

4. **No print or export.** The page is browser-only. PDF export or CSV download deferred.

5. **No baseline date in page title on no-job-param path.** The no-job-param empty state renders a generic "Baseline" nav title with no job context. This is correct — there is no job to reference. If a job selector is ever added to the baseline page, the title could be updated dynamically.
