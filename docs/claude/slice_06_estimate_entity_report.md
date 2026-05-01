# Slice 06 — Estimate Entity Foundation

**Date:** 2026-05-01
**Branch:** dev
**Reference:** design/estimate_system_execution_plan_r02.md

---

## Objective

Introduce the estimate as a first-class entity without breaking existing worksheet,
Takeoff, Scope, Proposal, or Financials behavior. Add schema, seed data, server
actions, and a basic estimate selector UI on the worksheet page.

---

## DB Discovery

The `estimates` table and `estimate_status` enum already existed in the DB as a
legacy external-estimate schema (status values: draft/sent/accepted/superseded/voided).
The table was empty. Two related tables also existed: `estimate_versions` and
`estimate_line_items` — both empty.

**Decision:** Extend the existing table rather than create a new one.

- Added `active`, `approved`, `archived` to the `estimate_status` enum.
- Added a partial unique index enforcing one active estimate per job.
- Seeded default active estimates for all 7 existing active jobs.
- Existing RLS policy (`estimates_internal` using `is_internal()`) already correct — no change needed.

---

## Schema / Migration Changes

Two migrations applied via Supabase MCP:

### Migration 1: `estimate_status_add_worksheet_values`

```sql
ALTER TYPE estimate_status ADD VALUE IF NOT EXISTS 'active'   AFTER 'draft';
ALTER TYPE estimate_status ADD VALUE IF NOT EXISTS 'approved' AFTER 'active';
ALTER TYPE estimate_status ADD VALUE IF NOT EXISTS 'archived' AFTER 'approved';
```

Enum now contains: `draft`, `active`, `approved`, `archived`, `sent`, `accepted`,
`superseded`, `voided`. The legacy values remain unused but do not cause harm.

### Migration 2: `estimates_active_index_and_seed`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS estimates_one_active_per_job
  ON estimates (job_id)
  WHERE (status = 'active');

INSERT INTO estimates (job_id, title, status)
SELECT j.id, 'Base Estimate', 'active'
FROM   jobs j
WHERE  j.archived_at IS NULL
AND    NOT EXISTS (
         SELECT 1 FROM estimates e
         WHERE  e.job_id = j.id AND e.status = 'active'
       );
```

7 rows inserted — one per active job. No archived jobs seeded.

**Note:** `ALTER TYPE ... ADD VALUE` cannot be committed and used in the same
transaction. Two migrations were required because of this Postgres constraint.

---

## Files Changed

### New files

| File | Purpose |
|---|---|
| `src/lib/estimateTypes.ts` | `EstimateStatus` union type and `Estimate` shape matching the DB schema |
| `src/app/actions/estimate-actions.ts` | Server actions: `getEstimatesForJob`, `createEstimate`, `setActiveEstimate`, `archiveEstimate`, `duplicateEstimate`, `renameEstimate` |
| `src/components/patterns/estimate/EstimateSelector.tsx` | Client component: collapsible estimate selector panel with inline rename, status badges, and all CRUD actions |

### Modified files

| File | Change |
|---|---|
| `src/app/jobs/[id]/worksheet/page.tsx` | Added parallel `estimates` fetch from Supabase; passes `estimates` prop to orchestrator |
| `src/components/patterns/estimate/JobWorksheetPageOrchestrator.tsx` | Added `estimates: Estimate[]` prop; renders `EstimateSelector` in the header card below the title/buttons row |

---

## Permission Pattern

Server actions follow the existing `requireUser()` pattern from `src/app/jobs/actions.ts`:
- Create `createClient()` (user-scoped Supabase client)
- Check `auth.getUser()`; return early if unauthenticated
- All DB queries use the user-scoped client, which is subject to the existing
  `estimates_internal` RLS policy (`is_internal()` function)

No new RLS policies added — the existing policy is correct.

---

## Estimate Selector Behavior

- Trigger button shows the active estimate name + status badge
- Panel lists all non-archived estimates; archived estimates in a collapsible `<details>` section
- Per-estimate actions: **Use** (set active), **Rename** (inline input, commit on blur/Enter), **Copy** (duplicate as draft), **Archive** (blocked for active estimate)
- For archived estimates: **Restore** (set active), **Copy**
- **+ New estimate** button creates a new `draft`
- Change Order context displayed as "CO" label when `is_change_order = true`
- All mutations use `useTransition` for non-blocking UI; error messages flash for 5 seconds

---

## Validation Run

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass — 5.1s |
| TypeScript | Pass — 9.0s |
| Static prerender | Pre-existing Supabase env-var failure — unrelated |
| Existing worksheet page | Unaffected — rows still loaded and passed unchanged |

---

## Intentionally Not Changed

- Worksheet rows (`job_worksheet_items`) are NOT bound to estimates yet — that is Slice 07.
- Scope UI (`ScopeTab`) — not touched.
- Takeoff UI (`TakeoffTab`, `TakeoffWorkspace`, etc.) — not touched.
- `estimate_versions`, `estimate_line_items`, `estimate_version_items` — not touched.
- `JobWorksheetTableAdapter`, `_worksheetFormatters`, `_worksheetValidation`, `JobWorksheetMobileView` — not touched.
- All state/persistence hooks — not touched.
- No import/export, proposal, pricing, selections, or bids work.
- No route changes — worksheet page still at `/jobs/[id]/worksheet`.

---

## Risks and Follow-up Items

**1. `setActiveEstimate` is not atomic.**
The promotion sequence (demote current active → promote target) runs as two separate
UPDATE calls. A failure between them leaves no active estimate for the job. Risk is low
(both updates are fast, no heavy contention expected) but worth resolving in Slice 07
via a Postgres function or explicit transaction.

**2. `estimate_status` enum now has legacy values (`sent`, `accepted`, etc.).**
These predate the worksheet system and are unused. They won't cause runtime issues
but may appear in DB introspection or future type-generation tooling. They should be
reviewed when the legacy `estimates` system is formally retired.

**3. Worksheet rows are still unscoped.**
`job_worksheet_items` has no `estimate_id`. The selector is cosmetic until Slice 07
binds rows to estimates. Users see the selector but switching estimates does not
change the rows displayed.

**4. `created_by` on seeded estimates is NULL.**
Migration-inserted seed rows have no `created_by` since migrations run under the
service role. This is acceptable for seed data.
