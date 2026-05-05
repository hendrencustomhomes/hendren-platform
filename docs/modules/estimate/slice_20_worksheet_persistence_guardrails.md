# Slice 20 — Worksheet Persistence Guardrails

**Status:** Completed
**Date:** 2026-05-03
**Branch:** dev

---

## 1. What Was Done

Closed the server-side enforcement gap left by Slice 19.

All `job_worksheet_items` mutations that previously went directly through client-side Supabase are now routed through server actions that enforce estimate editability before writing.

---

## 2. Files Changed

| File | Change |
|---|---|
| `src/app/actions/worksheet-item-actions.ts` | **New** — server actions for all worksheet item mutations |
| `src/components/patterns/estimate/_hooks/useJobWorksheetPersistence.ts` | Replaced direct Supabase calls with calls to new server actions; removed `createClient` |

---

## 3. What Changed

### `src/app/actions/worksheet-item-actions.ts` (new)

Five server actions, each with `'use server'` directive:

| Action | Mutation |
|---|---|
| `persistWorksheetRow(estimateId, rowId, patch)` | UPDATE `job_worksheet_items` |
| `createWorksheetRow(input)` | INSERT into `job_worksheet_items` |
| `restoreWorksheetRows(estimateId, rows)` | INSERT (undo restore) |
| `deleteWorksheetRow(estimateId, rowId)` | DELETE from `job_worksheet_items` |
| `persistWorksheetSortOrders(estimateId, updates)` | Parallel UPDATE sort_order |

Each action follows the same pattern:
1. `requireUser()` — authentication
2. `requireEditableEstimate(supabase, estimateId)` — fetches `status` + `locked_at` from `estimates`, calls `isEstimateEditable()`, returns `{ error }` if not editable
3. Perform the DB mutation scoped by `estimate_id`

`requireEditableEstimate` is a private helper used only within this file — it does not duplicate the editability rule, which remains solely in `isEstimateEditable()` in `estimateTypes.ts`.

### `src/components/patterns/estimate/_hooks/useJobWorksheetPersistence.ts`

- Removed `import { createClient } from '@/utils/supabase/client'`
- Removed all direct Supabase calls
- Each hook function now calls its corresponding server action and converts `{ error }` returns to thrown `Error` objects — preserving the existing interface that `useJobWorksheetState` depends on (functions still throw on failure)
- All exported types (`UpdateJobWorksheetRowPatch`, `CreateJobWorksheetRowInput`, `WorksheetSortOrderUpdate`) remain in this file and are re-exported for use by the server actions file

---

## 4. Which Worksheet Mutations Are Now Server-Guarded

| Mutation | Guard |
|---|---|
| Row field update (cell edit, autosave) | `persistWorksheetRow` — checks editability before UPDATE |
| Row create (Add row, Ctrl+Enter) | `createWorksheetRow` — checks editability before INSERT |
| Row restore (undo after delete) | `restoreWorksheetRows` — checks editability before INSERT |
| Row delete | `deleteWorksheetRow` — checks editability before DELETE |
| Sort order reorder | `persistWorksheetSortOrders` — checks editability before parallel UPDATEs |

---

## 5. Where `isEstimateEditable()` Is Reused

| File | Usage |
|---|---|
| `src/lib/estimateTypes.ts` | Definition — single source of truth |
| `src/app/actions/worksheet-item-actions.ts` | Called inside `requireEditableEstimate` helper |
| `src/app/actions/worksheet-pricing-actions.ts` | Called inline in `linkRowToPricing`, `unlinkRowFromPricing` (Slice 18/19) |
| `src/app/actions/estimate-actions.ts` | Called inline in `renameEstimate` (Slice 19) |
| `src/app/jobs/[id]/worksheet/page.tsx` | Drives `isLocked` for UI gating (Slice 19) |

No duplication of the editability rule. All enforcement flows through the one shared function.

---

## 6. Validation Results

- `npx tsc --noEmit` — 0 errors
- `useJobWorksheetState` unchanged — it receives the same function signatures from the persistence hook (`persistRow`, `createRow`, `restoreRows`, `deleteRow`, `persistSortOrders`) and they still throw on error
- No changes to the adapter, orchestrator, or any UI component

---

## 7. Remaining Risks / Follow-up

1. **No `revalidatePath` on worksheet item mutations** — The server actions do not call `revalidatePath`. The existing architecture relies on local state updates (via `useJobWorksheetState`) to reflect changes immediately; `revalidatePath` is only called from proposal/estimate-level actions. This is intentional and consistent with the existing worksheet persistence pattern. No change needed here.

2. **Sort order update is still N parallel DB calls** — `persistWorksheetSortOrders` sends one UPDATE per row, in parallel. For large worksheets this could be slow. A future slice could batch via a Postgres function or RPC. Not a safety concern.

3. **`restoreWorksheetRows` sends full row objects** — Serializes full `JobWorksheetRow` objects as server action arguments. These are plain objects with string/number/null fields and are safely serializable. If row shape grows (e.g., large text blobs), this could become heavy, but is fine for current use.

4. **RLS not audited** — The Supabase RLS policies on `job_worksheet_items` were not inspected or modified. The server-side `isEstimateEditable` check is application-layer enforcement. An attacker with direct Supabase API access (e.g., using the anon key) could bypass it if RLS does not enforce the same rule. A future slice should audit and tighten RLS on `job_worksheet_items`.

---

## 8. Intentionally Not Changed

- `useJobWorksheetState` — interface unchanged; still receives the same persistence hook function signatures
- `JobWorksheetTableAdapter`, `JobWorksheetPageOrchestrator` — no changes; UI gating from Slice 19 still in place
- `useWorksheetInteraction`, `EditableDataTable` — shared UI layer untouched
- Proposal system — no changes
- `estimate-actions.ts` — `importEstimate` and `duplicateEstimate` not touched (both create new draft estimates or copy to draft; inherently safe)
- RLS policies — no schema changes
