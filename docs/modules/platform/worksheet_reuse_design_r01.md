# Worksheet Reuse Design — R01

Status: active design/control document
Last updated: 2026-04-22 America/Chicago
Branch target: `dev`
Purpose: define the path from a pricing-local spreadsheet implementation to a reusable worksheet system that can be adopted safely by multiple modules without regression.

---

## 1. Why this document exists

The current active task is no longer just “make pricing cleaner.”
It is now:

- preserve the working pricing worksheet behavior
- finish centralizing worksheet behavior correctly
- move the spreadsheet foundation into a form that other modules can adopt later
- avoid leaving the repo in a permanent half-old / half-new state

The project now has enough partial worksheet-centralization work in the repo that future chats need a single design/control document to reference.
Without that, every new chat risks making one of three mistakes:

- assuming the work is further along than it really is
- assuming the rewrite should be reverted entirely
- shipping a structurally cleaner but behaviorally worse worksheet

This document exists to prevent that.

---

## 2. Current repo reality

At time of writing, the worksheet effort has produced real reusable infrastructure, but the full reusable worksheet system is not complete.

### 2.1 What is already true

The repo now contains a real shared table foundation:

- `src/components/data-display/EditableDataTable.tsx`

That means the lowest UI layer has already been moved into a neutral, reusable location.

The repo also contains the beginnings of a pricing-local worksheet stack:

- `src/components/patterns/pricing/PricingWorksheetTableAdapter.tsx`
- `src/components/patterns/pricing/_lib/pricingWorksheetColumns.tsx`
- `src/components/patterns/pricing/_hooks/usePricingWorksheetState.ts`
- `src/components/patterns/pricing/_hooks/usePricingWorksheetPersistence.ts`
- `src/components/patterns/pricing/PricingWorksheetPageOrchestrator.tsx`

This is meaningful progress.
It should not be ignored.

### 2.2 What is not yet true

The platform does **not** yet have a proven module-agnostic worksheet system.

Reasons:

- the live pricing route had to be pointed back to the original worksheet page to avoid behavioral regression
- the new pricing worksheet path is not yet proven behaviorally equivalent
- the extracted hooks and adapter are still pricing-specific, not platform-generic
- no second module has adopted the new worksheet stack yet

So the current state is:

```text
shared worksheet primitive exists
pricing-local worksheet rewrite exists
pricing-local rewrite is not yet the proven active path
multi-module worksheet reuse is not yet achieved
```

### 2.3 Current danger point

The danger is not that the shared-table direction is wrong.
The danger is that the repo could get stuck in a permanent intermediate state with:

- original worksheet still required for correctness
- new worksheet path kept around “for later”
- no decisive parity pass
- no second adopter

That would create structural clutter instead of structural cleanup.

---

## 3. Core truth that must guide future chats

The platform now has **two different goals** that must not be confused.

### Goal A — shared table primitive
This means:
- generic editable table UI
- generic table columns
- generic focus/edit mechanics
- generic virtualization support

This goal has started successfully.

### Goal B — reusable worksheet system
This means:
- shared worksheet interaction contract
- module-specific adapter layer
- module-specific persistence layer
- parity-safe adoption in more than one module

This goal is **not** complete yet.

Future chats must not claim Goal B is done merely because Goal A exists.

---

## 4. Architectural target

The target architecture should converge to this shape:

```text
[ Shared UI Primitive ]
EditableDataTable

[ Shared Worksheet Interaction Layer ]
worksheet editing/focus/nav/virtualization contract

[ Module Adapter Layer ]
pricing adapter
future estimate adapter
future takeoff/bid/selection worksheet adapters as appropriate

[ Module Persistence Layer ]
module-specific loading, saving, creation, revision behavior

[ Thin Module Composition Layer ]
page/orchestrator for each module
```

### 4.1 Shared UI primitive

Owns only truly reusable table rendering behavior:

- table shell
- sticky header behavior
- editable cells
- text / textarea / checkbox rendering
- generic virtualization slots
- generic active-cell contract

### 4.2 Shared worksheet interaction layer

This is the missing middle.

It should eventually own reusable worksheet interaction behavior such as:

- keyboard movement contract
- focus and blur rules
- active-cell lifecycle
- draft handling model
- virtualization/window coordination
- generic navigation rules for dense worksheets

This layer does **not** exist cleanly yet.

### 4.3 Module adapter layer

Each module should define:

- columns
n- formatting
- row-to-cell mapping
- module-specific display behavior
- how shared worksheet events translate into module state changes

For the active task, this is pricing’s adapter layer.

### 4.4 Module persistence layer

Each module owns:

- loading data
- saving edits
- create-row behavior
- revision behavior
- access control
- domain-specific persistence rules

### 4.5 Thin composition layer

Each module page should be an orchestrator only.
It should initialize the module hooks and render the adapter-driven worksheet, not own spreadsheet engine logic.

---

## 5. What is required before this is truly reusable across modules

This is the key section.

