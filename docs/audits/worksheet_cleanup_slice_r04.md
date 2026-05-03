# Worksheet Cleanup Slice — Report 04

**Date:** 2026-05-01
**Branch:** dev
**Commit:** de92162

---

## Objective

Audit all ten worksheet-related files for unsafe `any` usage and verify that
explicit generics are in place. Replace `any` where safe and obvious. Document
every case intentionally left.

---

## Files Audited

| File | `any` found | Action |
|---|---|---|
| `JobWorksheetTableAdapter.tsx` | 2 | Fixed |
| `JobWorksheetMobileView.tsx` | 1 (surface type) | Fixed (cascade from adapter) |
| `_worksheetFormatters.ts` | 0 | No change |
| `_worksheetValidation.ts` | 0 | No change |
| `useJobWorksheetState.ts` | 0 | No change |
| `useJobWorksheetPersistence.ts` | 1 | Intentionally left — see below |
| `useWorksheetInteraction.ts` | 0 | No change |
| `useWorksheetVirtualization.ts` | 0 | No change |
| `worksheetTypes.ts` | 0 | No change |
| `EditableDataTable.tsx` | 0 | No change |

---

## Files Modified

### `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx`

**1. `getColumns` callback parameters**

Before:
```ts
function getColumns(
  rowsById: Map<string, JobWorksheetRow>,
  onDeleteRow: any,
  commit: any,
): EditableDataTableColumn<JobWorksheetRow>[]
```

After:
```ts
function getColumns(
  rowsById: Map<string, JobWorksheetRow>,
  onDeleteRow: (rowId: string) => void,
  commit: (rowId: string, field: JobWorksheetEditableCellKey, value: string) => void,
): EditableDataTableColumn<JobWorksheetRow>[]
```

**2. `JobWorksheetTableAdapter` component props**

Before:
```ts
export function JobWorksheetTableAdapter(props: any)
```

After — explicit `AdapterProps` type added:
```ts
type AdapterProps = {
  rows: JobWorksheetRow[]
  activeCell: WorksheetActiveCell<JobWorksheetEditableCellKey> | null
  activeDraft: WorksheetCellDraftValue
  setActiveCell: (cell: WorksheetActiveCell<JobWorksheetEditableCellKey> | null) => void
  setActiveDraft: (draft: WorksheetCellDraftValue) => void
  commitCellValue: (rowId: string, field: JobWorksheetEditableCellKey, value: string | boolean) => void
  handleUndo: () => void
  createDraftRowAfter: (options?: { sourceRowId?: string; asChild?: boolean }) => void
  deleteRow: (rowId: string) => void
}
```

Row map callback also simplified — `(row: JobWorksheetRow)` cast removed since
TypeScript infers it from the typed `rows: JobWorksheetRow[]` array.

### `src/app/jobs/[id]/takeoff/JobWorksheetMobileView.tsx`

Cascade fix required by typing the adapter props. Once `props.commitCellValue`
became `(rowId: string, field: JobWorksheetEditableCellKey, value: string | boolean) => void`,
the mobile view's prop `commitCellValue: (rowId: string, field: string, value: string) => void`
became incompatible (`string` not assignable to `JobWorksheetEditableCellKey` in
contravariant parameter position under `strictFunctionTypes`).

Fix — import `JobWorksheetEditableCellKey` and tighten the prop:

```ts
import type { JobWorksheetRow, JobWorksheetEditableCellKey } from '@/components/patterns/estimate/JobWorksheetTableAdapter'

type Props = {
  commitCellValue: (rowId: string, field: JobWorksheetEditableCellKey, value: string) => void
  ...
}
```

This is strictly more correct: the mobile view only ever calls `commitCellValue`
with `JobWorksheetEditableCellKey` values.

---

## Every `any` Intentionally Left

### `useJobWorksheetPersistence.ts` line 73

```ts
.insert(rows as any[])
```

