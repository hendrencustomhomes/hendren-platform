# Worksheet / Takeoff Reuse Audit — R01

**Date:** 2026-04-27
**Branch audited:** `origin/dev`
**Status:** audit only — no code changes made
**Purpose:** determine whether new worksheet work is accidentally rebuilding existing shared functionality instead of inheriting it.

---

## 1. What Exists Today

### 1.1 Shared Worksheet Engine (live, proven)

These files are the authoritative shared worksheet layer. No module should rebuild what these provide.

| File | Purpose |
|---|---|
| `src/components/data-display/EditableDataTable.tsx` | Shared table primitive — column layout, cell rendering, scroll wiring |
| `src/components/data-display/worksheet/useWorksheetInteraction.ts` | Full keyboard contract — Tab/Enter/Arrow/Esc/Ctrl+Z/Ctrl+Enter, focus lifecycle, cell ref registry, pending-focus, neighbor-cell navigation |
| `src/components/data-display/worksheet/useWorksheetVirtualization.ts` | Virtualization state — scroll tracking, ResizeObserver, visible-range math, spacer heights |
| `src/components/data-display/worksheet/worksheetTypes.ts` | Shared types — `WorksheetActiveCell`, `WorksheetCellDraftValue`, `WorksheetVisibleRange`, `WorksheetRowSaveState` |

### 1.2 Pricing Worksheet Stack (live, reference implementation)

| File | Role |
|---|---|
| `src/components/patterns/pricing/PricingWorksheetTableAdapter.tsx` | Adapter — column defs, field accessor, wires interaction + virt hooks to `EditableDataTable` |
| `src/components/patterns/pricing/PricingWorksheetPageOrchestrator.tsx` | Thin composition — assembles header, meta bar, new-row bar, mobile list, adapter |
| `src/components/patterns/pricing/_hooks/usePricingWorksheetState.ts` | State — local-first rows, dirty tracking, autosave queue, undo stack, draft row |
| `src/components/patterns/pricing/_hooks/usePricingWorksheetPersistence.ts` | Persistence — Supabase load, row create/update, header save, revision create |
| `src/components/patterns/pricing/_lib/pricingWorksheetColumns.tsx` | Column definitions for `EditableDataTable` |
| `src/components/patterns/pricing/PricingWorksheetMobileList.tsx` | Mobile read-only card list (pricing-specific) |
| `src/components/pricing/PricingWorksheetPage.tsx` | Live route wrapper — re-exports from orchestrator |
| `src/components/patterns/pricing/_legacy/PricingWorksheetPage.legacy.tsx` | Quarantined legacy monolith — `@ts-nocheck`, not compiled into active build |

The legacy file is intentionally on disk for rollback reference. It has no active importers.

### 1.3 Job Worksheet Route (new, read-only, partially built)

| File | Role |
|---|---|
| `src/app/jobs/[id]/worksheet/page.tsx` | New route — reads from `job_worksheet_items`, renders orchestrator |
| `src/components/patterns/estimate/JobWorksheetPageOrchestrator.tsx` | Thin wrapper — passes static `rows` prop to adapter, no state or persistence yet |
| `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx` | Adapter — correctly wires `EditableDataTable` + `useWorksheetInteraction` + `useWorksheetVirtualization`; all write operations are noops |

This route is live but **read-only**. No `useJobWorksheetState` or `useJobWorksheetPersistence` exist yet.

### 1.4 Legacy Takeoff Engine (still live, reads `takeoff_items`)

