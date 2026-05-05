# Slice 13 — Proposal Preview

**Date:** 2026-05-02
**Branch:** claude/audit-worksheet-stability-nIwtF → dev
**Reference:** design/estimate_system_execution_plan_r02.md, docs/slices/slice_12_5_builder_sync_lock.md

---

## Objective

Add a clean, read-only proposal preview at `/jobs/[id]/proposal/preview` that renders
the same data as the summary page but in a client-facing format. Also extract shared
formatting utilities into a single module to eliminate duplication between views.

---

## Locked Business Rules

| Rule | Implementation |
|---|---|
| Preview uses identical transformation pipeline | `deriveDefaultStructure` / `reconcileStructure` / `applyStructure` |
| Locked proposals: frozen structure | `reconcileStructure` not called when `locked_at IS NOT NULL` |
| Unlocked proposals: auto-sync on every load | `reconcileStructure` called before `applyStructure` |
| No editing in preview | Server component only; no action buttons, no form controls |
| Navigation links to summary and builder | Slim nav bar with back link + "Edit/View structure →" link |

---

## Files Added / Changed

| File | Change |
|---|---|
| `src/lib/proposalFormatters.ts` | **New** — shared `fmtCurrency`, `fmtQty`, `fmtUnitPrice`, `INDENT_PER_DEPTH` |
| `src/app/jobs/[id]/proposal/preview/page.tsx` | **New** — server component, full preview implementation |
| `src/app/jobs/[id]/proposal/page.tsx` | Use `proposalFormatters`; add "Preview →" link to header card |
| `src/components/patterns/proposal/ProposalBuilderOrchestrator.tsx` | Fix Nav children issue; add "Preview →" link inside header card |

---

## `proposalFormatters.ts`

Extracted from `proposal/page.tsx` to avoid duplication across summary, preview, and
any future PDF/print views:

```typescript
export const INDENT_PER_DEPTH = 16
export function fmtCurrency(val: number): string { ... }
export function fmtQty(quantity, unit): string { ... }
export function fmtUnitPrice(val): string { ... }
```

---

## Preview Page Layout

```
[sticky nav: ‹ back | title | Edit/View structure →]

[header card]
  Job name (large)
  Estimate title · status badge
                               Total: $X,XXX.XX

[section card × N]
  SECTION TITLE          $X,XXX.XX   ← uppercase + right-aligned subtotal
  Description  Qty/Unit  Unit Price  Total   ← column header row
  line items with depth-proportional indent
  ...

[grand total bar]
  Total                  $X,XXX.XX
```

---

## Nav Fix

`Nav.tsx` does not accept `children`. The builder orchestrator was incorrectly passing
a `Preview →` anchor as a Nav child. Fixed by:
1. Self-closing the Nav call: `<Nav title=... back=... jobId=... />`
2. Placing the Preview link inside the header card's subtitle area instead

---

## Data-Fetching Pattern

Identical to `proposal/page.tsx`:
1. Auth guard
2. Job row (name only)
3. Estimates for job (using `ESTIMATE_SELECT`) → find `status = 'active'`
4. Parallel: worksheet rows + proposal structure record
5. Derive / reconcile / freeze structure based on `locked_at`
6. `applyStructure` → `ProposalSummary`

---

## Validation Run

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass |
| TypeScript | Pass |

---

## Intentionally Not Implemented

- PDF generation / print stylesheet
- Client-facing public link (no-auth URL)
- Branding / logo header
- Stored snapshots (preview always computed live from current worksheet)
- Signature block
