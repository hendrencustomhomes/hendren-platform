# Pricing Module Cleanup Plan — R03

Status: active cleanup plan
Last updated: 2026-04-22 America/Chicago
Branch target: `dev`
Purpose: record the pricing worksheet state after successful live cutover to the orchestrated worksheet stack, and define the next cleanup sequence without reopening solved parity work casually.

---

## 1. Why this revision exists

R02 was the control document for getting through worksheet centralization Slice 3 without leaving the repo in a broken hybrid state.

That phase has now materially advanced.

The pricing worksheet has been cut over live to the orchestrated stack, and the build is green.
That means the repo is no longer in the same “adapter missing / page still overloaded / grid still active” state described in R02.

This revision exists to prevent future chats from doing one of two bad things:

- acting like worksheet centralization is still stuck before cutover
- acting like all cleanup is done and immediately jumping into a second-module rollout without finishing pricing cleanup properly

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

That means future chats should treat the current pricing worksheet stack as the active reference implementation, not as an experimental parked path.

### 2.3 What is still not complete

The pricing worksheet cleanup is **not** fully complete yet.

Remaining work includes:

- removing dead old-path usage deliberately
- deciding what parts of worksheet interaction belong in a truly shared worksheet layer instead of pricing-local adapter/state code
- validating whether the legacy monolithic page should remain temporarily as rollback reference or be removed now
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

That means future chats should not route the live pricing wrapper back to the old page unless a concrete regression forces rollback.

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

Those problems were the R02 phase.

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

## 9. Final directive

R03 is the active cleanup control document for pricing after live worksheet cutover.

Future chats should treat the orchestrated pricing stack as the active path,
keep `dev` green,
and focus next on cleanup clarity rather than reopening already-solved parity work.
