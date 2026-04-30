# Worksheet Stability Audit — Report 01

**Date:** 2026-04-30
**Branch:** dev
**Commit:** 78fbed8

---

## Objective

Audit and stabilize the Takeoff/Estimate worksheet after recent failed commits.
Verify dev matches the last known-good worksheet behavior and fix only regressions
or build blockers. No new features, no DB migrations, no broad refactors.

---

## Starting State

- Rebased `claude/audit-worksheet-stability-nIwtF` onto `origin/dev` (HEAD `228eb9f`).
- `npm run build` failed immediately with a hard error:

```
Export JobWorksheetTableAdapter doesn't exist in target module
The module has no exports at all.
```

---

## Root Cause

Commit `228eb9f` ("Fix worksheet generics + prevent unknown inference") **replaced
the entire `JobWorksheetTableAdapter.tsx`** with a bare 36-line code snippet:

```ts
'use client'

// PATCH: minimal safe fix
// IMPORTANT CHANGES ONLY:
// 1. explicit generics
// 2. no structural rewrite

const virt = useWorksheetVirtualization<JobWorksheetRow>({ ... })
const interaction = useWorksheetInteraction<JobWorksheetRow, ...>({ ... })

// KEEP EVERYTHING ELSE UNCHANGED
```

The snippet had no imports, no type exports, no component definition, and no
`export function JobWorksheetTableAdapter`. Every downstream file that imports
from this module (`JobWorksheetPageOrchestrator`, `useJobWorksheetState`,
`useJobWorksheetPersistence`) was broken at compile time.

---

## Fix Applied

**Single file changed:** `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx`

### What was done

1. **Restored** the complete 208-line component from commit `c577faa` (the last
   good version, one commit before `228eb9f`), preserving:
   - All exported types (`JobWorksheetRow`, `JobWorksheetEditableCellKey`, etc.)
   - `MobileView` component (non-destructive mobile path)
   - `getColumns` column definitions with indentation, currency formatting, delete button
   - `JobWorksheetTableAdapter` export with full `EditableDataTable` wiring

2. **Applied the generics** that `228eb9f` correctly identified as needed:
   - `useWorksheetVirtualization<JobWorksheetRow>({ ... })` — prevents `Row`
     from widening to `unknown`, fixing the `visibleRange` type mismatch
   - `useWorksheetInteraction<JobWorksheetRow, JobWorksheetEditableCellKey>({ ... })`

3. **Removed implicit `any`** from `getCellValue`:
   - Before: `getCellValue:(row:any,field:any)=>row[field]??''`
   - After: `getCellValue:(row,field)=>String(row[field]??'')` — types flow
     correctly from the explicit generics, no `any` needed

---

## Files Audited — No Changes Made

| File | Status |
|---|---|
| `useWorksheetInteraction.ts` | Clean. All keyboard handlers correct (Enter, Shift+Enter, Tab, Delete, Escape, Ctrl+Z, arrows). |
| `useWorksheetVirtualization.ts` | Clean. Generic `<Row>` already present. Resize observer correct. |
| `worksheetTypes.ts` | Clean. Minimal shared types, no regressions. |
| `useJobWorksheetState.ts` | Clean. Undo stack, backup/autosave, draft promotion, delete subtree, active-cell-after-delete all intact. |
| `useJobWorksheetPersistence.ts` | Clean. Supabase CRUD correct. |
| `EditableDataTable.tsx` | Clean. Checkbox, text, textarea, and static cell rendering all correct. |
| `JobWorksheetPageOrchestrator.tsx` | Clean. Status label, Add row button wired correctly. |
| `src/app/jobs/[id]/worksheet/page.tsx` | Clean. Auth guard, job lookup, row fetch, prop pass-through correct. |

---

## Build Result

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass |
| TypeScript | Pass |
| Static prerender | Fails on `/more/companies` — **pre-existing environment issue** (missing `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the local build context). Unrelated to worksheet. Passes on Vercel where env vars are set. |

---

## Behavioral Checklist

| Check | Verified (code-level) |
|---|---|
| Create row | `createDraftRowAfter()` inserts blank draft, focuses description |
| Shift+Enter creates child row | `createRow(rowId, true, currentValue)` on `Shift+Enter` |
| Rapid typing + Enter persists | `commitActiveCell({ move:'down', draftValue:currentValue })` captures live input |
| Tab does not clear or jump backward | `commitActiveCell({ move:'right', draftValue })` on Tab; `move:'left'` on Shift+Tab |
| Delete key deletes row | `event.key === 'Delete'` → `deleteRow(rowId)` |
| Red ✕ button deletes row | `onClick={()=>onDeleteRow(row.id)}` in `getColumns` |
| Undo restores deleted/edited rows | `handleUndo` pops undo stack, restores via `restoreRows` or `replaceLocalRow` |
| Active cell stays selected after delete | `findNextActiveRowAfterDelete` picks next row; `setActiveCellSync` called |
| No fake $0 values | `currency(val)` returns `''` for falsy — zero is suppressed |
| Local backup/autosave intact | `writeBackup` / `readBackup` / `clearBackup` unchanged |
| Desktop behavior not regressed | `isMobile()` guard preserved; desktop path unchanged |

---

## Conclusion

One commit (`228eb9f`) was the sole cause of the worksheet breakage. The fix
restores the last good file and applies only the intended generic annotation.
No hooks, state machines, persistence logic, or table rendering changed.
