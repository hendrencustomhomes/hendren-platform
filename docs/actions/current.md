# Actions GPT — Current State

Status: authoritative current-state file for fresh sessions  
Branch: `dev`  
Last updated: 2026-05-03

---

## 1. Active execution track

Primary track: **Estimate → Proposal → Send pipeline (Slices 06–17)**

Locked flow:

Price Sheets / Bids → Selections → Estimate → Proposal → Financials

This flow is defined in:
- `design/estimate_system_execution_plan_r02.md`

---

## 2. Last verified completed work

Latest completed slice: **Slice 17 — pricing link**

Covered capabilities:
- Estimate entity + schema cleanup
- Worksheet row binding
- Removal of Scope/Takeoff UI from JobTabs
- Import / export
- Proposal builder
- Proposal preview
- PDF output
- Document snapshot system (immutable)
- Send workflow (atomic send)
- Pricing linkage

Slice reports live in:
- `docs/slices/slice_06_*` → `slice_17_*`

Audit/cleanup docs live in:
- `docs/audits/`

---

## 3. Current platform state (verified)

### Estimate / Proposal
- Estimate system exists and is primary path
- Proposal system exists (builder → preview → PDF → send)
- Snapshot system enforces immutability at send time

### Worksheet layer
- Shared worksheet engine is stable:
  - `EditableDataTable`
  - `useWorksheetInteraction`
  - `useWorksheetVirtualization`
- Estimate worksheet adapter exists
- Cleanup slices fixed structural issues (imports, validation)

### Pricing
- Pricing worksheet is the reference implementation
- Pricing centralization/orchestrated worksheet is live in code as of 2026-05-03 verification:
  - `src/components/pricing/PricingWorksheetPage.tsx` exports `@/components/patterns/pricing/PricingWorksheetPageOrchestrator`
  - `src/components/patterns/pricing/PricingWorksheetPageOrchestrator.tsx` composes persistence, state, mobile list, and table adapter layers
- Older statements claiming pricing centralization was reverted should be treated as stale unless re-verified against code
- Before modifying pricing, still inspect live imports and target files first

### Takeoff (legacy)
- Old Takeoff engine still exists
- New worksheet route uses `job_worksheet_items`
- Two sources of truth may still exist depending on UI exposure

---

## 4. Known conflicts / stale docs

### Archived stale docs (2026-05-02)

The following superseded files were moved to `docs/archive/stale-2026-05-02/`:

- `estimate_proposal_consolidation_plan_r01.md` (was `docs/claude/`)
- `anchor.md` (was `docs/modules/takeoff/`)
- `takeoff_estimate_unified_design_r01.md` (was `docs/modules/estimate/`)
- `worksheet_reuse_design_r01.md` (was `docs/modules/pricing/`)
- `worksheet_reuse_design_r02.md` (was `docs/modules/pricing/`)
- `cleanup_plan_r01.md` (was `docs/modules/pricing/`)
- `cleanup_plan_r02.md` (was `docs/modules/pricing/`)
- `worksheet_centralization_handoff_r01.md` (was `docs/modules/pricing/`)

Current replacement docs (do not archive):
- `docs/modules/estimate/takeoff_estimate_unified_design_r02.md`
- `docs/modules/pricing/worksheet_reuse_design_r03.md`
- `docs/modules/pricing/cleanup_plan_r03.md`
- `docs/modules/pricing/worksheet_centralization_handoff_r02.md`

### Resolved / downgraded — Pricing state
- Prior conflict: `docs/modules/pricing/*` said orchestrated worksheet was active while `docs/craft-agent/project_state.md` said it was reverted
- 2026-05-03 code check confirms live route exports the orchestrator
- `docs/craft-agent/project_state.md` did not resolve by direct path on `dev` during this sync; do not recreate it without confirming it still belongs in the repo

### Conflict B — Missing architecture doc
- Execution doc references `hendren_platform_architecture.md`
- File was not found by targeted search during 2026-05-03 sync

→ Action: either create the architecture doc as a deliberate docs slice or remove/replace the reference where it appears

### Downgraded — instructions.md missing-file reference
- Prior conflict: `instructions.md` referenced `docs/dev_scope.md`
- Direct fetches for `instructions.md` and `docs/instructions.md` on `dev` did not resolve during 2026-05-03 sync
- Search only surfaced a historical commit result for `docs/instructions.md`

→ Action: do not fix blindly; only address if a live `instructions.md` file is found on `dev`

---

## 5. Non-negotiable rules

- `dev` is the only source of truth
- No rebuilding shared worksheet logic
- No duplicate implementations of formatting / types
- Schema changes must use migrations
- Sessions limited to 1–3 slices
- Follow design standard:
  - `docs/design/module_structure`
  - `docs/design/module_design_strategy_r02.md`

---

## 6. Active read list (for most sessions)

Start with:

1. `docs/actions/START_HERE.md`
2. this file

Then read only:

- `design/estimate_system_execution_plan_r02.md`
- Relevant `docs/slices/slice_*` files for current area
- Module docs under `docs/modules/*` ONLY if working in that module

Do NOT bulk-read all docs.

---

## 7. Next recommended slices

Priority should be determined per session, but generally:

1. **Resolve missing architecture reference** — create `hendren_platform_architecture.md` or align the execution doc
2. **Verify next estimate/proposal gap** — inspect Slice 17 output and code before adding Slice 18 behavior
3. **Takeoff exposure audit** — verify whether old Takeoff UI/data paths remain reachable and whether `takeoff_items` still competes with `job_worksheet_items`

Do not start new systems.

---

## 8. Open risks

- Dual data models (`takeoff_items` vs `job_worksheet_items`)
- Missing architecture reference may mislead future sessions
- Stale docs outside Actions docs may still contain old path or pricing-state statements
- Hidden regressions masked by noop adapters

---

## 9. What NOT to do

- Do not trust old revision docs without verification
- Do not expand scope beyond current slice
- Do not refactor broadly without a slice boundary
- Do not assume pricing or takeoff state without checking code
- Do not recreate missing historical docs unless they are confirmed as current truth

---

## 10. Handoff expectation

At end of session:

- Update this file ONLY if durable truth changed
- Overwrite `docs/actions/handoff_latest.md`

---

## 11. Summary

The platform is **past architecture phase and deep into execution**.

The primary risk is no longer missing systems — it is **drift between docs, code, and sessions**.

This file exists to eliminate that drift.
