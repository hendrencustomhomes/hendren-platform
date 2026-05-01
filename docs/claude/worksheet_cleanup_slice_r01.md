# Worksheet Cleanup Slice — Report 01

**Date:** 2026-05-01
**Branch:** dev
**Commit:** 4ca9111

---

## Objective

First structural cleanup slice for the Takeoff / Estimate worksheet system.
Extract pure display/formatting helpers from `JobWorksheetTableAdapter.tsx`
into a co-located helper file. No behavior change, no engine changes, no DB
touches.

---

## Changes

### New file — `src/app/jobs/[id]/takeoff/_worksheetFormatters.ts`

Pure TypeScript (no JSX). Exports six helpers that were previously private to
the adapter:

| Export | Kind | Description |
|---|---|---|
| `unitOptions` | `const` | Allowed unit values tuple |
| `rowTotal` | function | `qty × unit_price`, returns 0 for missing values |
| `currency` | function | Formats a numeric value as `$0.00` or raw string for editing |
| `parentSubtotal` | function | Sum of child rows, falling back to parent's own total |
| `validationLabel` | function | Returns a display warning string for incomplete rows |
| `getDepth` | function | Returns indentation depth (0 or 1) based on `parent_id` |

The file imports `type JobWorksheetRow` from the adapter. This is a type-only
import — no runtime value is imported in that direction, so there is no
circular dependency at runtime. TypeScript resolves type-only cycles cleanly.

### Modified — `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx`

- Removed the six local definitions listed above.
- Added import of all six from `@/app/jobs/[id]/takeoff/_worksheetFormatters`.
- `MobileView`, `getColumns`, `isMobile`, `editableCellOrder`, all type
  exports, and the `JobWorksheetTableAdapter` component are unchanged.

### Type improvements made during extraction (not regressions)

| Location | Before | After |
|---|---|---|
| `currency` parameter | `val: any` | `val: unknown` |
| `validationLabel` unit check | `(row.unit ?? 'ea') as any` | `(unitOptions as readonly string[]).includes(…)` |

Both changes are strictly safer. No `any` was added; two `any` usages were
removed.

---

## Files Not Touched

- `useWorksheetInteraction.ts`
- `useWorksheetVirtualization.ts`
- `worksheetTypes.ts`
- `useJobWorksheetState.ts`
- `useJobWorksheetPersistence.ts`
- `EditableDataTable.tsx`
- `JobWorksheetPageOrchestrator.tsx`
- `src/app/jobs/[id]/worksheet/page.tsx`

No state, persistence, keyboard handling, autosave, row creation, delete,
undo, or mobile logic was touched.

---

## Build Result

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass |
| TypeScript | Pass |
| Static prerender | Pre-existing Supabase env-var failures (`/more/cost-codes`, `/jobs/new`) — unrelated to this change, present on all local builds without credentials |
