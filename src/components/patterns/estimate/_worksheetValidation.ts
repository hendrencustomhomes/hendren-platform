import type { JobWorksheetRow } from './JobWorksheetTableAdapter'
import { unitOptions } from './_worksheetFormatters'
import { resolveUnitCost } from './_lib/unitCostResolver'

export function validationLabel(row: JobWorksheetRow): string {
  if (!row.description.trim()) return 'Missing item'
  if (row.row_kind === 'note') return ''
  if (!Number(row.quantity)) return 'Missing qty'
  if (!Number(resolveUnitCost(row))) return 'Missing price'
  if (!(unitOptions as readonly string[]).includes(row.unit ?? 'ea')) return 'Invalid unit'
  return ''
}
