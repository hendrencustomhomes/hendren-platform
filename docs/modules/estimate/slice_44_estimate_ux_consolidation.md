# Slice 44 — Estimate UX Consolidation Pass

Status: complete
Branch: `claude/unit-cost-pricing-engine-2nuqe`
Date: 2026-05-07

---

## Goal

Polish and consolidate the estimate/worksheet UI now that the pricing and
proposal model is fully stable. Reduce clutter, remove developer jargon,
tighten action visibility rules, and improve accessibility — without any model,
resolver, or schema changes.

---

## Audit Scope

| Area | Finding |
|---|---|
| Worksheet header card | "Internal Job Worksheet" title redundant with PageShell; "slice" is developer jargon |
| Pricing state indicators | Clean. Icons correct per R02. No changes needed. |
| Sync feedback / button | Sync toolbar always visible even with zero linked rows — unnecessary clutter |
| Mobile pricing detail | Clean. Known animation gaps tracked in current.md. No changes this slice. |
| Proposal preview actions | SnapshotCreateButton correctly gated to `draft` since Slice 42. No changes needed. |
| Actions column — note rows | Link button appeared on `note` row_kind rows; notes are never priced |
| Delete button accessibility | No `title` attribute — no hover hint for the ✕ button |
| Empty/loading states | Proposal preview empty state is clear. Worksheet SSR means no loading state needed. |
| Repeated copy | "Editable slice. Changes auto-save." — "slice" is a dev term; subtitle is verbose |

---

## Changes Performed

### `src/components/patterns/estimate/JobWorksheetPageOrchestrator.tsx`

1. **Header card title**: "Internal Job Worksheet" → "Estimate".
   The PageShell already titles the page `{jobName} · Worksheet`, so the card
   heading is redundant context. "Estimate" is shorter and distinguishes the
   internal view from the customer-facing proposal.

2. **Header card subtitle**:
   - "Editable slice. Changes auto-save." → "Auto-saves."
   - "Locked — read only." → "Read only."
   Both shorten the subtitle and remove developer jargon ("slice").

### `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx`

3. **Sync toolbar visibility**: Added `hasLinkedRows` computed from
   `rows.some(r => r.pricing_source_row_id !== null)`. The sync toolbar
   (button + feedback label) is now conditionally rendered only when at least
   one linked row exists. For estimates with no price links, the toolbar was
   pure noise — sync would always return "up to date" with nothing to do.

4. **Link button on note rows**: The Link button is now hidden for rows where
   `row.row_kind === 'note'`. Notes are narrative items — they carry no pricing
   and cannot be meaningfully linked to a price source. The other actions
   (Unlink, Accept, Delete) remain unaffected.

5. **Delete button accessibility**: Added `title="Delete row"` to the ✕
   delete button. The button had no label or tooltip, making it ambiguous on
   hover and inaccessible to screen readers. The title now matches the action
   pattern of its peers (Link, Unlink, Accept all have `title` attributes).

---

## Files Changed

| File | Change |
|---|---|
| `src/components/patterns/estimate/JobWorksheetPageOrchestrator.tsx` | "Internal Job Worksheet" → "Estimate"; subtitle jargon removed. |
| `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx` | Sync toolbar gated by `hasLinkedRows`; Link button hidden for note rows; delete button gets `title`. |
| `docs/modules/estimate/slice_44_estimate_ux_consolidation.md` | This file. |
| `docs/actions/current.md` | Marked Slice 44 complete; updated next-recommended work. |

No DB migrations. No resolver changes. No new components. No model changes.

---

## What Was Deliberately Not Changed

- **Pricing state icons**: Already minimal, correct per R02 spec. No changes.
- **Proposal preview actions**: SnapshotCreateButton gating fixed in Slice 42.
  All preview nav links ("Edit structure →", "PDF →") are clear.
- **Mobile sync trigger**: Adding a manual sync to mobile would require
  threading `handleManualSync` as a prop through to `JobWorksheetMobileView`.
  The mount-time auto-sync still handles the common case. Deferred.
- **Animation polish** (sync feedback fade, mobile detail open/close): These
  are tracked in current.md known gaps. Out of scope for a UX consolidation
  pass; they belong in a dedicated animation slice.
- **"↩ accept" label**: Cryptic but has a descriptive `title` tooltip. The
  accept button is only visible on linked+overridden rows, a narrow case.
  No change needed.
- **EstimateHealthSummary pills**: Already clean and conditional. No changes.
- **Proposal summary / PDF pages**: No redundant copy or action hierarchy
  issues found during audit.

---

## Validation

### TypeScript

`npx tsc --noEmit` → same pre-existing environment errors as all prior slices
(missing `react`, `next/cache`, `next/server`, JSX intrinsics). No new errors
introduced by the Slice 44 changes. All changed files (orchestrator, adapter)
are free of new type errors.

### Logic check — `hasLinkedRows`

`rows.some(r => r.pricing_source_row_id !== null)` is a pure derived boolean
from the `rows` prop passed to the adapter. It is recomputed on every render,
consistent with how `staleRowIds` state is derived. No memo needed — the
computation is O(n) and the result is a plain boolean used only in the render
path.

### Note row Link button exclusion

`row.row_kind === 'note'` is a stable enum check. The `note` kind is defined
in `JobWorksheetRowKind` alongside `line_item`, `assembly`, `allowance`.
Assembly rows are not excluded — they can have direct pricing (lump sum or
allowance type), so the Link button remains for them.

---

## Invariants Confirmed After Slice 44

All prior invariants (1–9) remain valid. Additionally:

10. The sync toolbar is rendered only when at least one row has a live pricing
    link (`pricing_source_row_id !== null`). On worksheets with no linked rows,
    no sync UI is shown and no sync action is invoked.
11. The Link button is not rendered for `note` row_kind rows. Notes cannot
    carry pricing state and will never have `pricing_source_row_id` set.
12. All action buttons in the worksheet actions column have a `title` attribute
    for hover/accessibility disambiguation.

---

## Known Gaps (Carried Forward)

- Stale mismatch state is not persisted (derived on load, lost on page leave)
- Sync feedback label has no fade animation (appears/disappears abruptly)
- Mobile detail panel: no close-on-outside-tap; no open/close animation
- Mobile has no manual sync trigger (auto-sync on mount covers the common case)
