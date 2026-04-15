# Schedule Module — R22 Deliverables

**Date:** 2026-04-11
**Branch:** `dev`
**Files changed:**
- `src/app/schedule/actions.ts` (modified)
- `src/app/schedule/ScheduleEditClient.tsx` (modified)

---

## A. Exact Files Changed

### `src/app/schedule/actions.ts`

`DraftScheduleItemUpdate` extended with two new fields:

```typescript
export type DraftScheduleItemUpdate = {
  id: string
  start_date: string | null
  duration_working_days: number | null
  include_saturday: boolean
  include_sunday: boolean
  buffer_working_days: number
  shift_reason_type: string | null
  shift_reason_note: string | null
}
```

`saveScheduleDraftAction` update payload extended to write both fields:

```typescript
.update({
  start_date: u.start_date,
  duration_working_days: u.duration_working_days,
  include_saturday: u.include_saturday,
  include_sunday: u.include_sunday,
  buffer_working_days: u.buffer_working_days,
  shift_reason_type: u.shift_reason_type,
  shift_reason_note: u.shift_reason_note,
})
```

No other changes to `actions.ts`.

### `src/app/schedule/ScheduleEditClient.tsx`

Four changes:

**1. `ScheduleDraftOverride` type extended:**

```typescript
type ScheduleDraftOverride = {
  start_date: string | null
  duration_working_days: number | null
  include_saturday: boolean
  include_sunday: boolean
  buffer_working_days: number
  shift_reason_type: string | null
  shift_reason_note: string | null
}
```

**2. `SHIFT_REASON_OPTIONS` constant added (module-level):**

```typescript
const SHIFT_REASON_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '— No reason' },
  { value: 'weather', label: 'Weather' },
  { value: 'owner_change', label: 'Owner change' },
  { value: 'material_delay', label: 'Material delay' },
  { value: 'trade_availability', label: 'Trade availability' },
  { value: 'mis_entry', label: 'Mis-entry' },
  { value: 'other', label: 'Other' },
]
```

**3. `setOverrideField` initializer updated** — when creating the first override for an item, `shift_reason_type: null` and `shift_reason_note: null` are added to the default:

```typescript
const existing: ScheduleDraftOverride = prev[itemId] ?? {
  start_date: original.start_date,
  duration_working_days: original.duration_working_days ?? null,
  include_saturday: original.include_saturday,
  include_sunday: original.include_sunday,
  buffer_working_days: original.buffer_working_days,
  shift_reason_type: null,
  shift_reason_note: null,
}
```

**4. `handleSave` map updated** — shift reason fields included in each `DraftScheduleItemUpdate`:

```typescript
return {
  id: item.id,
  start_date: override.start_date,
  duration_working_days: override.duration_working_days,
  include_saturday: override.include_saturday,
  include_sunday: override.include_sunday,
  buffer_working_days: override.buffer_working_days,
  shift_reason_type: override.shift_reason_type,
  shift_reason_note: override.shift_reason_note,
}
```

**5. Labor table header updated** — `'Shift Reason'` column added between `'Notes'` and `''` (edit link):

```
Job | Trade | Company | Status | Release | Start | End | Cost Code | Notes | Shift Reason | (edit)
```

**6. Shift reason cell added** per labor row — empty outside edit mode, controls in edit mode:

```tsx
<td style={tdStyle()}>
  {editMode ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <select value={override?.shift_reason_type ?? ''} onChange={...}>
        {SHIFT_REASON_OPTIONS.map(...)}
      </select>
      <input type="text" value={override?.shift_reason_note ?? ''} placeholder="Note (optional)" onChange={...} />
    </div>
  ) : null}
</td>
```

The `select` value `''` maps to `null` on change (`e.target.value || null`). The `input` value `''` maps to `null` on change (`e.target.value || null`). Both read from `override` (not from `item`) because `JobSubSchedule` does not yet include these fields.

---

## B. Exact Shift Reason UI Behavior

- **Location:** "Shift Reason" column in the labor table, after "Notes", before the Edit link.
- **Visible:** Only when `editMode === true`. Cell is empty (`null`) outside edit mode.
- **Controls:**
  - `<select>` for `shift_reason_type` — options: blank (null), weather, owner_change, material_delay, trade_availability, mis_entry, other. Default selection is blank.
  - `<input type="text">` for `shift_reason_note` — placeholder "Note (optional)". Default empty.
