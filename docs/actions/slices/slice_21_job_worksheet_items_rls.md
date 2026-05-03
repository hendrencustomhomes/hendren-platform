# Slice 21 — job_worksheet_items RLS Estimate Editability

**Status:** Completed  
**Date:** 2026-05-03  
**Branch:** dev

---

## 1. What Was Done

Audited and tightened Supabase RLS policies for `job_worksheet_items` so database-level mutation rules match estimate editability.

Target rule:

A `job_worksheet_items` row may be inserted, updated, or deleted only when the related estimate is editable:

- `estimates.status` is `draft` or `active`
- `estimates.locked_at` is `null`

This matches the application-layer rule implemented by `isEstimateEditable()`.

---

## 2. Inspection Findings

### RLS status

RLS is enabled on:

- `job_worksheet_items`
- `estimates`

### Existing policies reviewed

`job_worksheet_items` had four policies:

| Policy | Command | Pre-migration behavior |
|---|---|---|
| `jwi_internal_select` | SELECT | Read access gated by existing internal policy; left unchanged |
| `jwi_internal_insert` | INSERT | Checked `locked_at IS NULL`, but did not check estimate status |
| `jwi_internal_update` | UPDATE | Checked `locked_at IS NULL` in `WITH CHECK`, but did not check estimate status; `USING` was too broad |
| `jwi_internal_delete` | DELETE | Checked `locked_at IS NULL`, but did not check estimate status |

### Gap confirmed

Before the migration, direct Supabase access could mutate worksheet rows for `approved` or `archived` estimates when `locked_at` was still null.

For UPDATE, the `USING` clause was also too permissive because it allowed targeting rows based only on `is_internal()`.

---

## 3. Migration Applied

Migration name:

`tighten_job_worksheet_items_rls_estimate_editability`

Policies updated:

- `jwi_internal_insert`
- `jwi_internal_update`
- `jwi_internal_delete`

`jwi_internal_select` was intentionally left unchanged.

Each mutation policy now requires an editable related estimate using the equivalent of:

```sql
EXISTS (
  SELECT 1
  FROM public.estimates e
  WHERE e.id = job_worksheet_items.estimate_id
    AND e.status IN ('draft', 'active')
    AND e.locked_at IS NULL
)
```

The existing `is_internal()` gate was preserved.

---

## 4. Verification Results

Post-migration verification confirmed the mutation predicate allows only editable estimates:

| Scenario | Mutation allowed |
|---|---:|
| draft + unlocked | true |
| active + unlocked | true |
| approved + unlocked | false |
| archived + unlocked | false |
| draft + locked | false |
| active + locked | false |
| approved + locked | false |
| archived + locked | false |

No worksheet rows were modified during validation.

---

## 5. Current Enforcement State

Worksheet mutation protection now exists at both layers:

1. Application layer
   - Server actions enforce `isEstimateEditable()` before worksheet item mutations.

2. Database layer
   - RLS policies on `job_worksheet_items` enforce the same draft/active + unlocked rule for INSERT, UPDATE, and DELETE.

This closes the direct client Supabase bypass gap identified in Slice 20.

---

## 6. Follow-up Risks

1. **RLS is enabled but not forced**
   - `BYPASSRLS` roles such as service role / postgres can still bypass policies.
   - Confirm user-driven worksheet mutations do not use a service role path.

2. **Policies rely on `is_internal()`**
   - Existing policy structure appears internal-user based, not per-job/per-user ownership based.
   - This may be intentional, but future access expansion should not add broader authenticated-user access without job-scope review.

3. **Rollback is manual**
   - Policy DDL changes were applied; rollback would require recreating the previous policy definitions.

---

## 7. Intentionally Not Changed

- SELECT policy
- Application code
- Proposal system
- Estimate health indicators
- Send validation
- Pricing automation
- Any non-worksheet RLS policies
