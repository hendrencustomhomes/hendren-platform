// Single source of truth for resolving the effective unit cost of a worksheet row.
// Pure function — no side effects, no React, no DB access.
//
// Resolution precedence:
//   1. override  — user explicitly typed a price on a linked row
//   2. source    — price pulled from the linked pricing row
//   3. manual    — user typed a price on an unlinked row

export type UnitCostRow = {
  unit_cost_manual: number | null
  unit_cost_source: number | null
  unit_cost_override: number | null
  unit_cost_is_overridden: boolean
  pricing_source_row_id: string | null
}

export function resolveUnitCost(row: UnitCostRow): number | null {
  if (row.unit_cost_is_overridden) return row.unit_cost_override ?? null
  if (row.pricing_source_row_id !== null) return row.unit_cost_source ?? null
  return row.unit_cost_manual ?? null
}