- **Dirty state:** Setting either field triggers `setOverrideField`, which creates an override for the row and marks it dirty. The dirty count in the toolbar reflects it.
- **Not required:** A user may save without setting a shift reason. The fields default to null and are written as null.
- **Not shown outside edit mode:** The Shift Reason cell renders `null` in read mode — no stored value is displayed back. The column header is always visible when the table renders.

---

## C. Exact Save Behavior

When `handleSave` is called:

1. All rows with a `draftOverrides[item.id]` entry are collected into `DraftScheduleItemUpdate[]`.
2. Each update now includes `shift_reason_type` and `shift_reason_note` from the override.
3. `saveScheduleDraftAction` writes all fields including shift reason to `sub_schedule` via Supabase `.update()`.
4. Null values are written as null — no special handling. If a user did not set a reason, both fields are written as null.
5. The pipeline (`runScheduleApplyPipeline`) runs after the update, unchanged.
6. `revalidatePath('/schedule')` invalidates the page on success.

Shift reason fields are written on every row that was dirty, even if the user only changed dates and left reason blank. This is correct — writing null is idempotent and does not corrupt existing data.

---

## D. Assumptions Made

1. **`sub_schedule` table has `shift_reason_type` and `shift_reason_note` columns.** The Supabase update writes these columns directly. If the columns do not exist in the DB, the update will fail at runtime with a Supabase error (which surfaces as a save error in the UI). Schema migration is out of scope for R22.

2. **Shift reason is not pre-populated from the stored row.** `JobSubSchedule` does not include `shift_reason_type` or `shift_reason_note`, so the override always initializes them to null. On re-editing a row that has a stored reason, the reason field will appear blank. Adding pre-population requires extending `JobSubSchedule` and the Supabase query in `page.tsx`. Deferred per task scope ("capture only").

3. **`shift_reason_type` empty string maps to null.** The select's `''` option corresponds to "no reason." On change, `e.target.value || null` converts `''` to `null`. This keeps the DB clean — no empty strings stored.

4. **Shift reason is row-level, not save-level.** A single save may include multiple rows with different (or null) reasons. There is no single "reason for this save" concept. Each row carries its own reason.

5. **Dirty state is not reason-aware.** If a user opens edit mode and sets only a shift reason without changing any dates, the row becomes dirty and will be saved. The dirty count increases. This is intentional — reason capture is a valid standalone edit.

6. **`db.ts` not modified.** Extending `JobSubSchedule` is not required for write-only capture. Deferred to a future round that adds read-back of stored reasons.

---

## E. TypeScript Errors Encountered

All errors in changed files are pre-existing environment errors from missing `node_modules`:

```
src/app/schedule/actions.ts(3,32): error TS2307: Cannot find module 'next/cache'
src/app/schedule/ScheduleEditClient.tsx(3,50): error TS2307: Cannot find module 'react'
src/app/schedule/ScheduleEditClient.tsx(4,18): error TS2307: Cannot find module 'next/link'
```

All cascading JSX element errors (TS7026), the `react/jsx-runtime` error (TS2875), and the `Parameter 'prev' implicitly has an 'any' type` error (TS7006) at line 205 are pre-existing. No new errors introduced by R22 changes.

---

## F. Intentionally Deferred Edge Cases

1. **Pre-population of stored shift reason on re-edit.** A row with an existing `shift_reason_type` in the DB will show blank in edit mode. Requires adding the fields to `JobSubSchedule` and the Supabase select query. Deferred.

2. **Read-mode display of stored shift reason.** The Shift Reason column is empty outside edit mode. Stored reasons are not shown. Deferred — requires `JobSubSchedule` extension.

3. **Shift reason validation.** No enforcement that a reason is required when dates change. Optional per product rules. No validation deferred.

4. **Procurement shift reasons.** Explicitly out of scope for R22.

5. **Shift reason history / log.** No audit trail of reason changes. Deferred per task scope.

6. **Shift reason on the baseline overlay page.** The baseline page does not show shift reason. Deferred.
