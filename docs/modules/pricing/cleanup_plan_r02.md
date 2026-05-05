# Pricing Module Cleanup Plan — R02

Status: active cleanup plan
Last updated: 2026-04-22 America/Chicago
Branch target: `dev`
Purpose: define the current pricing cleanup and worksheet-centralization sequence without losing the earlier cleanup logic from R01.

---

## 1. Why this revision exists

R01 established the broader pricing cleanup direction.

Since then, actual worksheet-centralization work began and changed the immediate critical path.
That means R02 must do two things at once:

- preserve the larger pricing cleanup direction from R01
- tighten the next required slice so the worksheet transition is completed cleanly

This revision is not a replacement for architectural discipline.
It is a control document intended to prevent the next chat from improvising or creating hybrid state.

---

## 2. Current repo reality

At time of writing, pricing is in a mixed-but-advancing state.

### 2.1 What is already done

The pricing area has already moved materially beyond the original monolith structure.

Completed work now includes:
- shared worksheet UI foundation established via `EditableDataTable`
- pricing worksheet state extracted into `usePricingWorksheetState`
- pricing worksheet persistence extracted into `usePricingWorksheetPersistence`
- source-first row creation preserved
- catalog linkage kept deferred

This is real progress.
It should not be undone or bypassed.

### 2.2 What is still not complete

Even with that progress, the pricing worksheet is not yet architecturally complete.

The remaining structural problem is that the page/composition layer is still too involved and the adapter layer is missing.

Current effective architecture is:

```text
EditableDataTable (shared UI foundation)
usePricingWorksheetState (pricing-local worksheet engine)
usePricingWorksheetPersistence (pricing-local IO layer)
PricingWorksheetPage (still overloaded)
```

This means:
- shared UI exists
- engine exists
- IO exists
- clean domain-to-table composition is still incomplete

### 2.3 Immediate danger point

This is the dangerous middle state.

If the next pass only partially wires the extracted hooks into the page, the result will be worse than either the old or new architecture.

Likely failure modes from partial wiring:
- double-save paths
- duplicated state ownership
- race conditions between old and new persistence
- broken keyboard behavior caused by mixed handlers
- hard-to-debug local/server drift

That means the next slice is not optional cleanup.
It is the slice that determines whether the worksheet centralization succeeds or becomes structural debt.

---

## 3. Architectural truths now locked

The following rules are now fixed and should not be reopened casually.

### 3.1 Source rows are created before catalog linkage

Pricing rows are created source-first.

That means:
- `source_sku` is the operative row identity at creation time
- `catalog_sku` is optional at creation time
- catalog linkage happens later through deliberate import/review workflow
- bids may remain job-specific and never be imported into catalog

Do not reintroduce immediate catalog linkage into row creation.

### 3.2 Worksheet is the primary editing interface

For pricing rows, the worksheet is not just a display table.
It is the primary working surface.

That means the worksheet must support:
- density
- scan speed
- repeated entry
- keyboard-first behavior
- local-first drafting with persistence behind it

### 3.3 Shared table behavior is reusable, business meaning is not

The table shell, navigation contract, and selection behavior should converge upward into shared UI.

But:
- pricing row meaning
- pricing validation
- pricing save rules
- pricing create-row rules
- pricing formatting decisions that are domain-specific

must remain pricing-local.

### 3.4 Worksheet state and persistence are already split

The repo now has the beginnings of the correct worksheet layering.

That means future work must continue in that direction rather than collapse logic back into the page.

---

## 4. Worksheet layering target for pricing

The pricing worksheet should converge to this shape:

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
PricingWorksheetPage
```

### 4.1 Shared UI layer

Owns only reusable worksheet behavior:
- table/grid layout
- shared keyboard contract
- focus/edit model
- selection behavior
- reusable create-row shell or slot if needed
- virtualization/windowing if truly generic

Must not own pricing business logic.

### 4.2 Pricing adapter layer

Owns:
- pricing column definitions
- mapping `PricingRow` to shared table row/cell model
- formatting like money, status, and catalog display
- wiring table events to pricing state + persistence callbacks

This layer is where shared UI meets pricing meaning.

### 4.3 Pricing state layer

Owns:
- local vs server row state
- draft values
- dirty tracking
- undo behavior
- autosave queueing
- applying cell edits before persistence
- appending newly created rows into local worksheet state

### 4.4 Pricing persistence layer

Owns:
- data loading
- access control
- create row
- update row
- header save/revision
- any persistence-facing orchestration

### 4.5 Thin composition layer

`PricingWorksheetPage.tsx` should become a thin orchestrator only.

It should:
- initialize persistence hook
- initialize state hook
- pass data into header/meta/new-row components
- render table through adapter

It should not continue to own worksheet engine logic or persistence logic.

---

## 5. Slice 3 — Adapter + Page Reduction (critical current slice)

This is the next required slice.

### 5.1 Goal

Complete worksheet centralization by introducing the missing adapter layer and reducing the page to orchestration only.

### 5.2 Required file targets

Create or finalize:

```text
src/components/patterns/pricing/
  PricingWorksheetTableAdapter.tsx
  _lib/
    pricingWorksheetColumns.ts