| File | Role |
|---|---|
| `src/app/jobs/[id]/TakeoffTab.tsx` | Data fetch, CRUD orchestration — reads/writes `takeoff_items` directly via Supabase client |
| `src/app/jobs/[id]/TakeoffWorkspace.tsx` | Near-god component — toolbar state, panel state, filter state, mobile detection, overlay positioning, draft state, assembly option building, filter option building |
| `src/app/jobs/[id]/TakeoffDesktopReviewTable.tsx` | Desktop tree rendering — custom recursive node rendering, no `EditableDataTable` |
| `src/app/jobs/[id]/TakeoffMobileReviewList.tsx` | Mobile card rendering — custom recursive node rendering, accordion expand |
| `src/app/jobs/[id]/TakeoffSearchSelect.tsx` | Route-local combobox — keyboard nav, blur timer, fuzzy filter |
| `src/app/jobs/[id]/takeoffTypes.ts` | Types for legacy takeoff |
| `src/app/jobs/[id]/takeoffUtils.ts` | Utility functions — sort, parse, format, row-kind checks, cost-code filter, incomplete check |
| `src/app/jobs/[id]/takeoffReviewUtils.ts` | Tree utilities — `buildTakeoffTree`, `filterTakeoffTree`, `flattenTakeoffTree`, subtotals |

**This engine does NOT use `EditableDataTable`, `useWorksheetInteraction`, or `useWorksheetVirtualization`.** It is a standalone custom implementation.

### 1.5 Orphaned Extracted Components (exist on disk, zero importers)

These three files were extracted but never wired into `TakeoffWorkspace.tsx` or `JobTabs.tsx`. No file on `origin/dev` imports them.

| File | Confirmed status |
|---|---|
| `src/app/jobs/[id]/TakeoffFilterBar.tsx` | **Orphaned** — `TakeoffWorkspace` still uses its own inline filter panel |
| `src/app/jobs/[id]/TakeoffOverviewStrip.tsx` | **Orphaned** — metrics strip, not mounted anywhere |
| `src/app/jobs/[id]/TakeoffScopeContext.tsx` | **Orphaned** — scope context card, not mounted anywhere |

### 1.6 Bids Module

Bids correctly inherit the full pricing worksheet stack.

- `src/app/jobs/[id]/BidsTab.tsx` — list/create tab, routes to bid detail
- `src/app/jobs/[id]/bids/page.tsx` → `PricingHeadersPageClient`
- `src/app/jobs/[id]/bids/[bidId]/page.tsx` → `PricingWorksheetPage` → `PricingWorksheetPageOrchestrator`

No duplication. Bids are the correct model for how a second module inherits the pricing worksheet.

### 1.7 Selections and Scope

- `SelectionsTab.tsx` — simple CRUD on `job_selections`. Not worksheet-family behavior. Appropriate as-is.
- `ScopeTab.tsx` — simple form on `job_scope_items`. Not worksheet-family behavior. Appropriate as-is.

### 1.8 Shared Numbers Utilities

`src/lib/shared/numbers.ts` provides:
- `formatMoney(value)` — USD Intl.NumberFormat, returns `—` for null/non-finite
- `parseNumber(value)` — strips `$,`, returns null for empty/non-finite

---

## 2. Findings — Duplicated / Redundant Pieces

### Finding 1 — CRITICAL: `JobWorksheetTableAdapter` reimplements `formatMoney` and `formatNumber`

**File:** `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx`

Two local functions exist:
```ts
function formatNumber(value: number | string | null) { ... }  // ~line 62
function formatMoney(value: number | string | null) { ... }   // ~line 70
```

`src/lib/shared/numbers.ts` already has `formatMoney`. The local version uses `Intl.NumberFormat` directly and returns `''` for null (vs. `—` in the shared version for `number` input). This behavioral difference is minor but creates drift risk.

**Risk:** If shared `formatMoney` changes, this adapter is silently out of sync.

### Finding 2 — CRITICAL: `JobWorksheetTableAdapter` redefines types that exist in `worksheetTypes.ts`

**File:** `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx`

```ts
type ActiveCell = { rowId: string; field: JobWorksheetCellKey }
type CellDraftValue = string | boolean | null
```

**Shared equivalents already exist in** `src/components/data-display/worksheet/worksheetTypes.ts`:
```ts
WorksheetActiveCell<CellKey>
WorksheetCellDraftValue
```

The adapter should import from the shared layer, not redefine.

### Finding 3 — `TakeoffWorkspace.tsx` still owns its own inline filter panel despite `TakeoffFilterBar.tsx` existing

