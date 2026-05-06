# Slice 41 — Proposal Truth Consolidation

Status: complete
Branch: `claude/slice-41-proposal-truth-CyVZ6` → `dev`
Date: 2026-05-06

---

## Goal

Ensure proposal output is structurally trustworthy and frozen against future
estimate drift. Audit every proposal-touching path. Consolidate. Remove the
last legacy `unit_price` read that bypasses the resolver.

---

## Audit Scope

All proposal-touching paths confirmed against the resolver/`rowTotal` rule.

| Path | File | Method | Result |
|---|---|---|---|
| Proposal summary builder | `src/lib/proposalSummary.ts` | `resolveUnitCost(child)`, `rowTotal(child)`, `leafTotal → rowTotal` | clean |
| Proposal structure builder | `src/lib/proposalStructure.ts` | `resolveUnitCost(child / sourceRow)`, `rowTotal(child / sourceRow)`, `leafTotal → rowTotal` | clean |
| Proposal summary page | `src/app/jobs/[id]/proposal/page.tsx` | reads `applyStructure(structure, rows)` | clean |
| Proposal preview page | `src/app/jobs/[id]/proposal/preview/page.tsx` | reads `applyStructure(structure, rows)` | clean |
| Proposal PDF page | `src/app/jobs/[id]/proposal/pdf/page.tsx` | reads `applyStructure(structure, rows)` | clean |
| Proposal builder page | `src/app/jobs/[id]/proposal/builder/page.tsx` | reads `deriveDefaultStructure / reconcileStructure` only; renders via `ProposalBuilderOrchestrator` | clean |
| Proposal builder orchestrator | `src/components/patterns/proposal/ProposalBuilderOrchestrator.tsx` | structure mutation only; no totals | clean |
| Proposal document (snapshot) page | `src/app/jobs/[id]/proposal/documents/[documentId]/page.tsx` | reads `proposal_documents.snapshot_json`; **never** re-resolves | clean |
| Proposal lifecycle actions | `src/app/actions/proposal-actions.ts` | `signProposal`, `voidProposal`, `rejectProposal`, `saveProposalStructure` (rejects on `locked_at`) | clean |
| Proposal document actions | `src/app/actions/document-actions.ts` | `createProposalSnapshot`, `sendProposal` (atomic RPC), `voidProposalDocument` | clean |
| Pre-send validation | `src/lib/estimateValidation.ts` | `resolveUnitCost(r)` | clean |
| Worksheet write paths | `src/app/actions/worksheet-item-actions.ts` | `requireEditableEstimate` → `isEstimateEditable` | clean |
| Pricing-link write paths | `src/app/actions/worksheet-pricing-actions.ts` | `isEstimateEditable` on link / unlink / accept / sync | clean |
| Estimate duplicate (row copy) | `src/app/actions/estimate-actions.ts` `duplicateEstimate` | **bypassed** resolver — fixed in this slice | **fixed** |
| Estimate import (CSV) | `src/lib/worksheetCsv.ts` | writes resolved value to `unit_cost_manual`; never sets legacy `unit_price` | clean |
| Worksheet desktop adapter | `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx` | `getValue: resolveUnitCost(row)`, `total: rowTotal(row)` | clean |
| Worksheet mobile view | `src/components/patterns/estimate/JobWorksheetMobileView.tsx` | `resolveUnitCost(row)`, `rowTotal(row)`, mobile grand total via `rows.reduce(rowTotal)` | clean |
| Worksheet CSV export | `JobWorksheetPageOrchestrator.tsx` | `resolveUnitCost(row)` for `unit_price` column | clean |

### Out-of-scope `unit_price` references confirmed correct (re-verified)

