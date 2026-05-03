# Estimate / Proposal Consolidation Plan — r01

**Date:** 2026-05-01
**Status:** Planning doc — no code changes in this revision
**Scope:** Defines target architecture for estimate, proposal, scope removal, and legacy UI removal

---

## 1. Core Architecture

### Target Model

```
Job
 └── Estimate (one or many; internal working system)
       └── Worksheet rows (line_item | assembly | note | allowance)
 └── Proposal (one per estimate; presentation + readiness + export)
       └── Summary
       └── Builder Settings
       └── Preview
       └── Export PDF
```

### Definitions

**Estimate** is the internal working system. It holds the full worksheet of
scope items, quantities, and pricing. It is editable, versionable, and not
customer-facing. An estimate is where cost decisions are made.

**Proposal** is the presentation and output layer. It derives its content from
a selected estimate. It is where formatting, grouping, detail level, and
customer-facing language are controlled. The proposal is not a second data
store — it configures how an estimate is presented.

### What is replaced

| System | Status | Replacement |
|---|---|---|
| Scope module (`ScopeTab`, `job_scope_items`) | Removed | No direct replacement — scope context becomes implicit in estimate structure |
| Legacy Takeoff tab (`TakeoffTab`, `takeoff_items`) | Removed | Estimate worksheet |
| `/jobs/[id]/worksheet` page (estimate-without-versioning) | Replaced | New `/jobs/[id]/estimate` route with selector |
| No proposal system currently exists | New | `/jobs/[id]/proposal` route |

There is no parallel or transitional period where Scope and Takeoff coexist with
the new Estimate system. The old tables and components are removed when the new
system is complete. No soft deprecation.

---

## 2. Estimate System

### 2.1 Estimate Selector

Each job can have multiple estimates. Only one estimate is active at a time.

**Estimate types:**

| Type | Description |
|---|---|
| `draft` | Being actively worked. Not used for proposals. |
| `active` | The current working estimate. Drives the proposal. |
| `approved` | Locked version accepted by the client. Read-only. (Future — not in first slice.) |
| `archived` | No longer relevant. Hidden by default. |

