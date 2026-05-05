# Worksheet Cleanup Slice — Report 03

**Date:** 2026-05-01
**Branch:** dev
**Commit:** 01bebb4

---

## Objective

Move `validationLabel` out of the general-purpose formatter file into a
dedicated validation helper file, separating display-formatting concerns from
validation-label concerns. Behavior is identical; this is purely a file
organisation step.

---

## Files Created

### `src/app/jobs/[id]/takeoff/_worksheetValidation.ts`

Single exported function:

```ts
export function validationLabel(row: JobWorksheetRow): string
```

**Logic:** unchanged verbatim from `_worksheetFormatters.ts`.

**Imports:**
- `type JobWorksheetRow` from `@/components/patterns/estimate/JobWorksheetTableAdapter` (type-only)
- `unitOptions` from `./_worksheetFormatters` (value import for the unit check)

No runtime circular dependency — the dependency graph is acyclic:
```
_worksheetValidation → _worksheetFormatters → JobWorksheetTableAdapter (type only)
```

---

## Files Modified

### `src/app/jobs/[id]/takeoff/_worksheetFormatters.ts`

- **Removed:** `validationLabel` export (7 lines).
- Everything else (`unitOptions`, `rowTotal`, `currency`, `parentSubtotal`,
  `getDepth`) is unchanged.

### `src/app/jobs/[id]/takeoff/JobWorksheetMobileView.tsx`

Import block updated:

**Before:**
```ts
import {
  unitOptions,
  rowTotal,
  currency,
  parentSubtotal,
  validationLabel,
} from './_worksheetFormatters'
```

**After:**
```ts
import {
  unitOptions,
  rowTotal,
  currency,
  parentSubtotal,
} from './_worksheetFormatters'
import { validationLabel } from './_worksheetValidation'
```

No other changes to this file.

---

## Exact Helper Moved

| Function | From | To |
|---|---|---|
| `validationLabel` | `_worksheetFormatters.ts` | `_worksheetValidation.ts` |

---

## Confirmation: No Behavior Change

The function body is copied verbatim. The logic (`Missing item`, `Missing qty`,
`Missing price`, `Invalid unit`) is identical. The `unitOptions` constant it
references is the same import from `_worksheetFormatters`. Call sites are
unchanged — `JobWorksheetMobileView` calls `validationLabel(row)` exactly as
before.

---

## Type Changes

None. No `any` added or removed. All types (`JobWorksheetRow`, return type
`string`) are preserved exactly.

---

## Build Result

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass |
| TypeScript | Pass |
| Static prerender | Pre-existing Supabase env-var failure (`/more/cost-codes`) — unrelated to this change |

---

## What Was NOT Touched

- `JobWorksheetTableAdapter.tsx`
- `useWorksheetInteraction.ts`
- `useWorksheetVirtualization.ts`
- `worksheetTypes.ts`
- `useJobWorksheetState.ts`
- `useJobWorksheetPersistence.ts`
- `EditableDataTable.tsx`
- `JobWorksheetPageOrchestrator.tsx`
- `src/app/jobs/[id]/worksheet/page.tsx`
- `isMobile()`, `getColumns()`, desktop render path
- All keyboard handling, autosave, row creation, delete, undo logic
- Validation rules (no rules added, changed, or removed)
