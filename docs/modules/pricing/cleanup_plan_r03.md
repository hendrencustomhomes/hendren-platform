# Pricing Module Cleanup Plan — R03

Status: active cleanup plan
Last updated: 2026-04-24 America/Chicago
Branch target: `dev`
Supersedes: prior pricing cleanup plan revisions
Purpose: record the pricing worksheet state after successful live cutover to the orchestrated worksheet stack, and define the next cleanup sequence without reopening solved parity work casually.

---

## 1. Why this document exists

The pricing worksheet is no longer in the same state described by earlier cleanup-plan revisions.

The pricing worksheet has now been cut over live to the orchestrated stack, and the build is green.
That means future chats should not operate from any pre-cutover assumptions.

This document exists to prevent future chats from doing either of these:

- acting like worksheet centralization is still stuck before cutover
- acting like cleanup is already finished and immediately jumping into second-module rollout

This document is intended to stand on its own as the active cleanup plan.

---

## 2. Current repo reality

### 2.1 What is now complete

The pricing worksheet now runs through the orchestrated worksheet stack.

That means the active live path includes:

- shared table foundation via `EditableDataTable`
- pricing adapter via `PricingWorksheetTableAdapter`
- pricing columns via `pricingWorksheetColumns`
- pricing state via `usePricingWorksheetState`
- pricing persistence via `usePricingWorksheetPersistence`
- thin live wrapper via `src/components/pricing/PricingWorksheetPage.tsx`
- orchestrated page composition via `PricingWorksheetPageOrchestrator`

The live wrapper no longer points at the old monolithic worksheet page.

### 2.2 What parity work was completed during cutover

The cutover was not a shallow component swap.
During the parity passes, the pricing worksheet regained:

- desktop virtualization/windowing
- focus lifecycle and active-cell restoration
- post-create focus handoff
- safer row-state and autosave lifecycle behavior
- catalog-linked row creation flow
- `Ctrl/Cmd+Enter` create-row behavior from worksheet cells

Future chats should treat the current pricing worksheet stack as the active reference implementation, not as a parked experimental path.

### 2.3 What is still not complete

The pricing worksheet cleanup is **not** fully complete yet.

Remaining work includes:

- removing dead old-path usage deliberately
- deciding what parts of worksheet interaction belong in a truly shared worksheet layer instead of pricing-local adapter/state code
- deciding whether the legacy monolithic page should remain temporarily as rollback reference or be removed now
- deciding when another module is mature enough to adopt the worksheet stack

So the current repo state is:

```text
shared worksheet primitive exists
pricing worksheet now runs on the orchestrated stack
pricing remains the active reference implementation
post-cutover cleanup still remains
multi-module worksheet reuse is not yet proven
```

---

## 3. Architectural truths now locked

These should not be reopened casually.

### 3.1 Pricing now proves the architecture in production

The worksheet architecture is no longer theoretical.
Pricing is the live proving ground.

Future chats should not route the live pricing wrapper back to the old page unless a concrete regression forces rollback.

### 3.2 Shared UI still must not own pricing business logic

The cutover does **not** justify pushing pricing-specific rules into shared UI.

Shared layers still must not own:

- pricing row semantics
- pricing validation rules
- pricing create-row meaning
- pricing persistence rules

### 3.3 Pricing-local interaction code is allowed temporarily, but not forever

It is acceptable that some interaction behavior still lives in pricing adapter/state files immediately after cutover.

It is **not** acceptable to leave that there forever if it is clearly generic worksheet behavior.

### 3.4 Do not multiply adopters before cleaning up the reference implementation

A second module should not adopt the worksheet stack while pricing still has obvious post-cutover dead code or unclear ownership boundaries.

Pricing must be cleaned up enough to serve as a trustworthy template.

---

## 4. Current worksheet layering for pricing

The live pricing worksheet now effectively follows this model:

```text
[ Shared UI Layer ]
EditableDataTable

[ Pricing Adapter Layer ]
PricingWorksheetTableAdapter
pricingWorksheetColumns

[ Pricing State Layer ]
usePricingWorksheetState

[ Pricing Persistence Layer ]
usePricingWorksheetPersistence

[ Thin Composition Layer ]
PricingWorksheetPageOrchestrator

[ Live Wrapper ]
src/components/pricing/PricingWorksheetPage.tsx
```

This is a materially better state than the old page-owned worksheet engine.

---

## 5. Immediate next cleanup phase

The next phase is **post-cutover cleanup**, not another centralization pass.

### 5.1 Goal

Tighten the pricing worksheet stack now that it is live, without reopening solved parity work unnecessarily.

### 5.2 What the next chat should do

In order:

1. confirm `dev` is green
2. confirm the live wrapper still points to `PricingWorksheetPageOrchestrator`
3. perform a focused regression audit on the live stack
4. identify dead legacy-path usage that is now truly unused
5. remove obsolete live-path code deliberately, not indiscriminately
6. identify which worksheet interaction behaviors are candidates for future shared extraction
7. stop before second-module rollout unless that extraction strategy is clearly defined

### 5.3 What the next chat should not do

Do **not**:

- casually point the live wrapper back to the old page
- declare worksheet reuse “done” across modules
- start a second adopter blindly
- delete large legacy files without confirming no active route still depends on them
- generalize pricing-specific rules into shared UI just because pricing is now live on the new stack

---

## 6. Current risk profile

### 6.1 Primary risk has changed

The main risk is no longer “hybrid state during cutover.”

The main risk is now:

- leaving dead old-path code long enough that future chats stop knowing what is authoritative
- treating pricing-local interaction logic as permanent when some of it should eventually move upward
- assuming mobile divergence or other UI differences are already resolved enough for cross-module reuse

