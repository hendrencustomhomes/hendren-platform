import { resolveUnitCost } from '@/components/patterns/estimate/_lib/unitCostResolver'

export type EstimateValidationResult = {
  isValid: boolean
  errors: string[]
}

// Minimal shape needed for validation — compatible with job_worksheet_items DB rows.
type ValidatableRow = {
  row_kind: string
  pricing_type: string
  quantity: number | string | null | undefined
  pricing_source_row_id: string | null
  unit_cost_manual: number | null
  unit_cost_source: number | null
  unit_cost_override: number | null
  unit_cost_is_overridden: boolean
}

function n(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

// Returns isValid + structured error list for pre-send estimate validation.
// All checks are non-destructive: no DB writes, no state mutation.
export function validateEstimateForSend(rows: ValidatableRow[]): EstimateValidationResult {
  const errors: string[] = []

  // Notes are decorative — exclude from all pricing/quantity checks.
  const priceable = rows.filter((r) => r.row_kind !== 'note')

  if (priceable.length === 0) {
    return { isValid: false, errors: ['Estimate has no rows to include in a proposal.'] }
  }

  // 1. Unpriced rows: no pricing of any kind.
  const unpriced = priceable.filter((r) => r.pricing_type === 'unpriced')
  if (unpriced.length > 0) {
    errors.push(
      `${n(unpriced.length, 'row has', 'rows have')} no pricing — add prices before sending.`,
    )
  }

  // 2. Missing quantity on non-note rows.
  const missingQty = priceable.filter((r) => {
    const q = Number(r.quantity)
    return r.quantity == null || r.quantity === '' || Number.isNaN(q) || q === 0
  })
  if (missingQty.length > 0) {
    errors.push(`${n(missingQty.length, 'row is', 'rows are')} missing quantity.`)
  }

  // 3. Zero or missing unit price on line items that should carry a price.
  //    Allowances are budget placeholders — excluded from this check.
  //    Unpriced rows are already caught above — excluded to avoid double-reporting.
  const lineItems = priceable.filter(
    (r) => r.row_kind === 'line_item' && r.pricing_type !== 'unpriced',
  )
  const zeroPrice = lineItems.filter((r) => {
    const p = resolveUnitCost(r)
    return p == null || p === 0
  })
  if (zeroPrice.length > 0) {
    errors.push(
      `${n(zeroPrice.length, 'line item has', 'line items have')} zero or missing unit price.`,
    )
  }

  return { isValid: errors.length === 0, errors }
}
