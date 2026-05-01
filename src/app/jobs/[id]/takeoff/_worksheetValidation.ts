import type { JobWorksheetRow } from '@/components/patterns/estimate/JobWorksheetTableAdapter'
import { unitOptions } from './_worksheetFormatters'

export function validationLabel(row: JobWorksheetRow): string {
  if (!row.description.trim()) return 'Missing item'
  if (!Number(row.quantity)) return 'Missing qty'
  if (!Number(row.unit_price)) return 'Missing price'
  if (!(unitOptions as readonly string[]).includes(row.unit ?? 'ea')) return 'Invalid unit'
  return ''
}