The filter panel logic in `TakeoffWorkspace.tsx` (`openPanel === 'filters'` block) is a full reimplementation of what `TakeoffFilterBar.tsx` provides. `TakeoffFilterBar.tsx` exists but is never imported. These two are out of sync.

### Finding 4 — Style function copy-paste across 6+ files

The following inline style functions are defined identically (or near-identically) in each file independently:

| Function | Files |
|---|---|
| `inputStyle()` | `TakeoffWorkspace`, `TakeoffDesktopReviewTable`, `TakeoffMobileReviewList`, `TakeoffFilterBar`, `SelectionsTab`, `ScopeTab` |
| `cardStyle()` | `TakeoffWorkspace`, `TakeoffFilterBar`, `SelectionsTab`, `ScopeTab`, `TakeoffOverviewStrip`, `TakeoffScopeContext` |
| `fieldLabelStyle()` | `TakeoffWorkspace`, `TakeoffDesktopReviewTable`, `TakeoffMobileReviewList`, `TakeoffFilterBar`, `TakeoffOverviewStrip`, `TakeoffScopeContext` |

This violates the "Shared UI is inherited, not copied" rule from `docs/design/module_structure`.

### Finding 5 — `TakeoffDesktopReviewTable` and `TakeoffMobileReviewList` both define identical utility functions

Both files independently define:
- `buildCostCodeOptions()` — identical function
- `normalizeTradeValue()` — identical function
- `enterBlur()` — identical function
- `fieldLabelStyle()` / `inputStyle()` — identical style functions

These belong in a shared location (either `takeoffUtils.ts` or a shared takeoff-local lib).

### Finding 6 — `TakeoffScopeContext.tsx` duplicates filter logic from `takeoffUtils.getScopeContextItems`

`TakeoffScopeContext.tsx` defines:
```ts
const VISIBLE_SCOPE_TYPES = new Set([...10 scope types...])
function getVisibleScopeItems(scopeItems) { filter by VISIBLE_SCOPE_TYPES }
```

`takeoffUtils.ts` already has:
```ts
export function getScopeContextItems(scopeItems) { filter by priorityTypes Set with identical 10 entries }
```

One should call the other. `TakeoffScopeContext.tsx` should import from `takeoffUtils`.

### Finding 7 — `usePricingWorksheetState.ts` defines `editableCellOrder` that is also in `PricingWorksheetTableAdapter.tsx`

The state file defines `editableCellOrder` as a `const` at the top. The adapter defines its own `editableCellOrder` as a `const`. The state file's version appears unused. Minor internal duplication.

### Finding 8 — `usePricingWorksheetState.ts` has local `parseNullableNumber` that overlaps with `src/lib/shared/numbers.ts`

The state file defines `parseNullableNumber` locally. The shared library has `parseNumber`. They differ in that the state version applies a 0→null rule through `parseNullableMoney`. This difference is intentional per the pricing zero rule. Acceptable, but worth documenting.

---

## 3. Reusable Existing Pieces — What to Inherit, Not Rebuild

| Piece | Location | Ready to use? |
|---|---|---|
| Full keyboard contract | `useWorksheetInteraction.ts` | Yes — proven in pricing |
| Virtualization | `useWorksheetVirtualization.ts` | Yes — proven in pricing |
| Table primitive | `EditableDataTable.tsx` | Yes — proven in pricing |
| Shared types | `worksheetTypes.ts` | Yes |
| Money formatting | `src/lib/shared/numbers.ts` → `formatMoney` | Yes |
| Number parsing | `src/lib/shared/numbers.ts` → `parseNumber` | Yes |
| Tree building/filtering | `takeoffReviewUtils.ts` | Yes — for hierarchy logic |
| Autosave/debounce pattern | `usePricingWorksheetState.ts` | Use as template |
| Persistence pattern | `usePricingWorksheetPersistence.ts` | Use as template |
| Orchestrator pattern | `PricingWorksheetPageOrchestrator.tsx` | Use as template |
| Mobile detection | Both workspace files | Same `matchMedia` pattern |

---

## 4. What NOT to Rebuild

