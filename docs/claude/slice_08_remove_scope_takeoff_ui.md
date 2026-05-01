# Slice 08 — Remove Scope / Takeoff UI

**Date:** 2026-05-01
**Branch:** dev
**Reference:** design/estimate_system_execution_plan_r02.md, docs/claude/slice_07_bind_worksheet_report.md

---

## Objective

Remove legacy Scope and Takeoff UI paths now that the Estimate Worksheet is the single
source of truth for scope and quantity editing. Also close the Slice 07 follow-up risk
by adding a server-side guard that ensures every worksheet page load has an active
estimate, eliminating the `activeEstimateId = ''` edge case.

---

## Files Removed

### Scope

| File | Description |
|---|---|
| `src/app/jobs/[id]/ScopeTab.tsx` | Main Scope tab component; editable list of `job_scope_items` |
| `src/lib/scope.ts` | Scope starter definitions and helper functions; only used by `ScopeTab` |

### Takeoff

| File | Description |
|---|---|
| `src/app/jobs/[id]/TakeoffTab.tsx` | Main Takeoff tab; orchestrated the Takeoff workspace |
| `src/app/jobs/[id]/TakeoffWorkspace.tsx` | Workspace/review layout with filter + table/list |
| `src/app/jobs/[id]/TakeoffDesktopReviewTable.tsx` | Desktop-sized review table |
| `src/app/jobs/[id]/TakeoffMobileReviewList.tsx` | Mobile review list |
| `src/app/jobs/[id]/TakeoffFilterBar.tsx` | Trade/cost-code filter controls |
| `src/app/jobs/[id]/TakeoffSearchSelect.tsx` | Search-select component used by filter and table |
| `src/app/jobs/[id]/TakeoffOverviewStrip.tsx` | Summary strip with aggregate stats |
| `src/app/jobs/[id]/TakeoffScopeContext.tsx` | Read-only scope context card shown inside Takeoff |
| `src/app/jobs/[id]/takeoffTypes.ts` | TypeScript types for `takeoff_items` and scope context |
| `src/app/jobs/[id]/takeoffUtils.ts` | Calculation helpers (extended cost, assembly rows, etc.) |
| `src/app/jobs/[id]/takeoffReviewUtils.ts` | Tree-building and review utilities |
| `src/app/jobs/[id]/takeoff/` | Empty route directory (no files) |

Total: 2 Scope files, 10 Takeoff files + 1 empty directory deleted.

---

## Files Modified

### `src/app/jobs/[id]/JobTabs.tsx`

- Removed imports: `ScopeTab`, `TakeoffTab`
- Removed `scopeItems?: any[]` and `takeoffItems?: any[]` from Props interface
- Removed `'scope'` and `'takeoff'` from the `TABS` array
- Removed `scope: 'Scope'` and `takeoff: 'Takeoff'` from `TAB_LABELS`
- Removed `{activeTab === 'scope' && <ScopeTab ...>}` rendering block
- Removed `{activeTab === 'takeoff' && <TakeoffTab ...>}` rendering block

Tab order after removal: Info → Pipeline → Selections → Bids → Log → Issues → Tasks →
Schedule → Procurement → Files

### `src/app/jobs/[id]/page.tsx`

- Removed `job_scope_items` query from the parallel Promise.all block
- Removed `takeoff_items` query from the parallel Promise.all block
- Removed `scopeItems` and `takeoffItems` destructuring
- Removed `takeoff` and `scope` from the `counts` object (used only by `JobArchiveControls`
  for the archive warning message; the remaining counts cover all other linked records)
- Removed `scopeItems={scopeItems||[]}` and `takeoffItems={takeoffItems||[]}` from
  `<JobTabs>` props

### `src/app/jobs/[id]/worksheet/page.tsx`

Added active estimate guard (see section below).

---

## Routes Removed

- `scope` tab at `/jobs/[id]?tab=scope` — no longer rendered
- `takeoff` tab at `/jobs/[id]?tab=takeoff` — no longer rendered
- `/jobs/[id]/takeoff/` route directory — was empty; removed

Navigation now routes `scope` and `takeoff` query params to the `info` tab fallback
(the `useEffect` in `JobTabs` defaults to `'info'` for any unknown tab value).

---

## Navigation Changes

The `STAGES` array and `STAGE_LABELS`/`STAGE_ICONS` maps in `page.tsx` still include
`takeoff` and `estimate` entries — these are pipeline stage labels used to render the
job's current stage in the pipeline view, not tab identifiers. They were intentionally
left untouched as they describe the job's workflow stage, not a UI tab.

---

## Active Estimate Guard

**Location:** `src/app/jobs/[id]/worksheet/page.tsx`

**Problem closed:** Slice 07 left `activeEstimateId = ''` when a job had no active
estimate. A subsequent row create would fail at the DB level (empty string is not a
valid UUID).

**Implementation:** After fetching estimates, before querying rows:

1. If an `active` estimate exists — proceed as before.
2. If no active estimate but other (non-archived) estimates exist — call
   `supabase.rpc('set_active_estimate', { p_estimate_id, p_job_id })` to promote the
   most recent non-archived one. Update the in-memory `estimates` array to reflect the
   new status (avoids a second DB round-trip to re-fetch).
3. If no estimates at all — insert a new estimate with `title = 'Base Estimate'`,
   `status = 'active'`, `created_by = user.id`. Sets `estimates` and `activeEstimate`
   from the returned row.

All three paths guarantee `activeEstimate` is non-null before the rows query runs.
The guard uses the existing `set_active_estimate` atomic PL/pgSQL function from
Slice 07 — no new DB functions required.

---

## Validation Run

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass — 17.1s |
| TypeScript | Pass — 17.0s |
| Static prerender | Pre-existing Supabase env-var failure — unrelated |

---

## Intentionally Not Changed

- **DB tables** — `job_scope_items` and `takeoff_items` tables are NOT dropped. This
  slice is UI removal only; schema cleanup is a separate future slice.
- **`scope_notes` field** — the `scope_notes` column on the `jobs` table is preserved.
  It is displayed (read-only) and edited in the Info tab as a freeform notes field,
  not part of the Scope tab.
- **Pipeline stage labels** — `takeoff` and `estimate` entries in `STAGES`/`STAGE_LABELS`
  on the job detail page are workflow stage descriptors, not UI tabs. Left intact.
- **Proposal system** — not touched.
- **Financials** — not touched.
- **Worksheet architecture** — not changed beyond the active estimate guard.
- **Estimate selector behavior** — not changed.
- **`JobArchiveControls`** — still uses a `counts` object to generate the archive
  warning; scope/takeoff counts removed since the tabs no longer exist.

---

## Risks / Follow-up Items

**1. `job_scope_items` and `takeoff_items` tables remain.**
Data is intact. A future schema cleanup slice should decide whether to drop these tables
once it is confirmed no other system references them (e.g. reporting, exports).

**2. Unknown `?tab=scope` or `?tab=takeoff` query params resolve to `info` tab.**
Users who bookmarked these URLs will land on the Info tab without an error message.
This is acceptable — both tabs are gone and no redirect is needed.

**3. Archive warning count no longer includes scope/takeoff items.**
`JobArchiveControls` shows a count of linked records to warn before archiving. The
count now excludes scope/takeoff rows. Since the DB tables still exist and their data
is preserved, the underlying records are not lost — they just aren't surfaced in the
warning. If the tables are retained long-term, consider adding back a count.
