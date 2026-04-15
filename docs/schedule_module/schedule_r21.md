# Schedule Module — R21 Deliverables

**Date:** 2026-04-11
**Branch:** `dev`
**Files changed:**
- `src/app/schedule/baseline/page.tsx` (modified)

---

## A. Exact Files Changed

### `src/app/schedule/baseline/page.tsx`

Added `DatePairState` type and `classifyDatePair` helper. Updated per-row variance computation to use `classifyDatePair`. Added `'Incomplete'` sub-label to baseline date cells when state is `'no-baseline'`. Added one legend line below the table. Removed implicit assumption that null baseline dates indicate post-baseline insertion.

**New type:**
```typescript
type DatePairState = 'ok' | 'no-current' | 'no-baseline' | 'no-dates'
```

**New helper:**
```typescript
function classifyDatePair(
  baselineDate: string | null,
  currentDate: string | null
): DatePairState {
  if (baselineDate && currentDate) return 'ok'
  if (!baselineDate && currentDate) return 'no-baseline'
  if (baselineDate && !currentDate) return 'no-current'
  return 'no-dates'
}
```

**Updated per-row computation:**
```typescript
const startState = classifyDatePair(row.baseline_start_date, row.start_date)
const endState = classifyDatePair(row.baseline_end_date, row.end_date)

const startVariance =
  startState === 'ok'
    ? workingDayVariance(row.baseline_start_date!, row.start_date!, flags)
    : null

const endVariance =
  endState === 'ok'
    ? workingDayVariance(row.baseline_end_date!, row.end_date!, flags)
    : null
```

Non-null assertions (`!`) are safe because the `'ok'` guard guarantees both values are non-null strings.

**Updated baseline date cell rendering (start column; end column identical):**
```tsx
<td style={tdStyle()}>
  {fmtDate(row.baseline_start_date)}
  {startState === 'no-baseline' && (
    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
      Incomplete
    </div>
  )}
</td>
```

**Legend added below table (when rows present):**
```tsx
<div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px', paddingLeft: '2px' }}>
  — Comparison unavailable (dates not set or incomplete baseline data)
</div>
```

---

## B. Exact Baseline Row-Handling Behavior After Cleanup

Each row is classified independently for its start and end date pair via `classifyDatePair`:

| State | baseline_date | current_date | Variance cell | Baseline date cell |
|---|---|---|---|---|
| `ok` | non-null | non-null | Working-day variance | Date formatted |
| `no-current` | non-null | null | `—` | Date formatted |
| `no-baseline` | null | non-null | `—` | `—` + "Incomplete" sub-label |
| `no-dates` | null | null | `—` | `—` |

Variance is only computed when state is `'ok'`. All other states produce `null` variance and render `—`.

Variance sign convention (unchanged from R20):
- Positive → current is later than baseline → slip → red
- Negative → current is earlier than baseline → ahead → green
- Zero → on baseline → muted

---

## C. How Newly Added Post-Baseline Items Are Treated

The page no longer treats null baseline dates as an expected state for items added after baseline activation. The product model is:

> A DB trigger auto-populates `baseline_start_date` and `baseline_end_date` for every newly inserted `sub_schedule` row on a job with an active baseline, setting them equal to the initial `start_date` and `end_date`.

Therefore, items added after baseline activation should:
- Have non-null `baseline_start_date` and `baseline_end_date`
- Show 0 days variance (baseline equals current on insertion)
- Appear as `ok` rows, not orphaned

The baseline page reflects this: newly added items with properly populated baseline dates compute normally and show `0 days`.

---

## D. How Incomplete/Null Baseline Rows Are Treated

If a row has `baseline_start_date = null` or `baseline_end_date = null` while the corresponding current date is non-null (state `'no-baseline'`), the page treats this as an **incomplete baseline data anomaly**, not a normal post-baseline item state.

Display:
- Baseline date cell shows `—` with a subtle `Incomplete` sub-label (11px, muted)
- Variance cell shows `—`

This correctly signals that the comparison is unavailable due to a data gap, not due to the item being on schedule.

Causes of this state:
- Row was inserted before the DB trigger was installed
- Trigger did not fire for some reason
- Baseline dates were manually cleared

No repair action is surfaced on the page. The state is informational only.

---

## E. Assumptions Corrected

**Corrected:** The R20 implementation and its documentation stated that null baseline dates occur "for items added after the baseline was set — their baseline fields were not snapshotted." This assumption is incorrect under the product model.

**Correct assumption (R21):** Items added after baseline activation receive baseline dates equal to their initial dates via DB trigger. Null baseline dates on an active-baseline job are a data anomaly, not an expected state for new items.

The code now encodes this assumption explicitly in the `DatePairState` type documentation and `classifyDatePair` behavior. The `'no-baseline'` state is labeled "Incomplete" rather than being silently rendered as `—`.

---

## F. TypeScript Errors Encountered

All errors in the changed file are pre-existing environment errors from missing `node_modules`:

```
src/app/schedule/baseline/page.tsx(1,18): error TS2307: Cannot find module 'next/link'
src/app/schedule/baseline/page.tsx(2,26): error TS2307: Cannot find module 'next/navigation'
```

All cascading JSX element errors (TS7026) and the `react/jsx-runtime` error (TS2875) are pre-existing from missing `react` types. No new errors introduced by R21 changes.

---

## G. Intentionally Deferred Edge Cases

1. **`no-current` state is not labeled.** A row with `baseline_start_date` set but `start_date = null` (item removed from schedule after baseline) renders `—` in the variance cell without a label. This is uncommon and not labeled to avoid clutter. Deferred.

2. **No repair action for `no-baseline` rows.** The "Incomplete" label is informational only. A future flow could offer to backfill baseline dates for incomplete rows. Deferred per task scope.

3. **Partial state within a row.** A row could have `startState === 'ok'` but `endState === 'no-baseline'` (start snapshotted, end not). The page handles this correctly per-column — start variance computes normally, end variance shows `—` with "Incomplete". No special treatment needed.

4. **`no-dates` state is fully silent.** When both baseline and current dates are null, only `—` is shown. No "Incomplete" label is added because the item has no current date either — it is genuinely unscheduled, not an anomaly.
