# Actions GPT — Current State

Status: authoritative current-state file for fresh sessions  
Branch: `dev`  
Last updated: 2026-05-03

---

## 1. Active execution track

Primary track: **Estimate → Proposal → Send pipeline (Slices 06–20)**

Locked flow:

Price Sheets / Bids → Selections → Estimate → Proposal → Financials

---

## 2. Last verified completed work

Latest completed slice: **Slice 20 — worksheet persistence guardrails**

Recent completed slices:
- **Slice 19 — estimate lock / status guardrails**
- **Slice 20 — worksheet persistence guardrails**

Slice reports:
- `docs/actions/slices/slice_19_estimate_lock.md`
- `docs/actions/slices/slice_20_worksheet_persistence_guardrails.md`

---

## 3. Current platform state (verified)

### Estimate / Proposal
- End-to-end pipeline exists
- Estimate editability has a canonical rule: `isEstimateEditable()` in `src/lib/estimateTypes.ts`
- Estimate mutation guardrails now enforce draft/active + unlocked status for key estimate/worksheet operations
- No validation or completeness enforcement before send

### Pricing
- Orchestrated pricing system active
- Linking is manual but **server-hardened (permissions + job scope + estimate editability)**
- No automatic resolution hierarchy

### Worksheet persistence
- `job_worksheet_items` is active source of truth
- Worksheet row create/update/delete/restore/sort mutations now route through server actions with estimate editability enforcement
- Direct client-side Supabase writes from `useJobWorksheetPersistence` were removed

### Data model / DB enforcement
- Application-layer guards are now in place for estimate/worksheet mutations
- RLS on `job_worksheet_items` has not been audited or tightened

---

## 4. Known gaps (verified)

- No estimate completeness signal
- No pricing resolution logic
- No send validation
- RLS policies for `job_worksheet_items` have not been audited against estimate editability
- `setActiveEstimate` can activate a locked estimate; review if `locked_at` semantics evolve
- Estimate approval flow/status transitions are not yet fully developed

---

## 5. Next recommended slices

1. **RLS audit for `job_worksheet_items` estimate editability**
2. **Estimate health indicators (read-only)**
3. **Send validation / pre-send guardrails**

---

## 6. Summary

System is feature-complete enough for the current Estimate → Proposal → Send path, and estimate mutation guardrails are now substantially stronger at the application layer.

Remaining safety work should focus on DB/RLS enforcement, estimate completeness visibility, and send validation before expanding pricing automation or proposal redesign.