- `src/lib/pricing/revisions.ts`, `src/lib/pricing/rows.ts`, `src/lib/pricing/types.ts` — pricing module's own source-data field (`pricing_rows.unit_price`). Different table, different domain.
- `src/components/patterns/estimate/PricingLinkModal.tsx:142–144` — displays the pricing source row's `unit_price` in the link picker. Display of source, not resolution.
- `src/app/actions/worksheet-pricing-actions.ts:220, 345, 351` — read live `pricing_rows.unit_price` and copy to `unit_cost_source` at link / sync time. Correct source-side read.
- `src/app/actions/document-actions.ts:122, 237` — write `item.unit_price` into `snapshot_json`. The `item.unit_price` is the **resolved** `ProposalLineItem.unit_price` produced by `applyStructure`/`buildProposalSummary` (which call `resolveUnitCost` internally). It is never the worksheet row's legacy column.
- `src/app/jobs/[id]/proposal/page.tsx:57`, `proposal/preview/page.tsx:271`, `proposal/pdf/page.tsx:170`, `proposal/documents/[documentId]/page.tsx:144` — all render `item.unit_price` from a `ProposalLineItem` or `ProposalSnapshotItem`, both of which carry the already-resolved value.
- `src/components/patterns/pricing/**` — pricing module's own worksheet (different family, different source data). Not in proposal truth scope.

---

## Findings

### 1. Truth pipeline — clean

Every proposal totals path runs through one consolidated builder:

```
worksheet rows  ──►  applyStructure(structure, rows)  ──►  ProposalSummary
                     │
                     └─ section.subtotal  = leafTotal(sourceRow)         (recurses via rowTotal)
                        item.unit_price   = resolveUnitCost(child)
                        item.lineTotal    = rowTotal(child)              (multiplies q × resolveUnitCost)
                        grandTotal        = sum(section.subtotal)
```

Summary, preview, PDF, and `createProposalSnapshot` / `sendProposal` all
funnel through `applyStructure`. `rowTotal` is the only place `qty × price`
is computed and it always pulls price via `resolveUnitCost`. There is **no**
duplicated total-calculation logic in the proposal layer.

### 2. Freeze model — consistent

Three independent locks compose to enforce no-drift:

- **Estimate lock.** `isEstimateEditable(estimate)` (`src/lib/estimateTypes.ts`) returns true only for `draft` / `active` with no `locked_at`. All worksheet write paths (`persistWorksheetRow`, `createWorksheetRow`, `restoreWorksheetRows`, `deleteWorksheetRow`, `persistWorksheetSortOrders`) and all pricing-link write paths (`linkRowToPricing`, `unlinkRowFromPricing`, `acceptPricingSource`, `syncLinkedPricing`) gate on this. After `sendProposal` the estimate is `sent` + `locked_at`, so subsequent worksheet edits are rejected.
- **Proposal structure lock.** `proposal_structures.locked_at` is set on send. `saveProposalStructure` rejects with "Proposal is locked. Unlock it before making structural changes." `applyStructure` callers honor it: when `locked_at` is set, the saved `structure_json` is used verbatim — `reconcileStructure` is **only** called on unlocked structures (preview, PDF, summary, builder, snapshot).
- **Document snapshot lock.** `proposal_documents.snapshot_json` is write-once. `src/lib/proposalSnapshot.ts` carries an explicit AUDIT-ARTIFACT CONTRACT comment: it is never read back by app logic for business decisions; only the document page renders it for display. Verified: nothing in `src/` reads `snapshot_json` outside of `proposal/documents/[documentId]/page.tsx`.

These three locks together mean: once a proposal is `sent`, neither the
underlying worksheet rows, nor the proposal structure, nor the captured
document can drift.

### 3. The one real bug — `duplicateEstimate` bypassed the resolver

`src/app/actions/estimate-actions.ts` `duplicateEstimate` was the **only**
proposal-adjacent write path that violated the resolver contract.

Before:
- The copy carried over the legacy `unit_price` and `total_price` columns.
- The copy did **not** initialize `unit_cost_manual`, `unit_cost_source`,
  `unit_cost_override`, or `unit_cost_is_overridden`.
- The copy reset `pricing_source_row_id` and `pricing_header_id` to null
  (severing any link), but left the resolution columns null as well.

