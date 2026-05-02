# Slice 12 — Proposal Builder (Structure Only)

**Date:** 2026-05-01
**Branch:** claude/audit-worksheet-stability-nIwtF → dev
**Reference:** design/estimate_system_execution_plan_r02.md, docs/claude/slice_11_proposal_summary.md

---

## Objective

Introduce a builder layer that allows controlled structuring of the Proposal Summary
WITHOUT duplicating or mutating estimate data.

The builder stores **structure only**: section order, visibility toggles, and optional title
overrides. It does NOT copy prices, quantities, or worksheet rows.

---

## Core Invariants

| Invariant | How it's enforced |
|---|---|
| No estimate data duplicated | `structure_json` contains only UUIDs and UI metadata |
| No price/quantity stored | `ProposalStructureSection` has no price or quantity fields |
| Structure tied to estimate, not global | `proposal_structures.estimate_id` FK; one record per estimate |
| Summary never breaks if structure is stale | Missing `source_row_ids` silently skipped in `applyStructure` |
| Structure is optional | No structure → derive default from worksheet on every render |

---

## Files Added / Changed

| File | Change |
|---|---|
| DB migration `create_proposal_structures` | New table `proposal_structures` with RLS |
| `src/lib/proposalStructure.ts` | New — structure types + `deriveDefaultStructure` + `applyStructure` |
| `src/app/actions/proposal-actions.ts` | New — `getProposalStructure`, `saveProposalStructure` |
| `src/app/jobs/[id]/proposal/page.tsx` | Updated — uses `applyStructure` + loads structure from DB |
| `src/app/jobs/[id]/proposal/builder/page.tsx` | New — server page for builder route |
| `src/components/patterns/proposal/ProposalBuilderOrchestrator.tsx` | New — client builder UI |

---

## Database: `proposal_structures`

```sql
CREATE TABLE proposal_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  structure_json JSONB NOT NULL DEFAULT '{"sections": []}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (estimate_id)
);
```

- One row per estimate (UNIQUE constraint)
- CASCADE DELETE: structure is deleted when the estimate is deleted
- RLS: same `internal_access` pattern as all other internal tables
- Index on `estimate_id` for fast lookup

No price or quantity fields. `structure_json` is the only payload column.

---

## Structure JSON Schema

```typescript
type ProposalStructureSection = {
  id: string              // client-generated UUID for this section definition
  title: string | null    // null = use first source row's worksheet description
  source_row_ids: string[]  // IDs of top-level worksheet rows grouped into this section
  visible: boolean        // false = section excluded from summary view
}

type ProposalStructureJson = {
  sections: ProposalStructureSection[]
}
```

`source_row_ids` references **worksheet row IDs** — no data is copied. If a referenced row
is deleted from the worksheet, it is silently skipped during rendering.

---

## Transformation Logic (`src/lib/proposalStructure.ts`)

### `deriveDefaultStructure(rows)`

Produces a default structure when no saved structure exists:
- Each top-level worksheet row becomes one section
- `source_row_ids = [row.id]`
- `title = null` (use row description)
- `visible = true`
- `id = crypto.randomUUID()`

Called on every render when no `proposal_structures` record exists — never persisted
automatically.

### `applyStructure(structure, rows)`

Converts a structure + worksheet rows into `ProposalSummary` (same shape as Slice 11):

1. Build `rowsById` and `childrenByParent` maps from worksheet rows
2. For each section in `structure.sections`:
   - Skip if `visible = false`
   - Resolve `source_row_ids` → actual rows (skip missing IDs)
   - Skip section if no source rows resolve
   - Title = `section.title` (trimmed) ?? first source row's description
3. For single source row: items = descendants of that row (same as Slice 11)
4. For multiple source rows: each source row appears at depth 1 with its subtree at depth 2
5. Subtotal = leaf-total recursion (same as Slice 11 — no double-counting)
6. Grand total = sum of section subtotals

---

## Server Actions (`src/app/actions/proposal-actions.ts`)

### `getProposalStructure(estimateId, jobId)`

Reads `proposal_structures` for the estimate. Returns:
- `{ structure }` if a record exists
- `{ notFound: true }` if no record