At most one estimate per job may be `active`. Toggling a `draft` to `active`
automatically demotes the current `active` to `draft` (unless it's `approved`).

**Selector actions:**

| Action | Behavior |
|---|---|
| Create new | Creates a new blank estimate with `draft` status |
| Duplicate | Deep-copies an existing estimate and all its rows into a new `draft` |
| Import | Creates a new estimate from a template file (see § 3) |
| Export | Exports the current estimate to template format (see § 3) |
| Archive | Sets status to `archived`; does not delete rows |

The selector is the top-level UI on the estimate route. It is always visible
so users can switch between estimates without navigating away.

### 2.2 Worksheet

One unified worksheet per estimate. No "takeoff mode" vs "estimate mode" split.

**Row kinds supported:**

| Kind | Qty required | Price required | Notes |
|---|---|---|---|
| `line_item` | Yes | Yes | Standard priced scope item |
| `assembly` | Yes | Yes | Parent grouping with children; total rolls up from children |
| `note` | No | No | Free-text annotation; no pricing |
| `allowance` | Yes | Yes | Placeholder pricing; flagged in proposal summary |

**Structure:**
- Parent/child rows (one level deep; `parent_id` on child rows)
- Collapsible assemblies
- Sortable and filterable by any column

**Columns (desktop):**

| Column | Editable | Notes |
|---|---|---|
| Description | Yes | Required for all kinds |
| Qty | Yes | Required except `note` |
| Unit Price | Yes | Required except `note` |
| Unit | Yes | From fixed option list |
| Total | No | Computed: qty × unit_price; rolls up from children for assemblies |
| Location | Yes | Optional grouping label |
| Notes | Yes | Internal notes |

The worksheet is not split by takeoff vs estimate. The current `_worksheetFormatters.ts`,
`_worksheetValidation.ts`, `JobWorksheetMobileView.tsx`, and `JobWorksheetTableAdapter.tsx`
are the foundation and carry forward with minimal changes. The worksheet state
and persistence hooks (`useJobWorksheetState`, `useJobWorksheetPersistence`) carry
forward bound to the new `estimate_id` foreign key.

**Current gap:** `job_worksheet_items` rows have no `estimate_id` field. This is
the primary data model change required before the worksheet can bind to a versioned
estimate (see § 6).

---

## 3. Import / Export Rules

### 3.1 Import

- **Accepts:** A defined template format (Excel or CSV with a fixed column schema).
- **Creates:** A new estimate only. Import always produces a new `draft` estimate.
  It never edits, overwrites, or merges into an existing estimate.
- **No mapping wizard.** The template schema is fixed. Files that do not conform
  to the schema are rejected with a validation error before any rows are inserted.
- **No merge logic.** Importing the same file twice creates two separate estimates.
- **Row IDs:** Auto-generated on insert. Import file IDs are ignored.
- **Validation before insert:** Every row is validated (description present,
  numeric qty/price where required, valid unit) before any row is persisted.
  If any row fails, the entire import is rejected and no rows are written.
- **Invalid files:** Return a user-facing error listing the first N failures.
  No partial imports.

### 3.2 Export

- **Exports:** The currently selected estimate in its entirety.
- **Formats:** Excel (`.xlsx`) and CSV.
- **Schema:** Matches the import template schema so exports can be re-imported
  or shared as templates.
- **No filtering:** Export always includes all rows in the estimate, including
  notes and allowances.

---

## 4. Proposal System

### 4.1 Route Structure

```
/jobs/[id]/proposal
 └── /summary        (default landing)
 └── /builder        (builder settings)
 └── /preview        (mirrors PDF output)
 └── /export         (triggers PDF generation)
```

The proposal route is always scoped to the job's `active` estimate. If no
`active` estimate exists, the proposal route shows a prompt to set one.

### 4.2 Summary

The summary is the default view on proposal load. It provides a health check
of the estimate before any proposal is sent.

**Summary includes:**

- **Cost rollups:** Total by assembly/section, grand total, allowance subtotal
- **Estimate health indicators:**
  - Rows with missing qty (count + list)
  - Rows with missing price (count + list)
  - Note rows (count — informational)
  - Allowance rows (count + total value — flagged because allowances are uncertain)
- **Proposal readiness:** A pass/fail or warning checklist that gates the
  Preview and Export actions. Blocks export if critical items are missing.

The summary reads from the estimate. It does not store separate data.

### 4.3 Builder Settings

Builder settings control how the estimate is rendered in the proposal. They
are inferred from the estimate structure and the job record but can be overridden.

**Inferred from:**
- Job type (e.g., new construction vs remodel)
- Estimate structure (presence of assemblies, allowances, alternates)

**Overridable settings:**

| Setting | Options |
|---|---|
| Show/hide groups | Toggle individual assemblies/sections |
| Section names | Rename assemblies for client-facing output |
| Detail level | Line-item detail, grouped totals only, or summary only |
| Allowances | Include/exclude from proposal; show as separate section |
| Alternates | Include/exclude; show as addendum |
| Notes/exclusions | Free-text per-proposal notes and what's excluded |

Builder settings are stored on the proposal entity, not on the estimate.
Changing builder settings does not alter the estimate.

### 4.4 Preview

- Renders the proposal exactly as it will appear in the PDF.
- No separate rendering logic from the PDF export — both use the same template.
- Updates live when builder settings change.
- Read-only. No editing of estimate content from the preview.

### 4.5 Export PDF

- Generates from the preview structure.
- Triggered from the Export route or from a button on the Preview.
- Blocked if the summary readiness check has critical failures.

---

## 5. UI Cleanup Plan

### 5.1 What is Removed

| Component / Route | Table(s) it touches | Removal approach |
|---|---|---|
| `ScopeTab.tsx` and scope intake form | `job_scope_items` | Remove component; keep table until data migration decision |
| `TakeoffTab.tsx`, `TakeoffWorkspace.tsx`, and all `Takeoff*.tsx` files | `takeoff_items` | Remove components; keep table until data migration decision |
| `/jobs/[id]/takeoff/` directory | — | Remove (currently empty/reserved) |
| `src/lib/scope.ts` | — | Remove |
| `takeoffTypes.ts`, `takeoffUtils.ts`, `takeoffReviewUtils.ts` | — | Remove |
| `/jobs/[id]/worksheet/` page | `job_worksheet_items` | Redirect to `/jobs/[id]/estimate` |

### 5.2 New Routes

| Route | Purpose |
|---|---|
| `/jobs/[id]/estimate` | Estimate selector + worksheet (replaces `/jobs/[id]/worksheet`) |
| `/jobs/[id]/proposal` | Proposal system (new) |
| `/jobs/[id]/proposal/summary` | Default proposal landing |
| `/jobs/[id]/proposal/builder` | Builder settings |
| `/jobs/[id]/proposal/preview` | Preview (mirrors PDF) |
| `/jobs/[id]/proposal/export` | PDF generation trigger |

### 5.3 Updated Tab Set on Job Detail

Current tabs: Scope · Takeoff · Selections · Bids

Target tabs: Estimate · Proposal · Selections · Bids

Scope is removed. Takeoff is replaced by Estimate. Selections and Bids are
unchanged.

### 5.4 Transition Approach

- `/jobs/[id]/worksheet` → HTTP 308 permanent redirect to `/jobs/[id]/estimate`
- No gradual coexistence. The old tabs are removed in one slice, not hidden behind flags.
- `job_scope_items` and `takeoff_items` tables are retained in the DB until a
  separate data migration decision is made. The UI removal and the table removal
  are decoupled.

---

## 6. Data Model Impact

No SQL in this document. These are the required changes and relationships.

### 6.1 New Entity: Estimate

An `estimates` table (or equivalent) with at minimum:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `job_id` | uuid | FK → jobs |
| `status` | enum | `draft`, `active`, `approved`, `archived` |
| `name` | text | User-assigned label (e.g. "Base Bid", "Alt 1") |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

One `active` estimate per job enforced at the application layer (and ideally
with a partial unique index).

### 6.2 New Entity: Proposal

A `proposals` table with at minimum:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `estimate_id` | uuid | FK → estimates |
| `job_id` | uuid | FK → jobs |
| `builder_settings` | jsonb | Serialized builder settings overrides |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

One proposal per estimate. The proposal entity stores builder settings only —
not a copy of the estimate.

### 6.3 Updated: Worksheet Row

`job_worksheet_items` gains:

| Field | Type | Notes |
|---|---|---|
| `estimate_id` | uuid | FK → estimates; NOT NULL |

`job_id` on the row becomes redundant once `estimate_id` is present (since
`estimate_id → estimates.job_id → job_id`). Whether to keep it as a
denormalization for query performance is a decision for the migration slice.

### 6.4 Relationships

```
jobs
 └── estimates (many)
       └── job_worksheet_items (many; currently missing estimate_id)
       └── proposals (one)
             └── builder_settings (jsonb on proposal row)
```

Worksheet rows belong to an estimate, not directly to a job. This is the
single most important structural change from the current state.

---

## 7. Implementation Slices (High-Level)

These are the planned slices in order. Each slice is a no-behavior-change or
minimal addition. No slice skips the one before it.

| Slice | Description |
|---|---|
| **06 — Estimate entity** | Create `estimates` table, `EstimateSelector` component, wire selector to worksheet page. Worksheet rows remain unbound to estimate in this slice (backward compatible). |
| **07 — Worksheet binding** | Add `estimate_id` to `job_worksheet_items`. Migrate existing rows to a default `active` estimate per job. Update `useJobWorksheetPersistence` to scope queries by `estimate_id`. |
| **08 — Route + UI cleanup** | Remove `ScopeTab`, `TakeoffTab`, and all Takeoff* components. Remove `src/lib/scope.ts`. Add redirect from `/worksheet` to `/estimate`. Update `JobTabs` to new tab set. |
| **09 — Import/export** | Implement template schema, file upload + validation, row insert pipeline. Implement export to Excel/CSV. |
| **10 — Proposal entity** | Create `proposals` table. Create `/jobs/[id]/proposal` route with summary view reading from the active estimate. |
| **11 — Builder settings** | Add builder settings UI and persistence. |
| **12 — Preview** | Implement preview rendering shared with PDF template. |
| **13 — PDF export** | Wire PDF generation from preview structure. |

Slices 06–08 are the prerequisite foundation. Slices 09–13 add net-new functionality.

---

## 8. Risks and Edge Cases

### 8.1 Estimate Duplication Integrity

When duplicating an estimate, all worksheet rows must be deep-copied with new IDs.
Any `parent_id` references within the duplicate must point to the new row IDs, not
the originals. A naive insert of copied rows with new IDs will break parent/child
relationships unless the ID mapping is resolved before insert.

**Mitigation:** Build a local ID remapping table during duplication. Replace all
`parent_id` values using the map before inserting.

### 8.2 Import Validation Failure Handling

Rejecting an import after partial validation is straightforward (no rows written).
The risk is user confusion: a 300-row file with one invalid row at row 299 fails
entirely. The user sees "1 error" but has to fix a file they can't otherwise view
in the app.

**Mitigation:** Return all errors in the validation response, not just the first.
Consider offering a downloadable error report for large files.

### 8.3 Large Worksheet Performance

The current virtualization threshold is 20 rows. At 200+ rows, the undo stack
and debounced autosave queue can accumulate significant state. The localStorage
backup key is per-job, not per-estimate — once per-estimate scoping is added, the
key must include `estimate_id` or risk cross-estimate state bleed.

**Mitigation:** Update localStorage key to `hendren:job-worksheet:{jobId}:{estimateId}:draft`
in Slice 07.

### 8.4 Proposal Mismatch vs Estimate

If the active estimate is edited after a proposal is sent, the proposal preview
may no longer match what was sent. The proposal system has no concept of a
snapshot.

**Mitigation:** The `approved` estimate status (Slice 06, future) is the correct
solution. For Slices 10–13, the proposal should display a warning if the active
estimate has been modified since the proposal was last viewed/exported. A
`proposal.last_exported_at` timestamp compared to `estimate.updated_at` provides
this signal.

### 8.5 User Confusion During Transition

Removing the Scope and Takeoff tabs in a single slice is disruptive if any user
has data in those systems. There is no migration path defined for `job_scope_items`
or `takeoff_items` rows into the new estimate worksheet.

**Mitigation:** Before Slice 08 (UI removal), decide whether:
(a) scope/takeoff data is silently archived (tables kept, UI gone), or
(b) a one-time migration populates worksheet rows from existing takeoff data.
Option (b) is preferable if any job has meaningful takeoff data. This decision
must be made before Slice 08 executes. Do not execute Slice 08 without it.

---

## Current Repo State Reference

For accuracy, the following is confirmed from the codebase as of this doc:

- `src/components/patterns/estimate/` — worksheet adapter, mobile view, formatters, validation, state hook, persistence hook
- `src/app/jobs/[id]/page.tsx` — job detail page; current tabs: Scope, Takeoff, Selections, Bids
- `src/app/jobs/[id]/ScopeTab.tsx` — active; reads/writes `job_scope_items`
- `src/app/jobs/[id]/TakeoffTab.tsx` + `TakeoffWorkspace.tsx` + supporting files — active; reads/writes `takeoff_items`
- `src/app/jobs/[id]/worksheet/page.tsx` — current estimate entry point; no estimate versioning
- `src/app/jobs/[id]/bids/` — bids system; unchanged in this plan
- No proposal system exists anywhere in the codebase
- `job_worksheet_items` rows have no `estimate_id` field
- `job_scope_items` and `takeoff_items` tables exist and are active

---

*This document is the source of truth for the estimate/proposal consolidation. Implementation slices should reference it. Updates require a new revision suffix (r02, r03, …).*