1. **Keyboard navigation** — `useWorksheetInteraction` owns Tab, Enter, Arrow, Esc, Ctrl+Z, Ctrl+Enter. Do not reimplement.
2. **Virtualization** — `useWorksheetVirtualization` owns scroll tracking, ResizeObserver, visible-range math. Do not reimplement.
3. **`formatMoney`** — exists in `@/lib/shared/numbers`. Import it.
4. **Autosave/debounce** — `usePricingWorksheetState.scheduleFlush` is the proven pattern. Follow it.
5. **Local-first row state** — `usePricingWorksheetState` has local vs. server row split, dirty tracking, draft row promotion. Follow this pattern exactly.
6. **Pricing worksheet** — bids correctly reuse it. Do not duplicate.
7. **Tree build/filter utilities** — `takeoffReviewUtils.ts` has `buildTakeoffTree`, `filterTakeoffTree`, `flattenTakeoffTree`. These work and can be adapted.

---

## 5. Missing Shared Abstractions

The following are clearly shared behavior that has not yet been centralized:

| Abstraction | Current state | Missing shared form |
|---|---|---|
| `useJobWorksheetState` | Does not exist | Needed: local-first state, autosave, undo — follow `usePricingWorksheetState` |
| `useJobWorksheetPersistence` | Does not exist | Needed: load/create/update for `job_worksheet_items` |
| Shared `ActiveCell` + `CellDraftValue` types | Duplicated in each adapter | `WorksheetActiveCell` and `WorksheetCellDraftValue` already exist in `worksheetTypes.ts` — adapters should import them |
| Shared `inputStyle` / `cardStyle` / `fieldLabelStyle` | Copied in 6+ files | Belongs in a shared style primitive or CSS tokens |
| Combobox / search-select primitive | `TakeoffSearchSelect` is route-local | If needed across modules, belongs in `src/components/ui/` |
| `buildCostCodeOptions` / `normalizeTradeValue` | Duplicated in desktop + mobile takeoff tables | Belongs in a shared takeoff util |

---

## 6. Two Active Sources of Truth — Primary Structural Risk

The job detail page currently has **two parallel paths** for the same workflow:

| Path | Table | Status |
|---|---|---|
| Old `TakeoffTab` (in `JobTabs`) | `takeoff_items` (legacy) | Live, read + write |
| New worksheet route (`/jobs/[id]/worksheet`) | `job_worksheet_items` (new) | Live, read-only |

These are not the same data. A user editing the old Takeoff tab writes to `takeoff_items`. The new worksheet route shows data from `job_worksheet_items`. Until the old tab is retired, two active sources of truth exist simultaneously with no sync between them.

This is explicitly anticipated in `docs/modules/estimate/takeoff_estimate_unified_design_r02.md` Section 15. It is a known coexistence risk, not an accident.

---

## 7. Correct Execution Recommendation — Strict Order

### Step 1: Fix imports in `JobWorksheetTableAdapter.tsx` before anything else

- Import `formatMoney` from `@/lib/shared/numbers.ts` — remove local copy
- Import `WorksheetActiveCell` and `WorksheetCellDraftValue` from `worksheetTypes.ts` — remove local type aliases
- No behavioral change, only structural correctness
- Blocks: prevents these local copies from becoming the pattern new code copies

### Step 2: Resolve orphaned component situation

Either:
- **Option A:** Wire `TakeoffFilterBar`, `TakeoffOverviewStrip`, `TakeoffScopeContext` into `TakeoffWorkspace.tsx`, removing the inline duplicates in the workspace
- **Option B:** Delete the three orphaned files and leave `TakeoffWorkspace.tsx` as-is

Do not leave all four implementations on disk simultaneously (three extracted files + workspace inline version).

The orphaned state is more dangerous than either resolved state because future sessions will not know which version is authoritative.

### Step 3: Build `useJobWorksheetPersistence`

- Follow `usePricingWorksheetPersistence` template exactly
- Reads from `job_worksheet_items`
- Writes create/update/access-check logic
- No implementation of proposal, estimate versioning, or scope fields yet — start with `description`, `quantity`, `unit`, `row_kind`, `parent_id`, `sort_order` only

