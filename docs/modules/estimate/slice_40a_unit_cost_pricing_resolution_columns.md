# Slice 40A — Unit-Cost Pricing Resolution Columns

**Status:** Complete  
**Date:** 2026-05-05  
**Branch/context:** dev  
**Execution:** Supabase-direct SQL; no repo migration file

---

## 1. Inspection Findings

### `job_worksheet_items`

Existing relevant columns before this slice included:
- `unit_price` numeric nullable — existing legacy/manual cost field
- `pricing_source_row_id` uuid nullable — FK to `pricing_rows`
- `pricing_header_id` uuid nullable — FK to `pricing_headers`
- `pricing_type` enum, NOT NULL, default `unpriced`
- `quantity` and `total_price` — not modified in this slice

Other findings:
- 23 existing columns total
- 4 named CHECK constraints, 8 FKs, and primary key
- trigger `trg_jwi_updated_at` on UPDATE remained unchanged
- 4 RLS policies remained intact
- no proposed column already existed

### `pricing_rows`

Existing relevant source column:
- `unit_price` numeric nullable — canonical source value for linked rows

### Dependencies

- No views referenced `job_worksheet_items` pricing fields
- No triggers/functions enforced pricing logic
- RLS policies did not inspect pricing fields

### Current data before change

`job_worksheet_items` had 3 rows:
- 2 manual rows with `unit_price = 123`
- 1 row with `unit_price = NULL`
- 0 rows with `pricing_source_row_id` set

---

## 2. SQL Applied

```sql
ALTER TABLE job_worksheet_items
ADD COLUMN unit_cost_manual numeric NULL,
ADD COLUMN unit_cost_source numeric NULL,
ADD COLUMN unit_cost_override numeric NULL,
ADD COLUMN unit_cost_is_overridden boolean NOT NULL DEFAULT false;

CREATE INDEX idx_job_worksheet_items_unit_cost_is_overridden
ON job_worksheet_items(unit_cost_is_overridden)
WHERE unit_cost_is_overridden = true;
```

---

## 3. Backfill Results

Manual cost backfill:

```sql
UPDATE job_worksheet_items
SET unit_cost_manual = unit_price
WHERE pricing_source_row_id IS NULL
  AND unit_price IS NOT NULL;
```

Result:
- 2 rows updated from existing `unit_price`

Source cost backfill:

```sql
UPDATE job_worksheet_items jwi
SET unit_cost_source = pr.unit_price
FROM pricing_rows pr
WHERE jwi.pricing_source_row_id = pr.id
  AND pr.unit_price IS NOT NULL;
```

Result:
- 0 rows updated, expected because no worksheet rows were linked to pricing rows yet

No overrides were inferred or introduced.

---

## 4. Verification Results

| Check | Result |
|---|---|
| Columns | `unit_cost_manual`, `unit_cost_source`, `unit_cost_override`, `unit_cost_is_overridden` exist |
| Types/defaults | numeric nullable for three value columns; boolean NOT NULL DEFAULT false for override flag |
| Row count | unchanged: 3 rows before and after |
| Manual backfill | 2 rows have `unit_cost_manual` |
| Source backfill | 0 rows have `unit_cost_source`, expected |
| Overrides | 0 rows have override value or override flag |
| Index | `idx_job_worksheet_items_unit_cost_is_overridden` created |
| RLS | existing policies remained active |

---

## 5. Data Safety Notes

- Legacy `unit_price` remains present and unchanged.
- New columns are additive only.
- No resolved unit cost is stored; resolved values remain code-derived.
- Backfill copied values from `unit_price` into `unit_cost_manual`; it did not move or delete source data.
- Null unit-cost state is intentional for rows with no pricing data.
- New columns inherit existing table RLS behavior.

Rollback, if required:

```sql
DROP INDEX IF EXISTS idx_job_worksheet_items_unit_cost_is_overridden;

ALTER TABLE job_worksheet_items
DROP COLUMN IF EXISTS unit_cost_is_overridden,
DROP COLUMN IF EXISTS unit_cost_override,
DROP COLUMN IF EXISTS unit_cost_source,
DROP COLUMN IF EXISTS unit_cost_manual;
```

---

## 6. Follow-Up Repo Changes Required

Slice 40B should:
- read the new `unit_cost_*` columns in worksheet fetch/select paths
- define one pure resolver for unit cost
- map manual, linked, and overridden states through that resolver
- ensure linked pricing writes populate `unit_cost_source` from pricing row `unit_price`
- ensure manual edits write `unit_cost_manual` for unlinked rows and override fields for linked rows
- avoid storing resolved unit cost
- avoid UI polish/icons until the engine behavior is correct