**Reason:** Supabase's `.insert()` expects the table's generated Insert type
(`TablesInsert<'job_worksheet_items'>`), not the application's row Select type
(`JobWorksheetRow`). The shapes differ in nullability and defaults. Replacing
this cast correctly requires importing Supabase's generated DB types, which is
a separate pass. The cast does not affect runtime behavior — the values sent
are correct. Leaving as-is and documenting.

---

## Generic Confirmations

Both explicit generics are in place and unchanged:

```ts
useWorksheetVirtualization<JobWorksheetRow>({ ... })
useWorksheetInteraction<JobWorksheetRow, JobWorksheetEditableCellKey>({ ... })
```

---

## Confirmation: No Behavior Change

No runtime logic changed. All changes are type annotations only. The
component contract, rendering output, hook wiring, and persistence calls
are identical.

---

## Build Result

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass |
| TypeScript | Pass |
| Static prerender | Pre-existing Supabase env-var failure — unrelated |

---

## What Was NOT Touched

- `_worksheetFormatters.ts` — clean, no change
- `_worksheetValidation.ts` — clean, no change
- `useJobWorksheetState.ts` — clean, no change
- `useWorksheetInteraction.ts` — clean, no change
- `useWorksheetVirtualization.ts` — clean, no change
- `worksheetTypes.ts` — clean, no change
- `EditableDataTable.tsx` — clean, no change
- All keyboard handling, state, persistence, rendering logic

---

---

# Critical Assessment — Platform Implementation Status

*You asked for honest thoughts. Here they are.*

---

## What's actually working

The worksheet engine is the clearest success so far. `EditableDataTable`,
`useWorksheetInteraction`, and `useWorksheetVirtualization` are well-separated,
reasonably generic, and the interaction contract (active cell, draft state,
keyboard nav, undo) holds up. The autosave queue with local backup fallback is
thoughtful. The four cleanup slices have progressively tightened it from a
monolithic blob to something approaching the layered model the design docs
describe.

The `takeoff_estimate_unified_design_r02.md` is the best thinking in the docs
folder. The "one row set, multiple modes" principle is correct and matters.
The `module_design_strategy_r02.md` layering model (shared UI → adapter →
state → persistence) accurately describes how the worksheet is now structured.

---

## What's concerning

### 1. The adapter lives in the wrong tree

`JobWorksheetTableAdapter.tsx` is at `src/components/patterns/estimate/` while
its helpers, mobile view, and validation are now at
`src/app/jobs/[id]/takeoff/`. These are in different subtrees of the project
and the dependency flows backward — route-level code (`[id]/takeoff/`) is
exporting types that a shared component (`components/patterns/estimate/`) uses.
That's inverted. The adapter should either move to the `[id]/worksheet/`
directory to live next to its feature, or the helpers should move to
`components/patterns/estimate/` to live next to the adapter. Right now they're
split between two unrelated locations.

### 2. Mode system doesn't exist yet

The design calls for four modes — scope, takeoff, estimate, proposal_prep —
each controlling visible columns, editable fields, validation, and actions.
The current worksheet renders the same columns regardless. There's no mode
selector, no mode-aware column set, no mode-aware validation. The design docs
describe this as the architectural foundation; the implementation doesn't have
it. This isn't a criticism of the cleanup slices — those correctly avoided
adding features — but it's the most significant gap between design and code.

### 3. Pricing source fields are orphaned

The row type carries `pricing_source_row_id`, `pricing_header_id`, `catalog_sku`,
`source_sku`, `pricing_type` — but none of these are wired to any UI. The
columns in `getColumns` don't show them, the mobile view ignores them, and
there's no mechanism for a user to select a pricing source. They're stored and
displayed as null. The design correctly calls this out as "estimate mode" work,
but it means the current worksheet is functionally scope + takeoff only, not
an estimate worksheet.

### 4. `isMobile()` is a runtime width check at render time

```ts
function isMobile() {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
}
```

This runs synchronously during React rendering. On SSR it returns `false`
(desktop), so the server always renders the desktop view. On the client,
it checks the actual width — if the client is mobile, the first paint is
desktop, then the component re-renders to mobile. This causes a hydration
flash. It also won't respond to window resize. The correct approach is either
CSS media queries (zero JS) or a `useMediaQuery` hook with an SSR-safe
initial state. But this is a known limitation worth acknowledging.

