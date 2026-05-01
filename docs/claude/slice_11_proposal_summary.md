# Slice 11 — Proposal Summary Foundation

**Date:** 2026-05-01
**Branch:** claude/audit-worksheet-stability-nIwtF → dev
**Reference:** design/estimate_system_execution_plan_r02.md, docs/claude/slice_10_import_export.md

---

## Objective

Create the first client-facing layer: a read-only Proposal Summary that transforms the
active estimate's worksheet rows into a structured, grouped, totaled view.

This is NOT:
- Final proposal UI
- PDF generation
- A new data table or persistence layer
- Editable in any way

This IS:
- A pure derived view of the active estimate
- Grouped by section (top-level worksheet rows)
- Subtotaled per section, grand-totaled across all sections
- Safe to render with malformed or missing hierarchy

---

## Files Added

| File | Purpose |
|---|---|
| `src/lib/proposalSummary.ts` | Transformation logic — pure functions, no React |
| `src/app/jobs/[id]/proposal/page.tsx` | Server-rendered route + read-only view |

---

## Transformation Logic (`src/lib/proposalSummary.ts`)

### Types

```typescript
ProposalLineItem  — single row in display order, with pre-computed lineTotal and depth
ProposalSection   — top-level row as section header + flattened descendants + subtotal
ProposalSummary   — array of sections + grandTotal
```

### `buildProposalSummary(rows: JobWorksheetRow[]): ProposalSummary`

**Step 1 — Build lookup structures:**
- `rowsById: Map<string, JobWorksheetRow>` — O(1) parent lookup
- `childrenByParent: Map<string, JobWorksheetRow[]>` — O(1) children lookup

**Step 2 — Find top-level rows:**
- A row is top-level if `parent_id` is null or `parent_id` is not found in `rowsById`
- Orphaned rows (parent_id set but parent missing) are promoted to top-level — no crash
- Sorted by `sort_order`

**Step 3 — Flatten descendants (per section):**
- `flattenDescendants(parentId, depth)` — recursive DFS, sorted by `sort_order` at each level
- Returns `ProposalLineItem[]` with 1-based depth (direct child of section = depth 1)
- Each item carries `lineTotal = rowTotal(row)` (= `quantity × unit_price`, or 0 if either missing)

**Step 4 — Section subtotal (leaf-total approach):**
- `leafTotal(row)` — recurses until a row has no children
- Leaf rows contribute `rowTotal(row)` to the subtotal
- Rows with children are NOT counted themselves — only their leaves are
- This prevents double-counting when both a parent and its children carry prices
- Recursion depth capped by worksheet max depth (8)

**Step 5 — Grand total:**
- Sum of all section subtotals

---

## Grouping and Subtotal Approach

| Concept | Rule |
|---|---|
| Section | Each top-level row (parent_id = null or parent not found) |
| Section order | Sorted by `sort_order` ascending |
| Line items | All descendants, flattened DFS, sorted by `sort_order` |
| Depth display | Indented 16px per depth level (relative to section) |
| Section subtotal | Sum of `rowTotal` for all leaf descendants |
| Row with no children | Counts its own `rowTotal` as a leaf |
| Row with children | Does not count its own `rowTotal` (avoids double-counting) |
| Note rows | Displayed in italic; lineTotal shown as blank |
| Grand total | Sum of all section subtotals |

---

## How Totals Are Calculated

`rowTotal(row)` (from `_worksheetFormatters.ts`):
```typescript
const q = Number(row.quantity)
const p = Number(row.unit_price)
return q && p ? q * p : 0
```

`leafTotal(row)` (new, in `proposalSummary.ts`):
```typescript
function leafTotal(row): number {
  const children = childrenByParent.get(row.id) ?? []
  if (children.length === 0) return rowTotal(row)
  return children.reduce((sum, child) => sum + leafTotal(child), 0)
}
```