Effect:
- After duplication, `resolveUnitCost(newRow)` returned `null` on every row
  (no override, no link, `unit_cost_manual = null`).
- Proposal summary, preview, PDF, validation, snapshot, send, CSV export,
  and worksheet display all then evaluated to **$0** for every row in the
  duplicated estimate.
- The legacy `unit_price` and `total_price` carry-over was silently
  invisible because nothing in the resolver-era reads them.

This is exactly the kind of "proposal output not derived from resolved
estimate truth" failure Slice 41 names as goal #1.

### 4. No DB schema changes required

Goals #2–#5 (freeze enforcement, totals reconciliation, no resolver bypass,
lifecycle enforcement) were already satisfied at the architecture level by
slices 35–40I. Slice 41 is the audit pass that confirms it and patches the
one regression-prone copy path.

---

## Consolidations / Fixes Performed

### `src/app/actions/estimate-actions.ts` — `duplicateEstimate` row copy

1. Imported `resolveUnitCost` from `@/components/patterns/estimate/_lib/unitCostResolver`.
2. Replaced the row-copy mapping:
   - **Removed** carry-over of legacy `unit_price` and `total_price` (these
     are not used for resolution per the `JobWorksheetRow` type comment:
     "Legacy column — kept for snapshot compatibility. Do NOT use for
     resolution.").
   - **Added** `unit_cost_manual: resolveUnitCost(row)` to freeze the
     source row's resolved cost into the duplicate, since the pricing
     link is being severed (`pricing_source_row_id: null`,
     `pricing_header_id: null`). The resolver is the single source of
     truth for the override → source → manual precedence; using it here
     keeps the duplicate's resolved truth identical to the source's at
     duplication time across every pricing type (linked, overridden,
     manual, unpriced, lump_sum, allowance).
   - Reset `unit_cost_source: null`, `unit_cost_override: null`,
     `unit_cost_is_overridden: false` so the new row is self-contained
     and cannot drift if the original source pricing later changes.

The fix preserves the existing severed-link invariant (duplicates do not
re-link to the source) and adds no new total-calculation logic.

### Why this is the safe minimal fix

- Reuses `resolveUnitCost` — does not introduce any second precedence rule.
- Does not touch any other writer, reader, or DB column.
- Does not change the on-disk shape of legacy `unit_price` / `total_price`
  columns; they are still written / read by every other path that
  intentionally uses them (snapshots, etc.). The duplicate just stops
  *propagating* legacy values forward, which is correct: the resolution
  columns are now the single source of truth for the new row.

### What was deliberately NOT changed

- The legacy `unit_price` column on `job_worksheet_items` — preserved for
  snapshot compatibility per Slice 40I invariant 4. Removal is out of slice
  scope.
- The legacy `total_price` column on `job_worksheet_items` — same.
- `pricing_rows.unit_price` (pricing module source data) — different
  domain, not in scope.
- The proposal builder lock semantics, RPC, RLS — already correct, no
  change required.
- The `snapshot_json` schema — already write-once, already explicitly
  contract-documented.

---

## Files Changed

| File | Change |
|---|---|
| `src/app/actions/estimate-actions.ts` | Imported `resolveUnitCost`. Rewrote `duplicateEstimate` row-copy mapping to drop legacy `unit_price`/`total_price` carry-over and freeze `resolveUnitCost(row)` into `unit_cost_manual` on the new row, with the other three resolution columns reset. Added a comment explaining the freeze rationale. |
| `docs/modules/estimate/slice_41_proposal_truth_consolidation.md` | This file. |
| `docs/actions/current.md` | Updated to mark Slice 41 complete; updated next-recommended work. |

No DB migrations. No new tables. No new components. No new totals logic.

---

## Validation

### TypeScript

- `npx tsc --noEmit` → **clean (exit 0)**, both before and after the change.
  No proposal-side errors surfaced; no errors in the touched file.

### Audit re-verification

- All proposal total computation paths grep-audited end-to-end (table in
  Audit Scope above). Every one routes through `resolveUnitCost` and
  `rowTotal`. None bypass.
- All proposal rendering paths grep-audited. Every page reads either:
  - the live `applyStructure(structure, worksheetRows)` output (summary,
    preview, PDF, builder, send-time snapshot), or
  - the frozen `proposal_documents.snapshot_json` (document page only,
    by AUDIT-ARTIFACT CONTRACT).
- All worksheet write paths checked for `isEstimateEditable` gating —
  confirmed.
- `proposal_structures.locked_at` checked at every saver — confirmed in
  `saveProposalStructure`.
- `snapshot_json` re-read audit — only `proposal/documents/[documentId]/page.tsx`
  reads it, which is the correct (and contract-documented) consumer.

### Manual reasoning over `duplicateEstimate` after fix

For each pricing type on the source row, the new row resolves correctly:

| Source row state | `resolveUnitCost(source)` | Copy `unit_cost_manual` | Copy resolves to |
|---|---|---|---|
| Manual (no link, no override) | `unit_cost_manual` | same | same value |
| Linked, not overridden | `unit_cost_source` | source value | same value |
| Linked, overridden | `unit_cost_override` | override value | same value |
| Unpriced (no manual, no link) | `null` | `null` | `null` (correctly absent) |

In all cases the duplicate is resolver-correct from the moment it is
inserted, with no dependency on the source estimate's link.

---

## Remaining Risks

1. **Legacy columns still on disk.** `job_worksheet_items.unit_price` and
   `job_worksheet_items.total_price` remain in the schema. They are not
   read for resolution anywhere (Slice 40I confirmed; Slice 41 re-verified
   on every proposal-related path). Removing them is a future,
   intentionally-bounded slice that requires a migration audit, not a
   Slice 41 task.
2. **Builder snapshot UX.** `SnapshotCreateButton` is rendered on the
   preview page whenever `proposalStatus !== 'voided'`. After send /
   sign, the action still rejects with "Snapshots can only be created for
   active or staged estimates." The truth model is intact — this is only
   a UI consistency issue (button visibility vs. action eligibility).
   Out of Slice 41 scope; tracked for a future UI tidy.
3. **`linkRowToPricing` lacks an explicit `requireModuleAccess('estimates', 'edit')`
   call.** Other pricing-link actions have it. The function still gates on
   `isEstimateEditable`, `getCurrentPricingAccess` (canManage), and worksheet
   item job ownership, so writes are still authorized — but the permission
   check is asymmetric with peers. Surface area for a permission-audit slice,
   not Slice 41.

None of these compromise proposal truth.

---

## Invariants Confirmed After Slice 41

1. `resolveUnitCost` is the only implementation of the override → source →
   manual precedence rule. **Re-confirmed.**
2. `rowTotal` is the only place that multiplies quantity by resolved unit
   cost. **Re-confirmed.**
3. No call site reaches the legacy `job_worksheet_items.unit_price` column
   for cost computation. **Re-confirmed; the last propagation path
   (`duplicateEstimate`) was eliminated in this slice.**
4. `applyStructure` is the only proposal-totals builder. Summary, preview,
   PDF, snapshot, and send all use it. **Confirmed — no parallel system.**
5. Sent / signed proposals cannot drift: estimate is `locked_at` (blocks
   worksheet writes), proposal structure is `locked_at` (blocks structure
   saves and bypasses `reconcileStructure`), and `snapshot_json` is
   write-once (and never read back for decisions).
6. Estimate lifecycle: editable iff `draft|active && !locked_at`.
   `staged|sent|signed|rejected|voided` all locked. **Re-confirmed via
   `isEstimateEditable` and `NON_ARCHIVABLE_STATUSES`.**

---

## Out of Scope (Reaffirmed)

- DB schema changes (no migrations in this slice).
- New pricing fields, new resolver semantics.
- Removing legacy `unit_price` / `total_price` columns.
- Change orders, invoicing, accounting, QuickBooks, analytics.
- Broad UI redesign, mobile redesign, animation polish.
- Permission audits beyond what was needed to verify freeze enforcement.
- Payment systems.
