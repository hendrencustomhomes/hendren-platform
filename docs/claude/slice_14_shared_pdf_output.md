# Slice 14 — Shared PDF / Output Foundation + Proposal PDF

**Date:** 2026-05-02
**Branch:** claude/audit-worksheet-stability-nIwtF → dev
**Reference:** design/estimate_system_execution_plan_r02.md, docs/claude/slice_13_proposal_preview.md

---

## Objective

Create a reusable PDF/output component layer under `src/components/pdf/` that can back
Proposal PDF now and other module exports later. Implement Proposal PDF as the first
consumer at `/jobs/[id]/proposal/pdf`.

---

## Architecture Rule Adherence

### Shared PDF layer (`src/components/pdf/`) knows about:
- Page layout / document shell
- Document header (title, subtitle, metadata blocks, total)
- Section blocks (title, subtotal, children)
- Line-item table (column headers + depth-indented rows)
- Totals block (label/value rows with optional bold)
- Footer (generated date, optional note)
- Print/download trigger (client component, `window.print()`)
- Print CSS (`@media print` rules via `<style>` tag in DocShell)

### Shared PDF layer does NOT know about:
- Estimates, worksheet rows, proposal statuses
- Pricing source logic, selections, bids
- Locking/signing/voiding rules
- Any module-specific business rules

### Proposal-specific consumer (`proposal/pdf/page.tsx`) owns:
- Data fetching (estimate, worksheet rows, proposal structure)
- Status/lock awareness (derive/reconcile/freeze structure)
- Mapping `ProposalLineItem` → `DocLineItemRow`
- Mapping `ProposalSection` → `DocSection` + `DocLineItemTable`
- Status badge colors and label capitalization
- "Internal estimate" footer note

---

## Approach: CSS Print / Browser PDF

No binary PDF framework was introduced. The PDF route is a server-rendered HTML page
with print-optimized CSS (`@media print`) and a client-side `PrintButton` that calls
`window.print()`. The browser's "Save as PDF" dialog produces the output.

Reasons:
- No new dependencies
- Matches existing Next.js inline-style patterns
- Works for construction proposals (single-column, no complex layout)
- Print/PDF quality is adequate for internal-use documents

---

## Files Added / Changed

| File | Change |
|---|---|
| `src/components/pdf/DocShell.tsx` | **New** — document wrapper; emits `@media print` CSS; hides `.doc-no-print` elements |
| `src/components/pdf/DocHeader.tsx` | **New** — title, subtitle, meta items (plain or badge), optional top-right total |
| `src/components/pdf/DocSection.tsx` | **New** — section card with uppercase title and optional subtotal, wraps children |
| `src/components/pdf/DocLineItemTable.tsx` | **New** — column headers + depth-indented line rows; exports `DocLineItemRow` type |
| `src/components/pdf/DocTotalsBlock.tsx` | **New** — stacked label/value rows; exports `DocTotalsRow` type |
| `src/components/pdf/DocFooter.tsx` | **New** — generated date + optional note |
| `src/components/pdf/PrintButton.tsx` | **New** — `'use client'` button that calls `window.print()`; has `.doc-no-print` class |
| `src/app/jobs/[id]/proposal/pdf/page.tsx` | **New** — proposal-specific server component consumer |
| `src/app/jobs/[id]/proposal/preview/page.tsx` | Add "PDF →" link in slim nav |
| `src/app/jobs/[id]/proposal/page.tsx` | Add "PDF →" link in header card links row |

---

## Shared PDF Components

### `DocShell`
```tsx
DocShell({ children: ReactNode })
```
Wraps printable content. Emits a `<style>` tag with:
- `@media print { .doc-no-print { display: none !important } }`
- `@page { margin: 1.5cm 1.5cm; size: letter }`
- `body { background: white !important }`

### `DocHeader`
```tsx
DocHeader({
  title: string
  subtitle?: string
  meta?: Array<{ label?: string; value: string; badge?: { bg: string; color: string } }>
  totalLabel?: string
  totalValue?: string
})
```
Badge items render as colored pill spans. Plain items render as muted text.
Total appears top-right when provided.

### `DocSection`
```tsx
DocSection({ title: string; subtotal?: string; children?: ReactNode })
```
Card with uppercase letter-spaced section title and optional right-aligned subtotal.
Children are rendered below the header (typically `DocLineItemTable`).

### `DocLineItemTable`
```tsx
DocLineItemTable({ rows: DocLineItemRow[]; indentPerDepth?: number })
```
`DocLineItemRow`:
```typescript
{ id, depth, description, qty?, unitPrice?, total?, isNote? }
```
Renders column headers (Description / Qty·Unit / Unit Price / Total) then one row
per item, with left-padding proportional to `depth * indentPerDepth`. Notes are
italic/muted; `unitPrice` and `total` suppressed for notes.

