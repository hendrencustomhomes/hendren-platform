# Worksheet Centralization — Handoff (R02)

Status: active handoff
Supersedes: prior worksheet centralization handoff revisions

## Status

- build green
- live pricing worksheet cut over to orchestrated stack
- shared table active
- pricing adapter active
- pricing state hook active
- pricing persistence hook active
- live wrapper now points to `PricingWorksheetPageOrchestrator`

## What was completed

Parity work landed for:

- desktop virtualization/windowing
- focus lifecycle and active-cell restoration
- row-state/autosave lifecycle behavior
- catalog-linked create-row flow
- post-create focus handoff
- `Ctrl/Cmd+Enter` create-row behavior from worksheet cells

## Current active path

- `src/components/pricing/PricingWorksheetPage.tsx`
  - exports `@/components/patterns/pricing/PricingWorksheetPageOrchestrator`

## Current caution

The system is now live on the orchestrated stack, but worksheet reuse is **not** yet proven across multiple modules.

Do not treat the cutover as the end of cleanup.

## Next task

Post-cutover cleanup and reference-implementation tightening.

### In order

1. confirm `dev` is green
2. confirm live wrapper still points to orchestrator
3. identify dead legacy-path usage and reduce it deliberately
4. decide what worksheet interaction behavior is truly shared-worthy
5. stop before second-module rollout unless that extraction plan is clear

## Critical rules

- do not point the live wrapper back to the legacy page casually
- do not declare worksheet reuse “done” yet
- do not generalize pricing-specific rules into shared UI
- do not add a second adopter before cleaning up the pricing reference implementation

## Deliverable for the next phase

- orchestrated live path remains green
- legacy ambiguity reduced
- shared-vs-pricing-local worksheet behavior clearer
- next adopter planning based on a cleaner reference implementation

## Read first in future chats

Use the **latest docs only** as operating context:

1. `docs/design/module_structure`
2. `docs/design/module_design_strategy_r02.md`
3. `docs/modules/pricing/cleanup_plan_r03.md`
4. `docs/modules/pricing/worksheet_reuse_design_r02.md`
5. `docs/modules/pricing/worksheet_centralization_handoff_r02.md`

Older revisions should only be used if a future audit specifically needs history comparison or regression checking.

## Final note

Pricing is now the active worksheet reference implementation.
The next chats should focus on cleanup clarity and shared extraction discipline, not on re-litigating whether cutover should have happened.
