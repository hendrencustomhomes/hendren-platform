// Shared presentation utilities for proposal views. No React, no browser APIs.

export const INDENT_PER_DEPTH = 16

export function fmtCurrency(val: number): string {
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtQty(quantity: number | string | null, unit: string | null): string {
  if (quantity == null || quantity === '') return ''
  const q = Number(quantity)
  if (Number.isNaN(q)) return ''
  return unit ? `${q} ${unit}` : String(q)
}

export function fmtUnitPrice(val: number | string | null): string {
  if (val == null || val === '') return ''
  const n = Number(val)
  if (Number.isNaN(n) || n === 0) return ''
  return '$' + n.toFixed(2)
}
