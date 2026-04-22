# Shared Foundation Build — R01

Session date: 2026-04-22
Branch: dev

---

## Purpose

This session built the shared foundation layer described in the module design standard. The goal was to establish the reusable pieces that module rewrites will inherit from, so those rewrites don't duplicate logic, copy style objects, or improvise their own versions.

No module rewrites were performed. Only global shared files were written.

---

## Files Written

### `src/lib/shared/numbers.ts`

Consolidated two separate currency formatting implementations that existed across the codebase into one canonical export.

Exports:
- `formatMoney(value)` — formats a number as USD currency using `Intl.NumberFormat`. Returns `—` for null/undefined/non-finite values.
- `parseNumber(value)` — strips `$` and `,` before parsing. Returns `null` for empty or non-numeric input.

`parseNumber` was specifically written to handle formatted currency input — a user typing `$1,250.00` into a cell should parse cleanly.

---

### `src/lib/shared/dates.ts`

Consolidated four identical date formatting implementations that existed across the codebase into one canonical export.

Exports:
- `formatShortDate(value)` — formats an ISO date string as `Mon D` (e.g. `Apr 22`). Returns `—` for null/undefined/invalid.

---

### `src/app/jobs/[id]/takeoffUtils.ts` (modified)

The existing `formatCurrency` export in this file was a direct duplicate of `formatMoney`. Rather than deleting it and breaking existing callers, it was changed to a re-export:

```ts
export { formatMoney as formatCurrency } from '@/lib/shared/numbers'
```

All existing callers continue to work unchanged. The duplication is eliminated.

---

### `src/components/feedback/LoadingState.tsx`

Simple loading state display. Props: `message` (default `Loading…`), `padding` (default `16px`).

---

### `src/components/feedback/EmptyState.tsx`

Empty state display with an optional detail line. Props: `message`, `detail?`, `padding` (default `16px`).

---

### `src/components/feedback/ErrorMessage.tsx`

Inline error message in `var(--red)`. Props: `error` (null/undefined renders nothing), `padding?`.

Normalizes 17 inline error displays across the codebase that used four different color values. The semantic token adapts to dark mode.

---

### `src/components/layout/PageShell.tsx`

Nav + content wrapper used by every page. Props: `title`, `back?`, `jobId?`, `children`, `padding` (default `16px`), `gap` (default `12px`).

Replaces the repeated pattern in every route:
```tsx
<Nav title="..." back="..." />
<div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
  {children}
</div>
```

---

### `src/components/layout/SectionHeader.tsx`

Section card header bar. Props: `title`, `right?` (ReactNode for pills, buttons, or any right-side content).

Replaces the repeated `sectionHeaderStyle` + `sectionTitleStyle` inline object pattern used in every module's section cards.

---

### `src/components/ui/Card.tsx`

Section card wrapper. No props except `children`.

Replaces the repeated `sectionCardStyle` inline object (`var(--surface)` background, `var(--border)` border, `18px` radius, `overflow: hidden`) used in every module.

---

### `src/components/data-display/StatusPill.tsx`

Bordered pill badge. Props: `text`, `tone?` (`default | active | warning | danger`).

Extracted from the `metaPill()` inline function in `PricingWorksheetPage`. Tone maps to semantic colors: `active` → `var(--blue)`, `warning` → `#fbbf24`, `danger` → `#fca5a5`, `default` → `var(--text-muted)`.

---

## What This Enables

Every module rewrite can now:

- import `formatMoney` / `parseNumber` / `formatShortDate` from shared instead of defining them locally
- use `LoadingState`, `EmptyState`, `ErrorMessage` instead of inline loading/empty/error displays
- use `PageShell` instead of writing Nav + content wrapper manually
- use `Card` + `SectionHeader` instead of repeating the section card style objects
- use `StatusPill` instead of writing a local pill function

The module structure standard defines these as the foundation layer. They are now real files, not planned files.

---

## Also In This Session

### PricingWorksheetPage stitch (four changes)

Applied via adjacent-file stitch strategy. Four targeted changes to `src/components/pricing/PricingWorksheetPage.tsx`:

1. `parseNullableNumber` strips `$` and `,` before parsing — handles formatted currency input
2. Row creation validation requires `description_snapshot`, not `catalog_sku` — catalog link made optional
3. Catalog dropdown label changed to `Optional catalog link`
4. Desktop `unit_price` cell displays formatted USD when not active; raw numeric when editing

Full details in `docs/claude/pricing_worksheet_stitch.md`.

### Docs folder cleanup

Deleted 36 files: 33 schedule session logs, miscellaneous working docs that had been superseded. Created `docs/modules/` with per-module subfolders. Renamed files to stable naming convention. Moved `decisions.md` from root to `docs/`.

### README replacement

Replaced the default Next.js boilerplate README with a platform-specific one covering stack, run locally, repo structure, and branch workflow.

### repo_tree updates

`docs/design/repo_tree` updated after every structural change to reflect current dev state.
