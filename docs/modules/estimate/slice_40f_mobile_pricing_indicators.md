# Slice 40F — Mobile Pricing State Indicators

## Goal

Surface linked / overridden / stale pricing state in the mobile worksheet view,
consistent with the desktop indicator set introduced in Slice 40C–40D.

## Design Decisions

### Extract icons to shared module

`LinkIcon`, `PencilIcon`, `StaleSourceDot`, `PricingStateIcon`, and `fmt` were
local to `JobWorksheetTableAdapter.tsx`. Moving them to a shared file
eliminates duplication and makes the icon set a single source of truth for
both desktop and mobile.

**New file:** `src/components/patterns/estimate/_lib/pricingStateIcon.tsx`

No resolver logic moved — the shared file only contains rendering and tooltip
formatting. `resolveUnitCost` stays in `_lib/unitCostResolver.ts`.

### Indicator placement: right of description input

Mobile rows already have a tight four-column input grid. The description row
is full-width and has natural horizontal space after the input ends. The icon
is placed right of the description input inside a flex container:

```
[description input ──────────────] ⛓·✎·●
[qty] [unit price] [unit] [total]
```

`PricingStateIcon` returns `null` for manual (unlinked) rows, so no space is
wasted and the layout is unaffected for the common case.

### Stale state via prop

The adapter already holds `staleRowIds: Set<string>` from the mount-time sync
and the manual sync trigger. `JobWorksheetMobileView` receives it as an
optional prop (default: empty set) so existing call sites that don't pass it
continue to work.

### Indicator semantics

| State | Icon |
|---|---|
| Manual (no link) | *(nothing)* |
| Linked, source current | Blue chain |
| Overridden, source current | Amber chain + pencil |
| Overridden, source stale | Amber chain + pencil + orange dot |

Tooltip content and colors are identical to the desktop column indicator.

## Files Changed

| File | Change |
|---|---|
| `src/components/patterns/estimate/_lib/pricingStateIcon.tsx` | **New** — shared `PricingStateIcon`, `LinkIcon`, `PencilIcon`, `StaleSourceDot`, `fmt` |
| `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx` | Remove local icon definitions; import from shared file; pass `staleRowIds` to `JobWorksheetMobileView` |
| `src/components/patterns/estimate/JobWorksheetMobileView.tsx` | Add `staleRowIds` prop; import `PricingStateIcon`; render icon right of description input |

## Invariants After 40F

1. Icon SVG paths and colors are defined once in `_lib/pricingStateIcon.tsx`.
2. Both desktop (source column) and mobile (beside description) use the same
   `PricingStateIcon` component.
3. Stale state is sourced from the same `Set<string>` in the adapter for both
   render paths.
4. No resolution logic was added to either the mobile view or the shared icon
   module.

## UX Risks

- **Touch target size:** the icon is 11–12 px, below the recommended 44 px
  touch target. Since it is display-only (no click action), this is acceptable.
  A future slice could wrap it in a tap-to-reveal popover if needed.
- **No tooltip on mobile:** `title` attributes are not shown on touch devices.
  State must be inferred from the icon color and shape alone. This matches the
  design doc guidance ("icons over text where intuitive") and is consistent
  with the known constraint from Slice 40C.

## Out of Scope

- Tap-to-reveal popover for mobile tooltip
- New DB columns
- Sync behavior changes
- Resolver changes
