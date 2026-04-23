# Worksheet Reuse Design — R02

Status: active design/control document
Last updated: 2026-04-22 America/Chicago
Branch target: `dev`
Purpose: update the worksheet-reuse design after pricing successfully cut over to the orchestrated worksheet stack, while preserving discipline around what is truly reusable versus what is still pricing-local.

---

## 1. Why this revision exists

R01 was written while pricing was still in a transitional state.
At that time, the live worksheet had been moved back to the legacy page for safety and the new stack was still a parked path undergoing parity work.

That is no longer the repo reality.

Pricing has now been cut over live to the orchestrated worksheet stack and the branch is green.
That means this document must now shift from:

- “how to get safely to cutover”

to:

- “how to use pricing as the active reference implementation without overstating system-wide reuse”

---

## 2. Current worksheet-reuse truth

### 2.1 What is now proven

The repo now has a working live worksheet stack in pricing that includes:

- shared UI primitive via `EditableDataTable`
- pricing adapter layer
- pricing state layer
- pricing persistence layer
- thin orchestrated composition layer
- live wrapper routing through the orchestrated stack

This means worksheet centralization is no longer theoretical in pricing.

### 2.2 What is still not proven

The platform still does **not** yet have a fully proven module-agnostic worksheet system.

Reasons:

- pricing is the only active live adopter
- much of the deeper interaction behavior still lives in pricing-local adapter/state code
- no second module has adopted the stack through adapter + persistence only
- mobile still follows a separate presentation model rather than a unified worksheet model

So the correct current statement is:

```text
shared worksheet primitive exists
pricing is now the active reference implementation
shared multi-module worksheet reuse is not yet proven
```

### 2.3 Why this distinction matters

Future chats must not confuse:

- “pricing is live on the new stack”

with:

- “the reusable worksheet system is fully solved for the platform”

The first statement is true.
The second statement is not yet true.

---

## 3. Updated architectural target

The target remains:

```text
[ Shared UI Primitive ]
EditableDataTable

[ Shared Worksheet Interaction Layer ]
worksheet editing/focus/nav/virtualization contract

[ Module Adapter Layer ]
pricing adapter
future module adapters

[ Module Persistence Layer ]
module-specific loading/saving/create/revision behavior

[ Thin Module Composition Layer ]
page/orchestrator for each module
```

What has changed is that pricing now occupies the first real live instance of this shape.

---

## 4. What pricing now proves

Pricing now proves all of the following are viable in the repo:

- shared table foundation can support dense worksheet editing
- extracted module-local state can own row drafts/undo/autosave behavior
- extracted persistence can own data loading and saves cleanly
- an orchestrated page can replace a worksheet god component
- adapter-based composition can keep shared UI separated from pricing meaning

That is real progress and should not be minimized.

---

## 5. What pricing does **not** prove yet

Pricing does **not** yet prove that the platform has a reusable worksheet system for multiple modules.

That still requires:

### 5.1 Cleaner boundary between shared behavior and pricing-local behavior

Some interaction behaviors are clearly generic worksheet behaviors, but still live in pricing-local files.
Those should eventually be evaluated for promotion into a shared worksheet interaction layer.

Examples include:
- cell-to-cell navigation rules
- active-cell lifecycle behavior
- focus restoration behavior
- virtualization/window coordination
- keyboard movement contract for dense worksheets

### 5.2 A second adopter

The architecture is not truly proven reusable until another module can adopt the worksheet stack mainly by supplying:

- its own adapter
- its own persistence
- minimal composition work

without rebuilding the interaction engine from scratch.

### 5.3 A deliberate position on mobile worksheet behavior

Mobile currently remains a separate list/card presentation path.
That may be practical, but it means worksheet-family reuse is not fully unified across breakpoints.

---

## 6. Updated rules for future chats

### Rule 1 — pricing is now the active worksheet reference implementation

Future chats should start from that assumption unless a concrete regression forces rollback.

### Rule 2 — do not downgrade the live wrapper casually

Do not point the live pricing wrapper back to the legacy page without a specific regression-backed reason.

### Rule 3 — do not call worksheet reuse “done” yet

Even after cutover, the platform still has only one live adopter.

### Rule 4 — do not over-generalize too early

Shared worksheet layers should only absorb behavior that is truly common across worksheet-family modules.
Pricing business rules still belong in pricing-local files.

### Rule 5 — clean up the reference implementation before adding the second adopter

Pricing should be clarified and cleaned enough that future adoption copies the architecture, not the transitional mess.

---

## 7. Active sequence after cutover

While this task remains active, future chats should work in this order.

### Step 1 — keep `dev` green

Still mandatory.

### Step 2 — preserve the live orchestrated path

Do not casually reopen the cutover decision.

### Step 3 — perform post-cutover cleanup

Identify and reduce dead old-path usage, and clarify which files are still authoritative.

### Step 4 — evaluate shared worksheet interaction extraction

Only after cleanup clarity should future chats decide what interaction logic deserves promotion upward.

### Step 5 — choose a second adopter deliberately

Only after Step 4 is clear.

---

## 8. Updated definition of success

This worksheet-reuse effort should be considered fully successful only when all of the following are true:

- pricing is stable on the orchestrated stack
- the old pricing live path is no longer needed
- dead transitional code has been intentionally reduced
- shared worksheet interaction behavior is more clearly separated from pricing-local behavior
- a second module can adopt the system mainly through adapter + persistence work

Until then, the system is improved and live — but not fully generalized.

---

## 9. What future chats should read

While this active task continues, future chats should reference:

1. `docs/design/module_structure`
2. `docs/design/module_design_strategy_r01.md`
3. `docs/design/module_design_strategy_r02.md`
4. `docs/modules/pricing/cleanup_plan_r01.md`
5. `docs/modules/pricing/cleanup_plan_r02.md`
6. `docs/modules/pricing/cleanup_plan_r03.md`
7. `docs/modules/pricing/worksheet_reuse_design_r02.md`
8. `docs/modules/pricing/worksheet_centralization_handoff_r02.md`

This document should now replace R01 as the primary worksheet-reuse design/control doc for the pricing task.

---

## 10. Directive for the next series of chats

When future chats resume this task, they should explicitly answer these before making changes:

1. Is `dev` green right now?
2. Is the live pricing wrapper still on the orchestrated stack?
3. Is the next change reducing cleanup ambiguity, improving shared extraction, or just adding more structure without removing any?

If the answer to question 3 is “adding more structure without removing ambiguity,” stop and redesign before coding.

---

## 11. Final directive

The right next direction is now:

- keep pricing stable on the orchestrated stack
- clean up legacy ambiguity
- extract only truly shared worksheet interaction behavior
- then prove reuse with a second module

That sequence preserves the gains from cutover without pretending the cross-module problem is already solved.
