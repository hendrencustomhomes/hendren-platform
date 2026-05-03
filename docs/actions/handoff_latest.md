# Handoff — 2026-05-03 (Slices 19–20 Guardrail Completion)

---

## What changed this session

### 1. Slice 19 — Estimate lock / status guardrails
- Introduced canonical editability rule:
  - `isEstimateEditable(estimate)` in `src/lib/estimateTypes.ts`
- Enforced across:
  - estimate rename
  - pricing link/unlink
  - worksheet UI gating
- UI now disables interactions when estimate is not editable

### 2. Slice 20 — Worksheet persistence guardrails
- Closed remaining mutation gap from Slice 19
- All `job_worksheet_items` mutations now routed through server actions
- Removed direct client-side Supabase writes from `useJobWorksheetPersistence`
- All mutations now enforce estimate editability before write

### 3. Enforcement architecture (current)

Single source of truth:
- `isEstimateEditable()`

Server enforcement:
- estimate actions
- pricing link actions
- worksheet item actions

UI enforcement:
- worksheet page + adapter + table gating

System is now guarded at both UI and server layers.

---

## Current state

- Estimate → Proposal → Send pipeline exists end-to-end
- Estimate editability is enforced across:
  - estimate-level mutations
  - pricing link/unlink
  - worksheet row mutations
- Worksheet persistence now fully server-routed

Remaining gaps:
- No estimate completeness signal
- No pricing resolution logic
- No send validation
- RLS not aligned with application guardrails

System is now **functionally complete and partially safe**, with remaining risk at DB enforcement layer.

---

## Next step (locked)

### Slice: RLS audit for `job_worksheet_items`

Scope:
- Audit Supabase RLS policies for `job_worksheet_items`
- Ensure locked estimates cannot be mutated via direct API access
- Align DB enforcement with `isEstimateEditable()` semantics
- Prefer minimal changes (policies or functions), no broad schema redesign

Follow-up slices:
- Estimate health indicators (read-only)
- Send validation / pre-send guardrails

---

## What NOT to touch

- Do NOT rebuild worksheet system
- Do NOT introduce pricing resolution logic yet
- Do NOT redesign proposal system
- Do NOT expand scope beyond guardrails and enforcement

---

## current.md updated?

Yes — updated to reflect Slices 19–20 and corrected system state