```

Use existing extracted hooks:

```text
src/components/patterns/pricing/_hooks/
  usePricingWorksheetState.ts
  usePricingWorksheetPersistence.ts
```

### 5.3 Adapter responsibilities

The adapter layer must:
- define pricing worksheet columns explicitly
- render read-only catalog display as actual SKU or `Not Linked`
- format money consistently
- surface row status labels consistently
- wire table commit events into worksheet state and persistence
- keep checkbox/text/textarea column behavior coherent

### 5.4 Page rewrite target

`PricingWorksheetPage.tsx` must be rewritten toward this shape:

```ts
const persistence = usePricingWorksheetPersistence(...)

const worksheet = usePricingWorksheetState({
  initialRows: persistence.rows,
  onPersistRow: persistence.persistRow,
})
```

Then compose:
- `PricingWorksheetHeader`
- `PricingWorksheetMetaBar`
- `PricingWorksheetNewRowBar`
- `PricingWorksheetTableAdapter`
- `PricingWorksheetMobileList` if mobile rendering remains separate for now

### 5.5 Old grid usage

- stop rendering `PricingWorksheetGrid`
- do not keep it in active use
- do not delete immediately if rollback safety is still valuable
- remove only after stable cutover is confirmed

---

## 6. Clean-cutover rule

This rule is non-negotiable.

Slice 3 must be a **clean cutover**.

Do NOT:
- wire old grid and new adapter in parallel
- keep two active save paths
- keep two active row state systems
- leave old handlers alive “temporarily” if they still mutate real state
- mix page-owned state with hook-owned state

The transition should be short, explicit, and decisive.

### 6.1 Why this matters

The worksheet is a high-interaction surface.
Hybrid architecture here is worse than slow progress.

Hybrid state in worksheet systems creates bugs that look random:
- some edits save twice
- some edits revert unexpectedly
- some rows show stale values until refresh
- keyboard movement targets wrong cells
- autosave timing becomes nondeterministic

This must be avoided.

---

## 7. Interaction expectations during centralization

The full worksheet interaction contract may still need refinement after Slice 3, but the centralization pass must preserve the direction already established.

Target worksheet behavior remains:
- density over card-style spacing
- table/grid feel rather than scattered form boxes
- keyboard-first movement
- local-first drafting
- background persistence
- read-only catalog display at creation stage

Do not let the adapter/page rewrite regress the current product truths just to get the architecture refactor landed.

---

## 8. Risks and watchouts

### 8.1 Biggest risk

The single biggest risk now is pretending Slice 3 is a small cleanup pass.
It is not.
It is the architectural hinge.

### 8.2 Common failure mode

A partial hook integration where:
- hooks exist
- page still owns old logic
- adapter is thin or fake
- old grid still carries live behavior

That produces duplicated ownership and invisible drift.

### 8.3 Over-abstraction risk

Do not force the shared table layer to understand pricing business rules.
That would solve local friction while poisoning reuse.

### 8.4 Under-abstraction risk

Do not keep spreadsheet behavior trapped in pricing-only files once it is clearly shared behavior.
That would guarantee future copy-paste across modules.

---

## 9. Immediate next action

The next implementation chat should do this in order:

1. diagnose the current red build chain and restore green
2. confirm current worksheet-centralization files in repo
3. implement adapter + page rewrite as a clean cutover
4. confirm old grid is no longer active
5. hand off before moving to further worksheet enhancements

Do not continue into Estimate, broader pricing features, or unrelated cleanup until build is green and Slice 3 is complete.

---

## 10. Definition of done for Slice 3

Slice 3 is not done until all of the following are true:

- `PricingWorksheetPage.tsx` is a thin orchestrator
- adapter layer exists and is the active table bridge
- extracted hooks are the real owners of worksheet state and persistence
- old grid is no longer in active use
- no duplicate save path remains
- no duplicate row-state ownership remains
- build is green
- handoff clearly states what remains next

---

## 11. What comes after Slice 3

Only after adapter + page reduction is complete and stable:
- remove obsolete grid implementation
- finalize deeper keyboard interaction refinements
- extend worksheet reuse into bids flow more explicitly
- then proceed toward estimate baseline and downstream integration work

Do not treat “shared table exists” as the same thing as “worksheet centralization is complete.”

---

## 12. Final directive

R02 is the active control document for the current pricing worksheet-centralization stage.

R01 still matters for broader cleanup history and sequencing context.
But the next execution pass should follow R02 for immediate worksheet work.
