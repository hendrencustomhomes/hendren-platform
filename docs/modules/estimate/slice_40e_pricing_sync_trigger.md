# Slice 40E — Pricing Sync Trigger

## Goal

Add a minimal on-demand control that lets users manually re-run the pricing
source sync. Reuses the existing `syncLinkedPricing` action introduced in
Slice 40D.

## Design Decisions

### Placement: above the table, right-aligned

The sync control is rendered in a single-row flex container immediately above
the `EditableDataTable`. Right-alignment keeps it out of the reading path
while remaining discoverable. It does not occupy a column and does not affect
table layout.

### Icon + compact text

A 12×12 circular-arrow SVG (`SyncIcon`) paired with a short label:

| State | Label | Appearance |
|---|---|---|
| Idle | `Sync prices` | Full opacity, pointer cursor |
| Pending | `Syncing…` | 40% opacity, default cursor, disabled |

No spinner animation (avoids CSS keyframe dependency). Opacity reduction
provides sufficient pending feedback for an operation that typically completes
in under a second.

### No new server action

`handleManualSync` calls `syncLinkedPricing(activeEstimateId, jobId)` — the
same action the `useEffect` auto-sync uses on mount. The result is applied
identically: `forceUpdateRow` for each synced row, `setStaleRowIds` from the
returned stale list.

### Guard against double-fire

```typescript
async function handleManualSync() {
  if (syncPending) return
  setSyncPending(true)
  ...
}
```

Button is also `disabled` while pending, so the guard is belt-and-suspenders.

## Files Changed

| File | Change |
|---|---|
| `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx` | `SyncIcon` component; `syncPending` state; `handleManualSync` function; sync button above table |

## Behavior Summary

1. On worksheet load: auto-sync fires via `useEffect` (Slice 40D, unchanged).
2. User clicks "Sync prices": `handleManualSync` fires, button enters pending
   state, action runs, stale IDs and synced rows are applied, button returns
   to idle.
3. Non-overridden rows whose source changed: `unit_cost_source` updated in DB,
   client updated immediately via `forceUpdateRow`.
4. Overridden rows whose source changed: `staleRowIds` updated, orange dot
   appears on their `PricingStateIcon`.
5. If no linked rows exist: action returns immediately with empty arrays, no
   DB writes occur.

## UX Risks

- **Invisible result when nothing changed:** "Sync prices" → "Syncing…" →
  "Sync prices" with no other change. Users may not know if it did anything.
  Acceptable for a minimal slice; a future slice could flash a brief "Up to
  date" confirmation.
- **Concurrent edits:** if a user edits a price while sync is in flight, the
  edit and sync are independent DB operations. The last write wins. This is
  the same race that exists for all worksheet autosave operations.

## Out of Scope

- New DB columns
- Persistent stale state
- Mobile-specific sync UI
- Spin animation
- "Up to date" confirmation feedback
- Resolver or sync semantic changes
