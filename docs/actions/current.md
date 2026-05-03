# Actions GPT — Current State

Status: authoritative current-state file for fresh sessions  
Branch: `dev`
Last updated: 2026-05-02

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
- `docs/claude/slice_06_*` → `slice_17_*`

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
- **CONFLICT:** some docs claim centralization is live, others claim it was reverted
- Must verify actual imports before modifying pricing

### Takeoff (legacy)
- Old Takeoff engine still exists
- New worksheet route uses `job_worksheet_items`
- Two sources of truth may still exist depending on UI exposure

---

## 4. Known conflicts / stale docs

### Conflict A — Pricing state
- `docs/modules/pricing/*` → says orchestrated worksheet is active
- `docs/craft-agent/project_state.md` → says it was reverted

→ Action: verify code before any pricing work

### Conflict B — Missing architecture doc
- Execution doc references `hendren_platform_architecture.md`
- File is missing

→ Action: either create or remove reference

### Conflict C — instructions.md points to missing file
- References `docs/dev_scope.md` (does not exist)

→ Action: replace with Actions docs entry point

### Conflict D — Old estimate / takeoff docs
- Some docs describe pre-slice behavior
- Superseded by Slice 06–17 work

→ Treat as historical unless explicitly referenced

---

## 5. Non-negotiable rules

- `dev` is the only source of truth
- No rebuilding shared worksheet logic
- No duplicate implementations of formatting / types
- Schema changes must use migrations
- Sessions limited to 1–3 slices

---

## 6. Active read list (for most sessions)

Start with:

1. `docs/actions/START_HERE.md`
2. this file

Then read only:

- `design/estimate_system_execution_plan_r02.md`
- Relevant `docs/claude/slice_*` files for current area
- Module docs under `docs/modules/*` ONLY if working in that module

Do NOT bulk-read all docs.

---

## 7. Next recommended slices

Priority should be determined per session, but generally:

1. **Resolve pricing truth conflict** (inspect code vs docs)
2. **Stabilize current-state docs** (remove stale references)
3. **Fill missing architecture doc OR align execution doc**
4. **Continue estimate/proposal enhancements ONLY if gaps are verified**

Do not start new systems.

---

## 8. Open risks

- Dual data models (`takeoff_items` vs `job_worksheet_items`)
- Pricing truth ambiguity
- Stale docs misleading future sessions
- Hidden regressions masked by noop adapters

---

## 9. What NOT to do

- Do not trust old revision docs without verification
- Do not expand scope beyond current slice
- Do not refactor broadly without a slice boundary
- Do not assume pricing or takeoff state without checking code

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
