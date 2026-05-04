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

- SQL migration — deferred; see DB migration debt above (note: DB enum was applied separately after this report; see current.md)
- `EstimateStatus` type — already includes `'staged'` from the architecture rewrite (Slice 28)
- No changes to any other actions, components, or guards

---

## 6. Post-Slice Correction (applied in Slice 31)

The allowed transition documented above — `draft or active → staged` — was incorrect as implemented and as intended.

**Correction:** Staging is restricted to **active estimates only**.

```
active → staged   ✓
draft  → staged   ✗  (never allowed)
```

The rationale: staging represents locking the working estimate for management review before sending. Only the job's currently active estimate is meaningful to stage. A draft estimate has not been selected as the working estimate and should not be stageable.

The `stageEstimate` guard was updated in Slice 31 to enforce `status === 'active'` only.

**Unstage flow introduced in Slice 31:**

`unstageEstimate` was added as the reverse transition: `staged → active`. It uses the `set_active_estimate` RPC to atomically promote the estimate back to active and demote any currently active estimate for the same job. Requires `edit` permission; rejects locked estimates.
