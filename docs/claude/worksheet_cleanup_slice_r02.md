# Worksheet Cleanup Slice — Report 02

**Date:** 2026-05-01
**Branch:** dev
**Commit:** 443a8c9

---

## Objective

Extract the embedded `MobileView` function from `JobWorksheetTableAdapter.tsx`
into a dedicated presentational component. No behavior change. No logic added
or removed. Slice 01 (formatter extraction) is a prerequisite and was complete
before this work began.

---

## Files Created

### `src/app/jobs/[id]/takeoff/JobWorksheetMobileView.tsx`

Presentational component that renders the mobile worksheet UI.

**Exact items moved from the adapter:**

| Item | Kind |
|---|---|
| `MobileView` (renamed `JobWorksheetMobileView`) | React component |

The component receives all data via explicit props and fires callbacks —
no state ownership, no hooks, no business logic, no persistence.

**Props type (new — replaces the former `any`):**

```ts
type Props = {
  rows: JobWorksheetRow[]
  commitCellValue: (rowId: string, field: string, value: string) => void
  createDraftRowAfter?: () => void
}
```

**Imports:**
- `type JobWorksheetRow` from the adapter (type-only; no runtime circular dependency)
- `unitOptions`, `rowTotal`, `currency`, `parentSubtotal`, `validationLabel`
  from `./_worksheetFormatters` (already extracted in Slice 01)

---

## Files Modified

### `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx`

- **Removed:** `MobileView` function (47 lines)
- **Added:** `import { JobWorksheetMobileView }` from the new file
- **Trimmed formatter imports:** `parentSubtotal` and `validationLabel` removed
  — they are no longer used in the adapter (only in `JobWorksheetMobileView`)
- **Mobile render path** changed from:
  ```tsx
  if (isMobile()) return <MobileView {...props} />
  ```
  to explicit prop pass:
  ```tsx
  if (isMobile()) return (
    <JobWorksheetMobileView
      rows={rows}
      commitCellValue={props.commitCellValue}
      createDraftRowAfter={props.createDraftRowAfter}
    />
  )
  ```

---

## Confirmation: No Behavior Change

The JSX tree rendered by `JobWorksheetMobileView` is byte-for-byte identical
to the former `MobileView`. All inline styles, event handlers, conditional
renders, and the `<datalist>` element are preserved exactly. The only
differences are:

1. The component is now a named export in a separate file.
2. Props are explicitly typed instead of `any`.
3. The adapter passes props by name instead of spreading the full `props` bag.

---

## Type Changes

| Location | Before | After |
|---|---|---|
| `MobileView` props | `{ rows, commitCellValue, createDraftRowAfter }: any` | Explicit `Props` type — no `any` |
| `rows.map` row variable | inferred as `JobWorksheetRow` (via cast) | inferred as `JobWorksheetRow` (via typed array) |

No `any` was added. One `any` boundary (`MobileView` props) was eliminated.

---

## What Was NOT Touched

- `useWorksheetInteraction.ts`
- `useWorksheetVirtualization.ts`
- `worksheetTypes.ts`
- `useJobWorksheetState.ts`
- `useJobWorksheetPersistence.ts`
- `EditableDataTable.tsx`
- `JobWorksheetPageOrchestrator.tsx`
- `src/app/jobs/[id]/worksheet/page.tsx`
- `_worksheetFormatters.ts`
- `isMobile()` function (stays in adapter — breakpoint detection, not UI)
- `getColumns()` function (unchanged)
- Desktop render path (unchanged)
- All keyboard handling, autosave, row creation, delete, and undo logic

---

## Build Result

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass |
| TypeScript | Pass |
| Static prerender | Pre-existing Supabase env-var failure (`/more/companies`) — unrelated to this change, present on all local builds without credentials |
