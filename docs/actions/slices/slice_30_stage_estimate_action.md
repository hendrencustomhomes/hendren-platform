# Slice 30 — Stage Estimate Server Action

**Status:** Complete  
**Date:** 2026-05-04  
**Branch:** claude/audit-worksheet-stability-nIwtF

---

## 1. Files Changed

| File | Change |
|---|---|
| `src/app/actions/estimate-actions.ts` | Added `stageEstimate` server action |
| `docs/actions/slices/slice_30_stage_estimate_action.md` | This report |

---

## 2. What Changed

### `stageEstimate` server action (new)

Added to `estimate-actions.ts` before `renameEstimate`:

- Permission: `edit` (`can_manage` → DB)
- Input: `estimateId`, `jobId`
- Guards:
  - Verifies current status is `'draft'` or `'active'`; returns error otherwise
  - Verifies `locked_at` is null; returns error if estimate is locked
- Write: `UPDATE estimates SET status = 'staged'` — direct update, no RPC
- Revalidates worksheet path on success

---

## 3. Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass — no errors |

---

## 4. DB Migration Debt

`'staged'` is defined in the `EstimateStatus` TypeScript type but is **not yet present in the Postgres `estimate_status` enum**. The write in `stageEstimate` will fail at runtime with a DB error until the following migration runs:

```sql
ALTER TYPE estimate_status ADD VALUE IF NOT EXISTS 'staged';
```

This migration is intentionally deferred. No code currently calls `stageEstimate` from the UI, so no production path reaches this write. The action is in place for when the migration and staging UI are added.

---

## 5. Intentionally Not Changed

- SQL migration — deferred; see DB migration debt above
- No UI wired to `stageEstimate` — UI is a future slice
- `EstimateStatus` type — already includes `'staged'` from the architecture rewrite (Slice 28)
- No changes to any other actions, components, or guards
