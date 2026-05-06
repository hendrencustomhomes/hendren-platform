# Slice 40G — Sync Confirmation Feedback

## Goal

Show brief, non-invasive confirmation after the user clicks "Sync prices" so
they know whether anything changed, without adding a toast system, banner, or
persistent status panel.

## Design Decisions

### Inline text adjacent to the sync button

The feedback label appears to the left of the "Sync prices" button inside the
existing flex toolbar row. It disappears after 3 seconds. No new DOM structure
is introduced — the `<span>` is conditionally rendered based on `syncFeedback`
state.

```
[Up to date]  [↻ Sync prices]
[Updated]     [↻ Sync prices]
[Needs review][↻ Sync prices]
```

While sync is running, the feedback is cleared and the button reads "Syncing…"
(unchanged from Slice 40E). The label reappears once the action resolves.

### Three distinct states

| Result | Label | Color |
|---|---|---|
| No rows changed | Up to date | `var(--text-muted)` |
| ≥1 row synced, no stale | Updated | `#16a34a` (green) |
| ≥1 stale override remaining | Needs review | `#d97706` (amber) |

"Needs review" uses the same amber as the override icon — the association is
intentional: it signals that some rows have the amber chain+pencil+dot
indicator and require a decision (accept source price or keep override).

"Up to date" is deliberately muted. It is informational, not an alert.

"Updated" is green to confirm successful price application.

### 3-second auto-clear

```typescript
feedbackTimerRef.current = setTimeout(() => setSyncFeedback(null), 3000)
```

If the user triggers a second sync before the timer fires, the timer is
cancelled and feedback is cleared before the new sync begins. This prevents
stale labels from persisting across multiple runs.

### Cleanup on unmount

A dedicated `useEffect` clears the pending timer when the component unmounts,
preventing state updates on an unmounted component.

## Files Changed

| File | Change |
|---|---|
| `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx` | Add `useRef` import; `SyncFeedback` type; `syncFeedback` state + `feedbackTimerRef`; timer cleanup effect; feedback derivation in `handleManualSync`; feedback `<span>` in toolbar |

## Behavior Summary

1. User clicks "Sync prices."
2. Any existing feedback label clears immediately. Button reads "Syncing…"
3. `syncLinkedPricing` runs.
4. On completion:
   - Stale IDs and synced rows applied as before.
   - Feedback label set based on result counts.
   - 3-second timer starts.
5. After 3 seconds, label fades from DOM (state set to null, element unmounts).
6. If user clicks again before timer fires: timer cancelled, cycle resets from step 2.

## UX Risks

- **"Needs review" is amber but not sticky:** it auto-clears in 3 seconds even
  though the underlying stale state persists (orange dots remain on affected
  rows). The dots are the persistent signal; the label is a momentary prompt.
  Users who miss the 3-second window still see the dots.
- **No animation:** the label appears and disappears without a fade transition.
  Acceptable for a minimal slice; a CSS `opacity` transition could soften it
  in a future pass.
- **Sync on mount does not show feedback:** the `useEffect` auto-sync on load
  applies results silently. This is intentional — showing feedback on every
  page load would be noisy. Feedback is reserved for user-triggered syncs only.

## Out of Scope

- Fade animation
- Mobile tap-to-reveal popover
- Persistent stale state
- New toast/notification system
- Resolver or sync semantic changes