(Note: the pages currently derive the default inline rather than calling this action,
but it's available for future use.)

### `saveProposalStructure(estimateId, jobId, structure)`

Upserts `proposal_structures` on `estimate_id`. On success:
- `revalidatePath('/jobs/{jobId}/proposal')` — summary page updates on next load
- Returns `{ success: true }`

---

## Routes

| Route | Purpose |
|---|---|
| `/jobs/[id]/proposal` | Read-only summary (updated to use structure) |
| `/jobs/[id]/proposal/builder` | Builder UI |

The summary page now:
1. Fetches rows and structure in parallel (`Promise.all`)
2. If no structure: derives default on the fly (no DB write)
3. Calls `applyStructure(structure, rows)` instead of `buildProposalSummary`

A "Customize structure →" link in the summary header navigates to the builder.

---

## Builder UI (`ProposalBuilderOrchestrator`)

Client component with local state for the sections list.

**Controls per section:**
- `▲ / ▼` — move section up/down in order
- Title input — optional override; empty = use worksheet row description
- Visible checkbox — toggle section inclusion in summary

**State:**
- `sections: ProposalStructureSection[]` — mutable local copy
- `saveStatus: 'idle' | 'saving' | 'saved' | 'error'` — shown inline
- `useTransition` for non-blocking server action call

**Save:** Calls `saveProposalStructure(estimateId, jobId, { sections })`.
On success: status shows "Saved" for 3s, then resets.
On error: status shows "Save failed" (persistent until next save attempt).

**Source rows display:** Each section shows its worksheet source rows as read-only
chips — so the user can see what's included without editing the grouping.

The builder does NOT allow moving rows between sections (section merging/splitting
is deferred to a future builder slice).

---

## Summary View Update

The summary page (`/jobs/[id]/proposal`) now uses the structure-aware path for all renders:

```
No saved structure → deriveDefaultStructure(rows) → applyStructure → render
Saved structure   → load from DB               → applyStructure → render
```

Hidden sections are excluded. Renamed sections show the custom title.
Reordered sections appear in the saved order.

---

## Limitations

1. **No section merging/splitting UI**: The builder only allows reorder + visibility + rename.
   Moving worksheet rows between sections requires a more complex drag-and-drop UI —
   deferred to a future slice.

2. **Structure not auto-saved on estimate switch**: If the active estimate changes (via
   EstimateSelector), the builder page redirects to `/proposal` (not `/proposal/builder`).
   Each estimate has its own structure; switching estimates shows the new estimate's
   structure (or derives a default).

3. **No "reset to default" button**: A user who has saved a structure and then adds new
   worksheet rows won't automatically see the new rows in the builder — they need to
   reset. This is deferred (new rows appear in the summary via `deriveDefaultStructure`
   only if no saved structure exists).

4. **No structure validation**: If `source_row_ids` contains IDs from a different estimate,
   `applyStructure` silently skips them (they won't resolve from the worksheet rows array).
   This is correct behavior but means stale structures are silently partial rather than
   causing an error.

---

## Risks / Follow-up Items

1. **New worksheet rows not auto-added to structure**: Once a structure is saved, new
   top-level worksheet rows will not appear in the summary until the structure is updated
   or reset. The builder needs a "sync from worksheet" or "reset to default" action.

2. **Structure not tied to estimate version**: If an estimate is duplicated, the structure
   is NOT copied (each estimate has its own structure record). The duplicate estimate will
   use a derived default. This is correct behavior but should be documented for users.

3. **Permissions**: Still no role-based access control on the proposal routes (noted in
   Slice 11). The architecture doc requires this; deferred to a permissions slice.

---

## Validation Run

| Stage | Result |
|---|---|
| DB migration | Applied successfully |
| Compilation (Turbopack) | Pass — 12.0s |
| TypeScript | Pass — 9.7s |
| Static prerender | Pre-existing Supabase env-var failure — unrelated |

---

## Intentionally Not Changed

- Worksheet system — zero modifications
- Estimate data model — no new columns on `estimates` or `job_worksheet_items`
- `proposalSummary.ts` — `buildProposalSummary` and display types unchanged
- No pricing logic — `applyStructure` uses the same `rowTotal` and `leafTotal` as Slice 11
- No PDF, no client branding, no preview
- `estimate-actions.ts` — no changes