### `DocTotalsBlock`
```tsx
DocTotalsBlock({ rows: DocTotalsRow[] })
```
`DocTotalsRow`: `{ label, value, bold? }`. Stacked rows with optional bold styling
on the final total line. Accepts multiple rows (e.g., subtotal + tax + total).

### `DocFooter`
```tsx
DocFooter({ generatedAt: string; note?: string })
```
Small muted footer with generated timestamp left, optional note right.

### `PrintButton` (client)
```tsx
PrintButton({ label?: string })
```
Button with `.doc-no-print` class (hidden when printing). Calls `window.print()`.
Default label: "Print / Save as PDF".

---

## Proposal PDF Consumer

Route: `/jobs/[id]/proposal/pdf`

### Data fetching
Identical pattern to `preview/page.tsx`:
1. Auth guard
2. Job row
3. Estimates → active estimate
4. Parallel: worksheet rows + `proposal_structures` record
5. Derive / reconcile / freeze structure based on `locked_at`
6. `applyStructure` → `ProposalSummary`

### Lock/status handling
| State | Behavior |
|---|---|
| Draft (unlocked) | `reconcileStructure` called; read-only render |
| Sent (locked) | Frozen structure used; status badge shows "Sent" |
| Signed (locked) | Frozen structure used; status badge shows "Signed" |
| Voided | Frozen or derived structure; status badge shows "Voided" |

PDF generation never mutates proposal or estimate state.

### Content rendered
- Job name (large title)
- Estimate title + status badge
- Grand total top-right
- Per-section: UPPERCASE title, subtotal, column-header row, line items
- Grand total footer bar
- Generated date/time + "Internal estimate" note

### Navigation
- Back arrow → preview page
- "Print / Save as PDF" button (hidden on print)
- Nav bar hidden entirely when printing

---

## Reusability for Future Modules

The shared `src/components/pdf/` components have no proposal-specific imports.
Future consumers (change order summaries, scope documents, cost reports, etc.) can:

1. Import any combination of `DocShell`, `DocHeader`, `DocSection`, `DocLineItemTable`,
   `DocTotalsBlock`, `DocFooter`, `PrintButton`
2. Map their own data types to the generic `DocLineItemRow` / `DocTotalsRow` shapes
3. Add/omit columns by passing different `meta` arrays to `DocHeader`
4. The `.doc-no-print` CSS class is available to any element on any page that imports
   a `DocShell` (since the `<style>` tag is document-wide)

---

## Transformation Logic Reuse

| Module | Source |
|---|---|
| `deriveDefaultStructure` | `@/lib/proposalStructure` (unchanged) |
| `reconcileStructure` | `@/lib/proposalStructure` (unchanged) |
| `applyStructure` | `@/lib/proposalStructure` (unchanged) |
| `fmtCurrency`, `fmtQty`, `fmtUnitPrice`, `INDENT_PER_DEPTH` | `@/lib/proposalFormatters` (unchanged) |

No transformation logic was duplicated; all existing utilities are imported as-is.

---

## Validation Run

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass — 13.8s |
| TypeScript | Pass — 14.8s |
| Static prerender error | Pre-existing Supabase env-var failure — unrelated |

---

## Limitations

- **No binary PDF**: Output requires browser "Print → Save as PDF". No server-side
  PDF generation (no headless Chrome, no React-PDF, no Puppeteer).
- **No stored snapshot**: Each view of `/proposal/pdf` recomputes live from the
  current worksheet + structure. If the estimate changes after "sent", the PDF view
  will differ from what was presented to the client unless the proposal is locked.
- **Print layout is browser-dependent**: Column widths and page breaks depend on the
  browser's print engine. Tested at letter size with 1.5cm margins.

---

## Risks / Follow-up Items

1. **No snapshot storage**: Per the architecture plan, `Proposal PDF → Document`.
   A future slice should generate and store the PDF blob in `documents` so the
   proposal record has a permanent artifact. This requires server-side PDF generation.

2. **Page-break control**: Long sections with many line items may break awkwardly
   across print pages. Adding `page-break-inside: avoid` on `DocSection` would help
   but may cause blank space on short pages.

3. **Column widths on narrow paper**: The `1fr 100px 80px 90px` grid is designed for
   ~760px content width. On A4 with different margins it may clip. A future slice
   could make column widths configurable per module.

4. **No public/client-facing URL**: PDF page requires authentication. A future slice
   could add a time-limited public token route for sending proposals to clients.