Example:
```
Section: Framing                         → leafTotal recurses into children
  Assembly: Wall Framing                 → has children → recurses
    Line: LVL Beam (5 × $120)            → leaf → contributes $600
    Line: Studs (200 × $3)               → leaf → contributes $600
  Line: Roof Sheathing (800sqft × $2)   → leaf → contributes $1,600
Section subtotal: $2,800
```

---

## Route

```
/jobs/[id]/proposal
```

Follows the existing `/jobs/[id]/worksheet` routing pattern. The page is a server component
(no client-side interactivity). It uses `PageShell` (client component) for navigation,
same as the worksheet page.

---

## Data Source

- Always loads the **active estimate** (status = 'active')
- If no active estimate exists: renders the empty state
- No estimate promotion logic in the proposal page — if no active estimate, it shows empty
  (the worksheet page handles promotion; navigate there first if needed)
- Rows fetched fresh on each server render — no caching, no stale data

---

## Empty State

| Condition | UI |
|---|---|
| No active estimate | Header shows "No active estimate"; table shows empty state text |
| Active estimate has no rows | Table shows empty state text |
| Row has null quantity or null unit_price | lineTotal = 0; displayed as blank |

---

## Malformed Hierarchy Safety

| Case | Handling |
|---|---|
| Row's parent_id not in dataset | Row promoted to top-level section |
| Circular parent references | `leafTotal` recursion is bounded by tree depth (each row is visited once via childrenByParent — no cycles possible if tree is a DAG) |
| Empty rows array | Returns `{ sections: [], grandTotal: 0 }` immediately |
| Row with no description | Displayed as-is (blank cell) — no crash |

Note: the worksheet DB enforces a max depth of 8. `flattenDescendants` follows the natural
tree structure; if the DB contains a cycle (impossible with FK + sort_order constraints),
the recursion would terminate at the memory limit. In practice this cannot happen.

---

## Limitations

1. **Leaf-total may undercount**: If a user puts a price on a parent AND prices on its
   children, only the children are counted. The parent's price is intentionally ignored
   to avoid double-counting. This is the correct behavior for most workflows (assemblies
   have child line items that carry the prices), but a user who prices both a parent and
   its children will see only child totals.

2. **No section promotion**: The proposal groups by top-level rows as sections. If a user
   structures their worksheet as flat line items (all at depth 0), each line item becomes
   its own single-item section. There is no configurable grouping.

3. **`row_kind` not used for grouping**: The spec mentions "section grouping (based on
   parent rows or row_kind)". This implementation uses parent hierarchy only. `row_kind`
   is displayed but not used as an alternate grouping key. This is sufficient for
   foundation — `row_kind`-based grouping is a Builder slice concern.

4. **No client-side interactions**: No expand/collapse, no sorting, no filtering.
   This is intentional for the foundation slice.

5. **Allowance rows**: Treated as regular line items (quantity × unit_price). No special
   allowance display logic exists yet.

---

## Risks / Follow-up Items

1. **Navigation entry point**: No link to `/jobs/[id]/proposal` has been added to the
   job detail page or the worksheet. Access the route directly by URL for now.
   A nav link should be added in a future polish slice.

2. **Active estimate guard**: The worksheet page ensures an active estimate always exists
   (creates or promotes one). The proposal page does not — it shows empty if no active
   estimate. For a clean user experience, either add the same guard to the proposal page
   or ensure users always visit the worksheet first.

3. **Internal pricing exposed**: This route is currently accessible to any authenticated
   internal user. The architecture doc (§8) requires role-based access control to prevent
   client-facing exposure of internal pricing. Permissions enforcement is deferred to a
   dedicated permissions slice.

4. **No PDF / print view**: Intentionally deferred to Slice 14.

---

## Validation Run

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass — 13.8s |
| TypeScript | Pass — 14.9s |
| Static prerender | Pre-existing Supabase env-var failure — unrelated |

---

## Intentionally Not Changed

- Worksheet system — zero modifications
- Estimate data model — no new columns or tables
- `estimate-actions.ts` — no new actions
- `_worksheetFormatters.ts` — `rowTotal` reused as-is; no duplication
- No client state, no hooks, no interactivity
- No PDF, no builder, no preview