### 5.1 Pricing must become the reference implementation

Pricing is the proving ground.
Before anything else is reused, the pricing worksheet must successfully run on the new stack with zero behavioral regression.

That means:

- all current keyboard behavior preserved
- all focus rules preserved
- all autosave behavior preserved
- all virtualization behavior preserved
- all mobile behavior preserved
- all row-state behavior preserved
- no hidden regression accepted just because the structure is cleaner

Until pricing is correct on the new path, there is no reusable worksheet system — only a reusable table primitive.

### 5.2 The old pricing path must become removable

The old pricing worksheet page should remain available only until parity is proven.
Once parity is proven, the old live path must become removable.

If future chats keep both paths indefinitely, the rewrite has failed to clean anything up.

### 5.3 Shared behavior must be separated from pricing behavior

Future chats must deliberately distinguish:

#### Shared-worthy behavior
- generic cell navigation
- focus movement
- dense worksheet layout behavior
- virtualization rules
- active-cell lifecycle
- draft lifecycle

#### Pricing-only behavior
- pricing columns
- pricing header/meta workflow
- pricing row patch semantics
- pricing formatting rules
- pricing persistence endpoints

If those stay mixed together, reuse across modules will become copy-paste instead of architecture.

### 5.4 A second adopter must prove the design

The worksheet design is not proven until a second module can adopt it primarily by supplying:

- its own adapter
- its own persistence
- minimal composition logic

without rewriting the shared worksheet foundation again.

That second adopter should only happen **after** pricing parity is complete.

---

## 6. Active-task sequence

While this task is active, future chats should work in this order.

### Step 1 — keep branch green

No further worksheet architecture work matters if `dev` is red.
Every pass must keep the branch buildable.

### Step 2 — keep live pricing behavior safe

If the original pricing page is still the only parity-safe path, preserve that until the new path is fully equivalent.
Do not force the rewrite live just because the structure looks better.

### Step 3 — finish pricing parity on the new path

This is the next real milestone.
The new pricing worksheet path must be made behaviorally identical enough to replace the old one without hesitation.

### Step 4 — switch pricing to the new path cleanly

Once parity is real:
- make the new path active
- keep build green
- verify behavior
- then remove dead hybrid logic deliberately

### Step 5 — extract the true shared worksheet interaction layer

Only after pricing proves the architecture should future chats decide what interaction behavior deserves to become module-agnostic.

### Step 6 — adopt in a second module

That is the proof that the reusable worksheet system is real.

---

## 7. Rules future chats must follow

### Rule 1 — do not confuse “shared table exists” with “worksheet centralization is done”

That claim would be false.

### Rule 2 — do not ship a cleaner architecture that regresses behavior

The worksheet is a primary editing surface.
A structure win does not justify a workflow loss.

### Rule 3 — do not let the repo live forever in parallel-system mode

A temporary dual-path state may be acceptable during transition.
A permanent one is failure.

### Rule 4 — do not generalize pricing business rules upward

Shared layers should own shared worksheet behavior, not pricing semantics.

### Rule 5 — do not attempt second-module adoption before pricing is proven

That would multiply uncertainty instead of validating reuse.

---

## 8. Immediate active-task definition of done

The active worksheet-reuse effort should not be considered successful until all of the following are true:

- `dev` is green
- pricing can run on the new worksheet path without regression
- the old pricing worksheet live path is no longer needed
- shared worksheet behavior is clearly separated from pricing-only behavior
- future module adoption can happen through adapter + persistence work rather than another rewrite

Until then, the work is still in transition.

---

## 9. What future chats should read

While this task remains active, future chats should reference this document **along with**:

1. `docs/design/module_structure`
2. `docs/design/module_design_strategy_r01.md`
3. `docs/design/module_design_strategy_r02.md`
4. `docs/modules/pricing/cleanup_plan_r01.md`
5. `docs/modules/pricing/cleanup_plan_r02.md`
6. `docs/modules/pricing/worksheet_centralization_handoff_r01.md`
7. `docs/modules/pricing/worksheet_reuse_design_r01.md`  ← this document

This document should be treated as the active design/control document specifically for the worksheet-reuse portion of the pricing task.

---

## 10. Directive for the next series of chats

When the active task resumes in future chats, those chats should explicitly state that they are referencing:

- the pricing cleanup/worksheet control docs
- this worksheet reuse design doc

and then they should answer these three questions before making changes:

1. Is `dev` green right now?
2. Is the live pricing worksheet still on the original parity-safe path or the new path?
3. Is the next change improving pricing parity, improving shared reuse, or just creating more parallel structure?

If the answer to question 3 is “more parallel structure,” stop and redesign before writing code.

---

## 11. Final directive

This document is intended to keep future chats disciplined while the worksheet-reuse task is active.

The correct direction remains:
- preserve working pricing behavior
- complete pricing parity on the new stack
- then promote what is truly shared
- then prove reuse with a second module

Anything that skips those steps risks creating a cleaner-looking but less trustworthy system.
