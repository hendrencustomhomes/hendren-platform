import type { JobWorksheetRow } from './JobWorksheetTableAdapter'

export const unitOptions = ['flat', 'ea', 'sqft', 'lnft', 'cuft'] as const

export function rowTotal(row: JobWorksheetRow): number {
  const q = Number(row.quantity)
  const p = Number(row.unit_price)
  return q && p ? q * p : 0
}

export function currency(val: unknown, editing = false): string {
  if (!val) return ''
  const num = Number(val)
  if (Number.isNaN(num)) return String(val)
  return editing ? String(num) : `$${num.toFixed(2)}`
}

export function parentSubtotal(parent: JobWorksheetRow, rows: JobWorksheetRow[]): number {
  const childTotal = rows
    .filter((row) => row.parent_id === parent.id)
    .reduce((sum, row) => sum + rowTotal(row), 0)
  return childTotal || rowTotal(parent)
}

export function getDepth(row: JobWorksheetRow, rowsById: Map<string, JobWorksheetRow>): number {
  return row.parent_id ? 1 : 0
}