### Step 4: Build `useJobWorksheetState`

- Follow `usePricingWorksheetState` template exactly
- Adapt for `JobWorksheetRow` field schema
- Implement: local-first rows, dirty tracking, debounced autosave, undo stack, draft row append
- Import `WorksheetRowSaveState` from `worksheetTypes.ts`

### Step 5: Decide hierarchy rendering approach before wiring state

The current `JobWorksheetTableAdapter` uses a `getDepth` + prefix approach for `parent_id` hierarchy:
```
— — Child item
```
The legacy `TakeoffDesktopReviewTable` uses a recursive nested card approach with distinct assembly card UI.

These are visually different. Decide which is correct for `job_worksheet_items` before building state so the adapter column rendering is finalized before it is wired.

### Step 6: Wire `JobWorksheetTableAdapter` to real state

- Replace noop `commitCellValue`, `handleUndo`, `onCreateRow` with state callbacks
- The adapter structure is already correct for the shared layer

### Step 7: Wire `JobWorksheetPageOrchestrator` to state + persistence

- Follow `PricingWorksheetPageOrchestrator` structure
- Add mobile split (no mobile adapter exists yet for job worksheet)
- Add create-row UX

### Step 8: Do NOT touch old `TakeoffTab` until new worksheet has parity

The old tab is the only write path for `takeoff_items`. Do not disable or remove it until:
- New worksheet route can create, edit, and display rows from `job_worksheet_items`
- The data migration question is decided (or explicitly deferred)

### Step 9: Do NOT touch Pricing Sources, Bids, or Catalog during this work

---

## 8. Risks and Regressions to Avoid

| Risk | Detail |
|---|---|
| Two-source-of-truth confusion | Old `TakeoffTab` writes `takeoff_items`. New worksheet reads `job_worksheet_items`. Users will see different data. Document this clearly; do not silently leave users confused. |
| `TakeoffFilterBar` orphan spreading | If more sessions extract components from `TakeoffWorkspace` without wiring them, the count of orphaned files grows. Resolve now. |
| `formatMoney` drift | `JobWorksheetTableAdapter` has its own copy. It returns `''` for null, shared version returns `—` for null. These will diverge further if not fixed. |
| Noop callbacks masking bugs | `commitCellValue: () => {}` in `JobWorksheetTableAdapter` means any interaction event silently does nothing. Once state is wired, if the callback interface drifts from what `useWorksheetInteraction` passes, bugs will be silent. Fix by importing types from `worksheetTypes.ts`. |
| Hierarchy rendering locked in too early | `getDepth` + prefix is baked into `getColumns`/`formatEditableValue`. If the visual design decision changes to nested cards, that logic must be reworked. Decide first, build second. |
| Assembly vs. line_item creation | `job_worksheet_items` has `row_kind: line_item | assembly | note | allowance`. Row creation UI must handle all four kinds. Do not build for `line_item` only and defer the rest indefinitely. |
| `usePricingWorksheetState.editableCellOrder` dead code | The state file defines `editableCellOrder` but the adapter defines its own. Clean this up during pricing post-cutover cleanup, not during worksheet work. |

---

## 9. Summary

The shared worksheet layer (`EditableDataTable`, `useWorksheetInteraction`, `useWorksheetVirtualization`, `worksheetTypes`) is proven and ready to be inherited. The new `JobWorksheetTableAdapter` correctly uses it.

The main duplication risks are:
1. `JobWorksheetTableAdapter` has local `formatMoney`/`formatNumber` and local type aliases that should be imports
2. Three extracted Takeoff components are orphaned (no importers)
3. Style functions are copy-pasted across 6+ files
4. `TakeoffWorkspace.tsx` still has inline filter panel even though `TakeoffFilterBar.tsx` exists

The new worksheet route is architecturally correct. It uses the right shared infrastructure. It is not rebuilding what already exists. The gap is that state and persistence layers have not been built yet, so the adapter is wired to noops.

The old `TakeoffTab` is a separate engine on a separate table that should not be touched until the new worksheet has write parity.
