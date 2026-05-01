# Worksheet Cleanup Slice — Report 05B

**Date:** 2026-05-01
**Branch:** dev
**Commit:** 4818884

---

## Objective

Make worksheet validation aware of `row_kind`. The prior implementation applied
the same quantity/price/unit checks to every row regardless of kind, which caused
`note` rows — which carry no pricing — to show spurious validation warnings.

---

## File Modified

`src/components/patterns/estimate/_worksheetValidation.ts`

---

## Validation Rules — Before vs After

### Before

```ts
export function validationLabel(row: JobWorksheetRow): string {
  if (!row.description.trim()) return 'Missing item'
  if (!Number(row.quantity)) return 'Missing qty'
  if (!Number(row.unit_price)) return 'Missing price'
  if (!(unitOptions as readonly string[]).includes(row.unit ?? 'ea')) return 'Invalid unit'
  return ''
}
```

All rows of every kind were subject to all four checks.

### After

```ts
export function validationLabel(row: JobWorksheetRow): string {
  if (!row.description.trim()) return 'Missing item'
  if (row.row_kind === 'note') return ''
  if (!Number(row.quantity)) return 'Missing qty'
  if (!Number(row.unit_price)) return 'Missing price'
  if (!(unitOptions as readonly string[]).includes(row.unit ?? 'ea')) return 'Invalid unit'
  return ''
}
```

`note` rows exit after the description check. All other row kinds continue
through the full check sequence unchanged.

---

## Row Kinds Handled

`JobWorksheetRowKind` is `'line_item' | 'assembly' | 'note' | 'allowance'`.

| Row kind | Description required | Qty required | Price required | Unit required |
|---|---|---|---|---|
| `line_item` | Yes | Yes | Yes | Yes |
| `assembly` | Yes | Yes | Yes | Yes |
| `note` | Yes | No | No | No |
| `allowance` | Yes | Yes | Yes | Yes |

`allowance` was left subject to the full check set. The pricing fields for
allowance rows share the same DB columns as priced rows and the design doc does
not distinguish allowance validation from standard priced row validation. No
change made there pending a concrete spec.

---

## Confirmation: No UI / State / Persistence Behavior Change

- No component markup changed.
- No mobile layout changed.
- No desktop column set changed.
- No state hook changed.
- No persistence hook changed.
- No keyboard behavior, autosave, row creation, delete, or undo logic changed.
- No DB schema changes.
- The validation function signature is unchanged: `(row: JobWorksheetRow) => string`.
- No new `any`.

---

## Build Result

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass — 4.4s |
| TypeScript | Pass — 7.2s |
| Static prerender | Pre-existing Supabase env-var failure — unrelated |

---

## What Was NOT Touched

- `JobWorksheetTableAdapter.tsx`
- `JobWorksheetMobileView.tsx`
- `_worksheetFormatters.ts`
- `JobWorksheetPageOrchestrator.tsx`
- All engine files (`EditableDataTable`, `useWorksheetInteraction`, `useWorksheetVirtualization`, `worksheetTypes`)
- All state and persistence hooks
- All route pages
