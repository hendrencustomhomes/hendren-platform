# Slice 06.5 — Estimate Schema Cleanup

**Date:** 2026-05-01
**Branch:** dev
**Reference:** design/estimate_system_execution_plan_r02.md, docs/slices/slice_06_estimate_entity_report.md

---

## Objective

Remove legacy estimate infrastructure identified in Slice 06 before Slice 07 binds
worksheet rows to estimates. Goal: leave a clean, unambiguous worksheet-estimate
foundation with no orphaned tables, legacy columns, or spurious enum values.

---

## Legacy References Searched

All searches performed against `src/` (`*.ts`, `*.tsx`).

| Term | Matches |
|---|---|
| `estimate_versions` | 0 |
| `estimate_line_items` | 0 |
| `estimate_version_items` | 0 |
| `signature_path` | 0 |
| `signed_at` | 0 |
| `margin_pct` | 0 |
| `overhead_pct` | 0 |
| `'sent'` / `'accepted'` / `'superseded'` / `'voided'` | 0 |
| `estimate_status` (as identifier) | 0 (only in `estimateTypes.ts` as a TS type, not a DB reference) |

No legacy values or table names referenced anywhere in application code.

---

## DB / Schema Findings Before Migration

| Object | Pre-cleanup state |
|---|---|
| `estimates` | 7 rows (all `status = 'active'`, seeded by Slice 06); 15 columns including legacy signature/margin fields |
| `estimate_versions` | 0 rows; referenced by `estimate_version_items` via FK |
| `estimate_line_items` | 0 rows; FK → `estimates.id` |
| `estimate_version_items` | 0 rows; FK → `estimate_versions.id` |
| `estimate_status` enum | `draft`, `active`, `approved`, `archived`, `sent`, `accepted`, `superseded`, `voided` |
| `estimate_version_status` enum | `draft`, `approved`, `superseded`, `void` |
| Functions/views using legacy tables | None |
| Partial index `estimates_one_active_per_job` | Existed; embeds `estimate_status` literal — required drop/recreate during type swap |

---

## Migration Applied

**Name:** `estimate_schema_cleanup_slice06_5`

Steps in order:

1. **Drop legacy tables** (FK-safe order):
   - `estimate_version_items`
   - `estimate_line_items`
   - `estimate_versions`

2. **Drop `estimate_version_status` enum** — now unreferenced after table drops.

3. **Drop legacy columns from `estimates`**:
   - `signature_path`
   - `signed_at`
   - `signed_by_name`
   - `signed_ip`
   - `margin_pct`
   - `overhead_pct`

4. **Normalize `estimate_status` enum** to `draft`, `active`, `approved`, `archived` only:
   - Dropped the partial unique index (it embeds a typed literal; must be dropped before type swap)
   - Dropped the column default
   - Created `estimate_status_clean` enum with only the four worksheet values
   - Migrated `estimates.status` via `USING status::text::estimate_status_clean`
   - Restored column default as `'draft'::estimate_status_clean`
   - Dropped old `estimate_status` enum
   - Renamed `estimate_status_clean` → `estimate_status`
   - Recreated partial unique index `estimates_one_active_per_job`

**Note:** The partial index drop/recreate was required because PostgreSQL embeds a
typed literal in partial index conditions. A bare `ALTER COLUMN TYPE` with the index
present errors with "operator does not exist: estimate_status_clean = estimate_status".

---

## DB State After Migration

**`estimates` table — final columns:**

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `uuid_generate_v4()` |
| `job_id` | uuid | NO | — |
| `title` | text | NO | `'Estimate'` |
| `status` | estimate_status | NO | `'draft'` |
| `is_change_order` | bool | NO | `false` |
| `parent_estimate_id` | uuid | YES | — |
| `created_by` | uuid | YES | — |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

**`estimate_status` enum — final values:** `draft`, `active`, `approved`, `archived`

**Tables removed:** `estimate_version_items`, `estimate_line_items`, `estimate_versions`

**Enums removed:** `estimate_version_status`

**Data integrity:** All 7 seeded estimate rows preserved with `status = 'active'`.

---

## Files Changed

No application code changes required. The `Estimate` TypeScript type and all SELECT
clauses in `estimate-actions.ts` were already written against the clean column set
(Slice 06 targeted the intended schema, not the legacy one). Confirmed by grep: zero
legacy column or table references in source.

---

## Validation Run

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass — 5.3s |
| TypeScript | Pass — 8.5s |
| Static prerender | Pre-existing Supabase env-var failure — unrelated |
| Estimate selector / actions | Compile clean; all SELECT clauses verified against new schema |
| Worksheet page | Unaffected |

---

## Intentionally Not Changed

- `estimates` table preserved with all Slice 06 data intact
- `is_change_order` and `parent_estimate_id` kept — relevant to CO context in design doc r02
- `created_by` kept — audit trail
- RLS policy `estimates_internal` — unchanged, correct
- Partial unique index `estimates_one_active_per_job` — recreated identically
- No worksheet row binding (Slice 07)
- No Scope UI, Takeoff UI, Proposal, or Financials changes
- No estimate selector behavior changes

---

## Risks / Follow-up Items

**None introduced by this slice.**

The schema is now clean and unambiguous. Slice 07 (binding `job_worksheet_items` to
`estimates` via `estimate_id` FK) can proceed without legacy interference.

The one pre-existing risk documented in Slice 06 remains: `setActiveEstimate` in
`estimate-actions.ts` runs two sequential UPDATE calls (demote → promote) rather than
an atomic transaction. Low-risk given current usage, but worth addressing in Slice 07
via a Postgres function.