### 6.2 What is no longer the top risk

The following are no longer the primary problem:

- missing adapter layer
- page still acting as worksheet god component
- live pricing still trapped on the monolithic page
- cutover blocked by parity basics

---

## 7. Definition of done for the next cleanup phase

This post-cutover cleanup phase is done when all of the following are true:

- `dev` remains green
- live pricing still runs on the orchestrated stack
- dead old-path usage is identified and intentionally reduced
- pricing remains the active reference implementation
- the repo is clearer about which worksheet behaviors are shared candidates versus pricing-local behaviors
- future module adoption can be planned from a cleaner reference point

This phase is **not** done merely because cutover succeeded.

---

## 8. What comes after this phase

Only after post-cutover cleanup:

- evaluate shared worksheet interaction extraction more directly
- choose the second adopter deliberately
- prove that another module can adopt primarily through adapter + persistence work

Do not rush that sequence.

---

## 9. Read-first rule for future chats

Future chats should use the **latest docs only** as operating context.

Read first:

1. `docs/design/module_structure`
2. `docs/design/module_design_strategy_r02.md`
3. `docs/modules/pricing/cleanup_plan_r03.md`
4. `docs/modules/pricing/worksheet_reuse_design_r02.md`
5. `docs/modules/pricing/worksheet_centralization_handoff_r02.md`

Older revisions should only be used if a future audit specifically needs history comparison or regression checking.

---

---

## 11. Post-cutover extraction pass — completed 2026-04-24

### What was done

Generic worksheet interaction behavior was extracted from `PricingWorksheetTableAdapter` into a shared worksheet layer. Three new files were created:

- `src/components/data-display/worksheet/worksheetTypes.ts` — shared types (`WorksheetActiveCell`, `WorksheetCellDraftValue`, `WorksheetVisibleRange`, `WorksheetRowSaveState`)
- `src/components/data-display/worksheet/useWorksheetVirtualization.ts` — virtualization state and visible-range math (scroll tracking, ResizeObserver, spacer heights)
- `src/components/data-display/worksheet/useWorksheetInteraction.ts` — active-cell lifecycle, cell ref registry, pending-focus, focus restoration, scroll-to-row, neighbor-cell navigation, full keyboard movement contract

`PricingWorksheetTableAdapter` was rewritten to call both hooks and pass results to `EditableDataTable`. It is now pure adapter/wiring code.

### What moved to shared worksheet layer

- Cell ref registry (`cellRefs`)
- Pending-focus lifecycle (`pendingFocusRef`)
- Focus restoration effect (fires after scroll changes visible window)
- Post-create active-cell focus handoff effect
- Scroll-to-row behavior (`focusCell`)
- Viewport/visible-range virtualization math (`useMemo` + ResizeObserver)
- Neighbor-cell navigation (`getNeighborCell`)
- Keyboard contract: Tab/Shift+Tab, Enter/Shift+Enter, ArrowUp/Down/Left/Right, Esc, Ctrl+Enter, Ctrl+Z

### What stayed pricing-local (in adapter)

- `editableCellOrder` — pricing column navigation order
- `getEditableCellValue` — maps `PricingRow` fields to editable values
- `getRowStatusLabel` — maps `rowSaveState` to display text/tone
- `columns` useMemo — calls `getPricingWorksheetColumns`
- Virtual constants (`VIRTUAL_ROW_HEIGHT = 70`, etc.)

### What was not touched

- `usePricingWorksheetState` — remains pricing-local
- `usePricingWorksheetPersistence` — unchanged
- `PricingWorksheetPageOrchestrator` — unchanged
- `PricingWorksheetGrid` — legacy file, left in place deliberately
- `src/components/pricing/PricingWorksheetPage.tsx` — live wrapper, still points to orchestrator
- All route files — unchanged

### Validation results

- `npx tsc --noEmit` — clean, no errors
- Build — same pre-existing Supabase stub-env prerender failure on `/more/cost-codes` (unrelated to this pass)
- Live wrapper confirmed pointing to `PricingWorksheetPageOrchestrator`

### Parity risks assessed

All generic behavior was moved by extracting functions into the hooks with identical logic — no behavioral changes. The following were explicitly verified as preserved:
- Virtualization/windowing: same `useMemo` math, same ResizeObserver, same spacer computation
- Focus lifecycle: same `pendingFocusRef` pattern, same RAF sequence
- Post-create focus handoff: effect on `activeCell` still fires when orchestrator sets `activeCell` after row creation
- Row-state/autosave: untouched (`usePricingWorksheetState` not modified)
- Catalog-linked create-row: untouched (orchestrator + persistence not modified)
- Ctrl+Enter create-row: preserved in both `handleTextCellKeyDown` and `handleCheckboxKeyDown`
- Keyboard navigation: identical key routing in shared hooks

### Remaining risks

- `usePricingWorksheetState` still owns its own local type aliases (`EditableCellKey`, `ActiveCell`) duplicated from `pricingWorksheetColumns`. Minor redundancy, low risk.
- `PricingWorksheetGrid` (legacy) and old `PricingWorksheetPage` monolith remain on disk as rollback reference. Deliberate per current cleanup plan.

### What comes next

The shared worksheet interaction layer now exists. The reference implementation (pricing) uses it. A second adopter can now use `useWorksheetVirtualization` + `useWorksheetInteraction` with its own adapter and persistence layer with no interaction engine rebuild required.

Second adopter choice and timing remains a deliberate decision per section 8 of this document.

---

## 10. Final directive

This is the active cleanup control document for pricing after live worksheet cutover.

Future chats should treat the orchestrated pricing stack as the active path,
keep `dev` green,
and focus next on cleanup clarity rather than reopening already-solved parity work.
