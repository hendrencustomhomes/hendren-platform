# Slice 40H — Mobile Pricing Detail (Tap-to-Reveal)

## Goal

On mobile, the pricing state icon conveys linked / overridden / stale status
but `title` attributes are not shown on touch devices. This slice adds a
tap-to-reveal inline detail panel that surfaces source value, override value,
SKU, and stale notice without requiring a modal or full-screen drawer.

## Design Decisions

### Inline collapsible panel, not a modal

The detail panel appears immediately below the description row, above the
input grid. It is conditionally rendered based on `openDetailRowId` state.
No overlay, no backdrop, no z-index management.

```
[description input ────────────────────] [⛓·✎·●]  ← tap icon button
[Source   $X.XX                       ]            ← detail expands here
[Override  $Y.YY                      ]
[SKU  ABC-123                         ]
[⚠ Source price updated               ]
[qty] [unit price] [unit] [total]                  ← grid unchanged
```

### Icon becomes a tap button

The `PricingStateIcon` span was display-only. On mobile it is now wrapped in a
`<button type="button">` with `aria-label`. The button has no visible chrome —
background: none, border: none — so the icon appearance is unchanged.

Rows with no pricing state (manual, unlinked) render nothing in that slot, as
before.

### Toggle: tap same icon to close

```typescript
function toggleDetail(rowId: string) {
  setOpenDetailRowId((prev: string | null) => (prev === rowId ? null : rowId))
}
```

Only one detail panel can be open at a time. Opening a new row's detail
automatically closes the previous one.

### Detail panel content

| Line | Shown when |
|---|---|
| Source `$X.XX` | Always (row is linked) |
| Override `$Y.YY` (amber) | `unit_cost_is_overridden === true` |
| SKU `ABC-123` | `source_sku ?? catalog_sku` exists |
| Source price updated (orange) | Row ID is in `staleRowIds` |

`fmt` is imported from `_lib/pricingStateIcon` — the same formatting function
used by the desktop tooltip. No duplication.

### No animation

The panel appears and disappears without a transition. Acceptable for a
minimal slice; a CSS height or opacity transition is noted as a future gap.

## Files Changed

| File | Change |
|---|---|
| `src/components/patterns/estimate/JobWorksheetMobileView.tsx` | Add `useState` import; import `fmt` from shared icon module; `openDetailRowId` state + `toggleDetail` function; icon wrapped in tap `<button>`; inline detail panel between description and input grid |

## Invariants After 40H

1. `PricingStateIcon` itself is unchanged — still a display-only component.
2. The tap affordance is provided by a wrapper `<button>` in the mobile view
   only; the desktop adapter is unaffected.
3. `fmt` is called from the shared module; no resolution logic is duplicated.
4. `staleRowIds` set (from the adapter's sync result) is the authoritative
   source of stale state for both the icon dot and the detail panel notice.

## UX Risks

- **No close-on-outside-tap:** the panel stays open until the user taps the
  icon again or opens another row's detail. This is intentional simplicity;
  a document-level `touchstart` handler could close it but adds complexity.
- **No animation:** panel pops in/out abruptly. Noted as a future gap.
- **Detail panel pushes layout:** opening the panel shifts the input grid
  down, which may be jarring if the user taps while their thumb is near the
  grid. Acceptable — the grid is not hidden, just shifted.

## Out of Scope

- Close-on-outside-tap
- Animation
- Desktop changes
- DB changes
- Sync behavior changes
- Resolver changes
