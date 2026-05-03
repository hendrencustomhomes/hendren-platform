# Slice 07 — Bind Worksheet Rows to Estimates

**Date:** 2026-05-01
**Branch:** dev
**Reference:** design/estimate_system_execution_plan_r02.md, docs/slices/slice_06_5_estimate_schema_cleanup_report.md

---

## Objective

Bind `job_worksheet_items` to `estimates` via a foreign key so that each row belongs to
a specific estimate. Previously rows were scoped only to a job; switching estimates had
no effect on which rows were loaded. After this slice, loading the worksheet fetches
rows for the active estimate only, and creating/duplicating an estimate correctly manages
row ownership.

Also addressed the Slice 06 atomicity risk: `setActiveEstimate` previously ran two
sequential UPDATEs with a gap where no active estimate existed for the job.

---

## DB Migrations

### Migration 1: `bind_worksheet_rows_to_estimates`

1. Added `estimate_id uuid REFERENCES estimates(id) ON DELETE CASCADE` to
   `job_worksheet_items` as nullable initially.
2. Backfilled `estimate_id` for the one job with existing rows (`job_id =
   00570b29-...`) using the job's active estimate (`e47a1c85-...`). 2 rows updated.
3. Set column `NOT NULL`.
4. Created index `idx_jwi_estimate_id` on `(estimate_id)`.

**On DELETE CASCADE**: if an estimate is deleted all its rows are deleted automatically.
This is safe because `archiveEstimate` does not delete — it only flips status. The cascade
would only fire if an estimate row were hard-deleted (no app path currently does this).

### Migration 2: `create_set_active_estimate_function`

Created PL/pgSQL function `set_active_estimate(p_estimate_id uuid, p_job_id uuid)`:

```sql
CREATE OR REPLACE FUNCTION set_active_estimate(p_estimate_id uuid, p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE estimates SET status = 'draft', updated_at = now()
  WHERE job_id = p_job_id AND status = 'active' AND id <> p_estimate_id;

  UPDATE estimates SET status = 'active', updated_at = now()
  WHERE id = p_estimate_id AND job_id = p_job_id;
END;
$$;
```

`SECURITY INVOKER` means the function runs as the calling user, so RLS applies.
Both UPDATEs run in a single transaction — no gap where zero estimates are active.
The demote step skips the target estimate (`id <> p_estimate_id`) so promoting an
already-active estimate is a safe no-op.

---

## Code Changes

### `JobWorksheetTableAdapter.tsx`

Added `estimate_id: string` to the `JobWorksheetRow` type. Required because all rows
fetched from DB now carry this field.

### `useJobWorksheetPersistence.ts`

Added `estimate_id: string` to `CreateJobWorksheetRowInput`. The persistence layer
passes it through when inserting new rows.

### `useJobWorksheetState.ts`

- **`getBackupKey`** now takes `(jobId, estimateId)` — localStorage key scoped to both
  IDs to prevent estimate A's backup from loading when switching to estimate B.
- **`readBackup` / `writeBackup` / `clearBackup`** updated to `(jobId, estimateId, ...)`.
- **`createDraftRow`** now takes `estimateId`; sets `estimate_id` on draft rows.
- **`buildCreateInput`** now takes `estimateId`; passes it in the insert payload.
- **Hook signature** changed from `useJobWorksheetState(jobId, ...)` to
  `useJobWorksheetState(jobId, estimateId, ...)`.
- All internal backup reads/writes and draft row creation updated to pass `estimateId`.
- Second `useEffect` (backup-writing side effect) deps array updated to include
  `estimateId`.

### `JobWorksheetPageOrchestrator.tsx`

Added `activeEstimateId: string` to Props. Passes it as the second argument to
`useJobWorksheetState`.

### `worksheet/page.tsx`

- Fetch estimates first (sequential instead of parallel with rows, since the active
  estimate ID is needed to scope the rows query).
- Find active estimate: `estimates.find((e) => e.status === 'active')`.
- Fetch rows by `estimate_id` instead of `job_id`:
  `.eq('estimate_id', activeEstimate.id)`
- If no active estimate, rows array is empty and `activeEstimateId` is `''` (the
  orchestrator renders with an empty worksheet — no crash).
- Pass `activeEstimateId` to the orchestrator.

### `estimate-actions.ts`

**`setActiveEstimate`** — replaced two-step UPDATE sequence with a single
`supabase.rpc('set_active_estimate', { p_estimate_id, p_job_id })` call. Atomic;
no window where zero estimates are active for the job.

**`duplicateEstimate`** — now copies worksheet rows to the new draft estimate:
1. Fetch source estimate metadata and its rows in parallel.
2. Insert the new estimate record.
3. If source has rows: generate a `Map<old_id, new_uuid>` using `crypto.randomUUID()`.
4. Build copied rows with remapped `id` and `parent_id` (so hierarchy is preserved),
   new `estimate_id`, and reset pricing linkage fields (`pricing_source_row_id`,
   `pricing_header_id`, `replaces_item_id` → null).
5. Insert copied rows.

---

## DB State After Slice 07

**`job_worksheet_items` additional columns:**

| Column | Type | Nullable | Default |
|---|---|---|---|
| `estimate_id` | uuid | NO | — |

**FK:** `estimate_id REFERENCES estimates(id) ON DELETE CASCADE`

**Index:** `idx_jwi_estimate_id ON job_worksheet_items(estimate_id)`

**Function:** `set_active_estimate(p_estimate_id uuid, p_job_id uuid) RETURNS void`

---

## Validation Run

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass — 12.6s |
| TypeScript | Pass — 11.4s |
| Static prerender | Pre-existing Supabase env-var failure — unrelated |

---

## Intentionally Not Changed

- `EstimateSelector` behavior — unchanged; switching estimates triggers
  `revalidatePath` which reloads the page with the new active estimate's rows.
- RLS policies — `estimates_internal` unchanged; `job_worksheet_items` inherits
  its existing RLS (not modified).
- `archiveEstimate` — still blocks archiving the active estimate at the action level;
  no change to UX or behavior.
- Scope UI, Takeoff UI, Proposal, Financials — untouched.
- `JobWorksheetMobileView` — untouched.

---

## Risks / Follow-up Items

**1. No active estimate guard in the UI.**
If a job somehow has no active estimate (shouldn't happen post-seed; only possible if
archive is called on the active estimate programmatically), the worksheet page renders
with an empty sheet and `activeEstimateId = ''`. Creating a new row would fail at the
DB level (empty string is not a valid UUID). A future slice should add a page-level
guard that creates an active estimate on-demand if none exists.

**2. `estimate_id` field on `JobWorksheetRow` is added to the TS type but not filtered
in existing `select('*')` calls** — the `*` already returns it from DB; the type just
now matches. No action required.

**3. `duplicateEstimate` copies `total_price` as-is.**
`total_price` may be a computed/cached field. Since current rows have it as a plain
column (not generated), copying it is safe for now. If a `total_price` trigger is
added later, review whether the insert should null it out.
