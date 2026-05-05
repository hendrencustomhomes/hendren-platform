# Slice 29 — Archive and Restore Behavior Alignment

**Status:** Complete  
**Date:** 2026-05-04  
**Branch:** dev

---

## 1. Files Changed

| File | Change |
|---|---|
| `src/app/actions/estimate-actions.ts` | Added `restoreEstimate` server action |
| `src/components/patterns/estimate/EstimateSelector.tsx` | Archive available for all non-archived statuses; inline confirmation added; Restore wired to `restoreEstimate` |
| `docs/actions/slices/slice_29_archive_restore_fix.md` | This report |

---

## 2. What Changed

### `restoreEstimate` server action (new)

Added to `estimate-actions.ts`:

- Permission: `edit` (`can_manage` → DB)
- Input: `estimateId`, `jobId`
- Guard: verifies current status is `'archived'`; returns error otherwise
- Write: `UPDATE estimates SET status = 'draft'` — direct update, no RPC
- Does NOT call `setActiveEstimate`; does NOT set status to `active`
- Revalidates worksheet path on success

### `EstimateSelector.tsx` changes

**1. `restoreEstimate` imported** — replaces `setActiveEstimate` for the Restore button in the archived section.

**2. Archive available for all non-archived estimates** — removed the `est.status !== 'active'` condition that was hiding the Archive button for active estimates. Now any estimate that is not already archived shows the Archive button. The server-side `NON_ARCHIVABLE_STATUSES` guard enforces correctness.

**3. Inline archive confirmation** — clicking Archive no longer fires immediately. Instead:
- Sets `confirmArchiveId` state to the estimate's ID
- Renders inline: `Are you sure?` text + `[No]` + `[Yes]` buttons
- `[No]` clears `confirmArchiveId` (no action)
- `[Yes]` clears `confirmArchiveId` and calls `archiveEstimate`
- `[Yes]` uses `variant="primary"` (filled blue button, white text)
- No new modal system, no global state, no component extraction needed

**4. `Btn` component updated** — added `'primary'` variant with filled blue background and white text. No breaking change to existing uses.

---

## 3. Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass — no errors |

---

## 4. Risks / Follow-up

**Confirmation clears on dropdown close:** If the user closes the dropdown while a confirmation is pending, the `open` state becomes false and the confirmation is no longer rendered. On reopen, `confirmArchiveId` still holds the value in state, so the confirmation would reappear. This is acceptable behavior — the user explicitly closed the panel and the confirmation is still intact if they reopen. No fix needed.

**Restore sets status to `draft` via direct UPDATE — not via RPC:** The `set_active_estimate` RPC atomically demotes the old active before promoting a new one. `restoreEstimate` bypasses this — it simply sets `status = 'draft'`. This is correct: an archived estimate restoring to `draft` should not touch any other estimates. There is no atomicity concern for a single row update.

**No redirect after archive/restore:** The worksheet page still holds a reference to the previously active estimate. After archiving the active estimate, there is no active estimate and the UI will show "No active estimate." This is correct behavior; the user can then click "Use" on another draft estimate. No further change needed here.

**`setActiveEstimate` remains in scope for `setActiveEstimate` callers** — it is still the correct action for the "Use" button (making a draft estimate the active one). It was not changed.

---

## 5. Intentionally Not Changed

- `archiveEstimate` — no changes; `NON_ARCHIVABLE_STATUSES` guard already correct
- `setActiveEstimate` — unchanged; still used for "Use" button on non-active estimates
- Permission model — unchanged
- `EstimateStatus` type — unchanged
- DB schema — no migration; `'draft'` is already a valid enum value, so `restoreEstimate` writes to a valid status
- Proposal logic — unchanged
- Any other actions or UI components — unchanged
