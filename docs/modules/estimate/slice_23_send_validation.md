# Slice 23 — Estimate Send Validation Guardrails

**Status:** Completed
**Date:** 2026-05-03
**Branch:** dev

---

## 1. What Was Done

Added server-side pre-send validation to the proposal send flow so estimates with missing pricing or quantities cannot be sent.

`sendProposal` in `document-actions.ts` now validates the estimate's worksheet rows before the atomic send RPC executes. Invalid estimates return `{ error }` with specific messages. The existing `actionError` display in `ProposalBuilderOrchestrator` surfaces these errors without any UI changes.

---

## 2. Files Changed

| File | Change |
|---|---|
| `src/lib/estimateValidation.ts` | **New** — single-owner validation function for estimate send checks |
| `src/app/actions/document-actions.ts` | Import and call `validateEstimateForSend` in `sendProposal` before the atomic RPC |
| `docs/actions/slices/slice_23_send_validation.md` | This report |

---

## 3. What Changed

### `src/lib/estimateValidation.ts` (new)

Exports:

- `EstimateValidationResult` type: `{ isValid: boolean; errors: string[] }`
- `validateEstimateForSend(rows: ValidatableRow[]): EstimateValidationResult`

`ValidatableRow` is a minimal local type (`row_kind`, `pricing_type`, `quantity`, `unit_price`) — compatible with any `job_worksheet_items` row shape. No dependency on client-side component types.

Three checks, in order:

| Check | Rule |
|---|---|
| No priceable rows | `row_kind !== 'note'` count is 0 → blocked |
| Unpriced rows | Non-note rows where `pricing_type === 'unpriced'` → count reported |
| Missing quantity | Non-note rows where quantity is null / empty / NaN / 0 → count reported |
| Zero unit price | `row_kind === 'line_item'` rows where `pricing_type !== 'unpriced'` and `unit_price` is null / 0 / NaN → count reported |

Notes and allowances are excluded from zero-price check: notes are decorative, allowances are budget placeholders whose price semantics differ.
Unpriced rows are excluded from the zero-price check to avoid double-reporting.

All checks are pure — no DB calls, no side effects.

### `src/app/actions/document-actions.ts`

Added one import and a five-line guard block in `sendProposal`, placed after `worksheetRows` is set (rows already loaded) and before structure derivation:

```typescript
const validation = validateEstimateForSend(worksheetRows)
if (!validation.isValid) {
  return { error: validation.errors.join(' · ') }
}
```

Errors are joined with ` · ` into the existing `{ error: string }` return type. No changes to the function signature, the RPC call, or any revalidation paths.

### UI (no change)

`ProposalBuilderOrchestrator` already renders `actionError` from the `sendProposal` result:

```tsx
{actionError && (
  <span style={{ fontSize: '12px', color: 'var(--error, #c0392b)' }}>{actionError}</span>
)}
```

Validation errors surface through this existing path with no UI modifications.

---

## 4. Where Validation Is Enforced

| Layer | Enforcement |
|---|---|
| Server action (`sendProposal`) | `validateEstimateForSend` blocks before atomic RPC — primary enforcement |
| UI (`ProposalBuilderOrchestrator`) | Existing `actionError` display surfaces the error messages |
| Database (RPC `send_proposal`) | Unchanged — no validation at this layer |

---

## 5. Validation Results

- `npx tsc --noEmit` — 0 errors
- No changes to proposal builder UI, worksheet persistence, RLS, or estimate lock semantics
- `sendProposal` signature and all revalidation paths unchanged

---

## 6. Risks / Follow-up

1. **`lockProposal` in `proposal-actions.ts` is not validated** — `lockProposal` is a separate action (locks proposal + estimate without creating a snapshot). It is not called by the "Send proposal" button in the builder (which calls `sendProposal`). If `lockProposal` is ever exposed to users directly, validation should be added there too. For now, only `sendProposal` is the user-facing send path.

2. **Assembly rows with missing quantity are flagged** — Assembly rows used as grouping parents may legitimately have null quantity when the total derives from children. These will appear in the missing-quantity count. A future slice could exclude `row_kind === 'assembly'` from the quantity check if it produces false positives in practice.

3. **Zero unit price for non-line-item rows is not checked** — Assembly and allowance rows with `unit_price = 0` are not flagged. Assembly totals come from children; allowances are intentional budget buckets. This is conservative. Tighten if real-world false negatives emerge.

4. **Errors shown as a single joined string** — Multiple validation errors are joined with ` · ` into the single `{ error: string }` return type expected by the existing UI. If the UI grows a dedicated validation panel, `errors: string[]` is already available on `EstimateValidationResult`.

5. **Health indicators (Slice 22) not modified** — `EstimateHealthSummary` is advisory and client-side. Validation is enforcement and server-side. They apply similar logic independently — this is intentional. The health summary tells users what is wrong before they try to send; validation is the server-side gate.

---

## 7. Intentionally Not Changed

- `ProposalBuilderOrchestrator` — no UI changes; existing `actionError` display is sufficient
- `lockProposal`, `signProposal`, `voidProposal` in `proposal-actions.ts` — not send actions
- `EstimateHealthSummary` — advisory display, separate concern
- Worksheet persistence (`worksheet-item-actions.ts`, `useJobWorksheetPersistence`) — untouched
- Estimate editability logic (`isEstimateEditable`, `requireEditableEstimate`) — untouched
- RLS policies — no schema changes
- Any pricing source or bid module — untouched
