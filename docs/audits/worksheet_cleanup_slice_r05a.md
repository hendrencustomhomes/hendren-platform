# Worksheet Cleanup Slice — Report 05A

**Date:** 2026-05-01
**Branch:** claude/audit-worksheet-stability-nIwtF
**Commit:** 48b36ce

---

## Objective

Fix an inverted dependency direction identified in the Slice 04 critical assessment:
`src/app/jobs/[id]/takeoff/` (route layer) was being imported by
`src/components/patterns/estimate/JobWorksheetTableAdapter.tsx` (shared component layer).
Route-layer code should import from the shared component layer, not the other way around.

Co-locate the three worksheet helper files with the adapter so all worksheet module
files live in one directory with no cross-tree imports.

---

## Files Moved

| Old path | New path |
|---|---|
| `src/app/jobs/[id]/takeoff/_worksheetFormatters.ts` | `src/components/patterns/estimate/_worksheetFormatters.ts` |
| `src/app/jobs/[id]/takeoff/_worksheetValidation.ts` | `src/components/patterns/estimate/_worksheetValidation.ts` |
| `src/app/jobs/[id]/takeoff/JobWorksheetMobileView.tsx` | `src/components/patterns/estimate/JobWorksheetMobileView.tsx` |

Moved via `git mv` to preserve rename history.

---

## Import Changes

### `src/components/patterns/estimate/_worksheetFormatters.ts`

Before:
```ts
import type { JobWorksheetRow } from '@/components/patterns/estimate/JobWorksheetTableAdapter'
```

After:
```ts
import type { JobWorksheetRow } from './JobWorksheetTableAdapter'
```

### `src/components/patterns/estimate/_worksheetValidation.ts`

Before:
```ts
import type { JobWorksheetRow } from '@/components/patterns/estimate/JobWorksheetTableAdapter'
import { unitOptions } from '@/components/patterns/estimate/_worksheetFormatters'
```

After:
```ts
import type { JobWorksheetRow } from './JobWorksheetTableAdapter'
import { unitOptions } from './_worksheetFormatters'
```

### `src/components/patterns/estimate/JobWorksheetMobileView.tsx`

Before:
```ts
import type { JobWorksheetRow, JobWorksheetEditableCellKey } from '@/components/patterns/estimate/JobWorksheetTableAdapter'
```

After:
```ts
import type { JobWorksheetRow, JobWorksheetEditableCellKey } from './JobWorksheetTableAdapter'
```

### `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx`

Before:
```ts
import {
  unitOptions,
  rowTotal,
  currency,
  getDepth,
} from '@/app/jobs/[id]/takeoff/_worksheetFormatters'
import { JobWorksheetMobileView } from '@/app/jobs/[id]/takeoff/JobWorksheetMobileView'
```

After:
```ts
import {
  unitOptions,
  rowTotal,
  currency,
  getDepth,
} from './_worksheetFormatters'
import { JobWorksheetMobileView } from './JobWorksheetMobileView'
```

---

## Confirmation: No Behavior Change

No runtime logic changed. All changes are file moves and import path updates only.
Component contracts, rendering output, hook wiring, and persistence calls are identical.

---

## Build Result

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass — 4.6s |
| TypeScript | Pass — 7.4s |
| Static prerender | Pre-existing Supabase env-var failure — unrelated |

---

## Worksheet Module Directory — After Slice 05A

All worksheet files now live in `src/components/patterns/estimate/`:

```
src/components/patterns/estimate/
  JobWorksheetTableAdapter.tsx       ← adapter (exports types and component)
  JobWorksheetMobileView.tsx         ← mobile UI (moved from route layer)
  JobWorksheetPageOrchestrator.tsx   ← page-level wiring (unchanged)
  _worksheetFormatters.ts            ← pure display helpers (moved from route layer)
  _worksheetValidation.ts            ← validation logic (moved from route layer)
  _hooks/
    useJobWorksheetState.ts
    useJobWorksheetPersistence.ts
```

The `src/app/jobs/[id]/takeoff/` directory no longer contains any worksheet module
files. The route page (`src/app/jobs/[id]/worksheet/page.tsx`) imports only from
`src/components/patterns/estimate/`, which is the correct direction.

---

## What Was NOT Touched

- All engine files (`EditableDataTable`, `useWorksheetInteraction`, `useWorksheetVirtualization`, `worksheetTypes`)
- State and persistence hooks
- `JobWorksheetPageOrchestrator.tsx`
- All keyboard handling, undo logic, autosave, rendering behavior
- The DB schema and Supabase queries
