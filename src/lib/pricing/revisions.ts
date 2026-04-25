import { getPricingHeader } from './headers'
import { createPricingRow, listPricingRowsForHeader } from './rows'
import type { DbClient, PricingHeader, PricingRow } from './types'

const PRICING_HEADER_COLS =
  'id, kind, job_id, company_id, trade_id, cost_code_id, title, revision, status, effective_date, received_at, supersedes_header_id, notes, is_active, created_at, updated_at'

export async function createPricingHeaderRevision(
  supabase: DbClient,
  pricingHeaderId: string
): Promise<{ header: PricingHeader; rows: PricingRow[] }> {
  const [header, rows] = await Promise.all([
    getPricingHeader(supabase, pricingHeaderId),
    listPricingRowsForHeader(supabase, pricingHeaderId),
  ])

  if (!header) throw new Error('Pricing header not found')

  const { data: newHeaderData, error: newHeaderError } = await supabase
    .from('pricing_headers')
    .insert({
      kind: header.kind,
      job_id: header.job_id,
      company_id: header.company_id,
      trade_id: header.trade_id,
      cost_code_id: header.cost_code_id,
      title: header.title,
      revision: header.revision + 1,
      status: header.status,
      effective_date: header.effective_date,
      received_at: header.received_at,
      supersedes_header_id: header.id,
      notes: header.notes,
      is_active: header.is_active,
    })
    .select(PRICING_HEADER_COLS)
    .single()

  if (newHeaderError) throw newHeaderError
  const newHeader = newHeaderData as PricingHeader

  const newRows: PricingRow[] = []

  for (const row of rows) {
    const newRow = await createPricingRow(supabase, {
      pricing_header_id: newHeader.id,
      catalog_sku: row.catalog_sku,
      vendor_sku: row.vendor_sku,
      description_snapshot: row.description_snapshot,
      pricing_type: row.pricing_type,
      quantity: row.quantity,
      unit: row.unit,
      unit_price: row.unit_price,
      lead_days: row.lead_days,
      notes: row.notes,
      is_active: row.is_active,
    })
    newRows.push(newRow)
  }

  return { header: newHeader, rows: newRows }
}
