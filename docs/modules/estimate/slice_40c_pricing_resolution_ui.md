# Slice 40C — Pricing Resolution UI (Minimal)

## Goal

Expose pricing state (manual / linked / overridden) in the worksheet table
without text-heavy badges, new columns, or layout expansion.

## Design Decisions

### Single placement: the source column

The unit price cell is a `kind:'text'` editable input in `EditableDataTable`.
The table component renders a live `<input>` for all editable rows regardless
of focus state, so there is no "non-edit" static render path to CSS-style.

Rather than converting the price cell to `kind:'static'` (which would break
keyboard navigation), all state indicators live in the **pricing source
column** — adjacent to the unit price column. Per the spec, one location was
chosen.

### Icons only — no text badges

`PricingSourceBadge` showed "Linked" or "Manual" as text pills. Replaced with
`PricingStateIcon`:

| State | Indicator | Color |
|---|---|---|
| Manual | *(empty)* | — |
| Linked | ⛓ link SVG | `#2563eb` (blue) |
| Overridden | ⛓ link + ✎ pencil SVGs | `#d97706` (amber) |

Both icons are inline SVGs (11×11 px and 10×10 px). They have no emoji
rendering ambiguity and scale with the surrounding text.

### Tooltip on hover

`title` attribute provides browser-native tooltip:

- **Linked:** `Linked · source $X.XX · SKU: XYZ`
- **Overridden:** `Override active · source $X.XX → $Y.YY · SKU: XYZ`

No persistent text is added to the DOM.

### Override visual distinction

The amber color of the icon pair (link + pencil) is the visual indicator that
the unit price value in the adjacent cell is an override, not the source price.
Amber was chosen to be clearly distinct from the blue "linked" state without
being alarming (it is not red).

### Accept button tightened

The Accept button changes from a standard secondary button to a minimal
secondary action:
- Font: 10 px, weight 500 (was 11 px, 600)
- Padding: `1px 5px` (was `2px 6px`)
- Background: transparent (was `var(--surface)`)
- Label: `↩ accept` (was `Accept`)
- Tooltip: "Discard override — revert to linked source price"

The `↩` arrow makes the action's intent (revert) immediately readable at a
glance.

### Source column narrowed

Column width: `36px` (was `90px`). No header label (was `"Source"`). The
column still exists for layout purposes and icon placement.

## Files Changed

| File | Change |
|---|---|
| `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx` | Replace `PricingSourceBadge` with `PricingStateIcon`; narrow source column; tighten Accept button |

## Before / After

| Aspect | Before | After |
|---|---|---|
| Linked row indicator | "Linked" text pill (blue background, border) | Small blue link SVG icon |
| Manual row indicator | "Manual" text pill (muted, border) | Empty cell |
| Override indicator | n/a | Amber link + pencil SVG icons |
| Override tooltip | — | Source value → override value + SKU |
| Accept button | `Accept` (standard secondary) | `↩ accept` (minimal, transparent) |
| Source column width | 90 px | 36 px |
| Source column label | "Source" | *(empty)* |

## UX Risks

- **Tooltip-only detail:** source and override values are only visible on hover.
  Users who don't hover will not see exact values. Acceptable for a minimal
  slice; a future slice could add an inline popover.
- **Amber vs orange:** `#d97706` may look similar to `#d97706`-adjacent colors
  depending on screen calibration. If contrast feedback from testing warrants
  it, the amber can be darkened slightly.
- **↩ arrow glyph:** Unicode `↩` (U+21A9) renders as text, not emoji. If a
  target environment lacks the glyph, it may fall back to a box character.
  `←` (U+2190) is a safe fallback if needed.

## Out of Scope

- Mismatch indicators (source changed since link was established)
- Pricing sync flow
- Mobile view (override indication not added to `JobWorksheetMobileView`)
- New DB columns or resolver changes