### 5. `validationLabel` is too aggressive for new rows

```ts
if (!Number(row.quantity)) return 'Missing qty'
if (!Number(row.unit_price)) return 'Missing price'
```

Every new blank row — and every note or allowance row without a price —
immediately shows validation warnings. This will be visually noisy. The
design doc distinguishes `note` rows (no pricing) and `allowance` rows
(priced differently), but the validation doesn't check `row_kind`. The
current implementation was sliced forward intact from the original, so
it's not a regression, but it needs addressing before this is user-facing.

### 6. `restoreRows` uses `insert` for undo

Undo-of-delete re-inserts the deleted rows via Supabase `.insert()`. This
is fine if the rows are truly gone, but if Supabase has FK constraints or
soft-delete patterns, it'll fail silently (caught by `.catch(() => setRowState(row.id, 'error'))`). There's also no deduplication — if the same row was
somehow partially restored already, the insert would produce a conflict.
The design doesn't address this edge case.

### 7. The design docs have a scope gap on markup/sell math

`takeoff_estimate_unified_design_r02.md` correctly flags the gap:
`markup_percent`, `markup_amount`, `sell_total` aren't in the DB yet. But
the design is also vague about *how* these should work when they're added:
computed columns, application logic, or a separate estimate layer? The doc
says "decide before full estimate build" but doesn't make the decision. That
decision needs to happen before the mode system gets built, because mode
system + estimate columns are tightly coupled.

### 8. Legacy tables are a coexistence problem, not a future problem

The old `takeoff_items`, `estimate_items`, `estimate_line_items` are still
live and — based on the decisions doc — still in use by existing UI tabs.
The design says "don't touch them yet." But every day the new worksheet
system builds up usage, the eventual migration becomes more complex. There
should be a concrete plan for when and how the old tabs get replaced. Right
now there's a "not yet" but no criteria for when "yet" arrives.

---

## Honest critique of the design docs

`takeoff_estimate_unified_design_r02.md` is good but too long to serve as a
working reference. At 600+ lines it reads like a decision log, not a
spec — the actual column tables, field constraints, and mode behaviors that
would guide implementation are absent. An engineer building the estimate mode
for the first time would finish reading this and still not know what exact
columns to render.

`decisions.md` is accurate but hasn't been updated to reflect anything built
in the last several months. The "What Is Built" section lists features that
were the earliest scaffolding; it doesn't reflect the worksheet, pricing, bids,
or any of the catalog work. It's not wrong, just stale.

The `module_structure`, `repo_tree`, and `rewrite_rollout` paths in the design
folder appear to be empty or non-files. If those were intended to have content,
they don't.

---

## What actually needs to happen next

In priority order, not including features:

1. **Decide the adapter's permanent home.** Either move `JobWorksheetTableAdapter`
   into the `[id]/worksheet/` directory with its feature, or keep it in
   `components/patterns/` and move the helpers there too. The current split
   is incoherent.

2. **Implement `row_kind`-aware validation.** Notes don't need qty or price.
   Allowances need different treatment. This is a one-function fix in
   `_worksheetValidation.ts` and should happen before any real user touches it.

3. **Make the mode architecture concrete.** Define exactly which columns are
   visible and editable in scope vs takeoff vs estimate mode. This doesn't
   require building all three — but it requires the adapter to accept a `mode`
   prop and select columns accordingly. Otherwise "adding estimate mode later"
   will mean rewriting the adapter.

4. **Fix `isMobile()`.** Replace with a CSS-driven approach or a proper hook
   before mobile users are real users.

5. **Decide markup/sell math.** The design punts on this. Estimate mode cannot
   be built until this is decided. It's the single most consequential open
   question for the roadmap.

The system is being built carefully and the cleanup slices are the right kind
of work. The foundation is honest — no fake $0s, no silent data loss, real undo,
real autosave. That's worth more than it sounds for a small team's daily tool.
The main risk isn't code quality, it's the mode system getting postponed until
the adapter is too hardwired to change without pain.
