# Slice 40D — Pricing Source Sync and Mismatch Surfacing

## Goal

Detect when a linked pricing row's `unit_price` has changed since the link was
established (i.e. `unit_cost_source` is stale). For non-overridden linked rows,
auto-sync the stored snapshot. For overridden rows, preserve the override and
surface the mismatch with a minimal indicator.

## Design Decisions

### No new DB columns

Mismatch state for overridden rows is transient. It is derived at load time by
comparing live `pricing_rows.unit_price` to the stored `unit_cost_source`. No
column is added to persist this state.

### Auto-sync for non-overridden linked rows

When the source price changes and the row is not overridden, the intent is clear:
the row should track the latest price. The sync action updates `unit_cost_source`
silently. The user sees the new resolved price without any indicator — the price
is simply current.

### Stale dot for overridden rows

When the source price changes and the row has an override in effect, the sync
must NOT overwrite anything — the user chose a different price intentionally.
Instead, a subtle indicator is shown: a 6 px orange dot appended to the icon
pair in the source column.

| State | Indicator |
|---|---|
| Linked, source current | Blue chain (unchanged) |
| Linked, source changed | — (auto-synced, no indicator) |
| Overridden, source current | Amber chain + pencil |
| Overridden, source changed | Amber chain + pencil + orange dot |

The dot tooltip is augmented with `· source price updated` so hover still
communicates the full state without requiring any new DOM structure.

### Locked estimates

If the estimate is not editable, auto-sync writes are skipped. Changed rows
(overridden or not) are returned as stale for UI indication only.

### Sync on worksheet load

`syncLinkedPricing(estimateId, jobId)` is called once on component mount via
`useEffect` in `JobWorksheetTableAdapter`. It runs in the background — no
loading indicator is shown. Auto-synced rows are applied client-side via
`forceUpdateRow`; stale row IDs are stored in a `Set<string>` in component
state and passed down to `PricingStateIcon`.

## Server Action: `syncLinkedPricing`

**Location:** `src/app/actions/worksheet-pricing-actions.ts`

```typescript
export async function syncLinkedPricing(
  estimateId: string,
  jobId: string,
): Promise<{ syncedRows: JobWorksheetRow[]; staleRowIds: string[] } | { error: string }>
```

**Steps:**
1. Fetch all worksheet items with `pricing_source_row_id IS NOT NULL`
2. Fetch current `unit_price` from `pricing_rows` (bulk, by unique row IDs)
3. Compare each item's `unit_cost_source` to the live price
4. For each changed item:
   - Not overridden + estimate editable → update `unit_cost_source` in DB
   - Overridden, or estimate locked → add to `staleRowIds`
5. Return updated rows + stale IDs

## Stale Comment Fix

`JobWorksheetTableAdapter.tsx` previously had a stale comment:

```tsx
{/* Inline confirm: manual price edit drops the link */}
```

This was incorrect since Slice 40B (the link is kept; an override is written).
Fixed to:

```tsx
{/* Inline confirm: price edit on a linked row — writes an override, keeps the link */}
```

## Files Changed

| File | Change |
|---|---|
| `src/app/actions/worksheet-pricing-actions.ts` | New `syncLinkedPricing` action |
| `src/components/patterns/estimate/JobWorksheetTableAdapter.tsx` | `useEffect` sync on mount; `StaleSourceDot` component; `PricingStateIcon` accepts `isStale`; `getColumns` accepts `staleRowIds`; stale comment fixed |

## Invariants After 40D

1. `unit_cost_source` for non-overridden linked rows is always current with the
   live pricing row on next worksheet load.
2. Overrides are never silently overwritten by sync.
3. Stale mismatch for overridden rows is surfaced at the icon level — no new
   column, no text, no persistent badge.
4. `resolveUnitCost` remains the single source of truth for the effective price.

## Out of Scope

- Persistent stale state (no DB column added)
- Mobile view stale indicator
- Sync re-trigger on demand (no refresh button)
- Removing the legacy `unit_price` column
