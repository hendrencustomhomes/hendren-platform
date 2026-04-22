import { getCatalogItemBySku } from './catalog'
import { getPricingHeader } from './headers'
import type {
  CatalogItem,
  CreatePricingRowInput,
  DbClient,
  PricingRow,
  ReorderPricingRowsInput,
  UpdatePricingRowPatch,
} from './types'

const PRICING_ROW_COLS =
  'id, pricing_header_id, catalog_sku, cost_code_id, source_sku, vendor_sku, description_snapshot, unit, unit_price, lead_days, notes, sort_order, is_active, created_at, updated_at'

async function generateSourceSku(
  supabase: DbClient,
  companyId: string,
  costCodeId: string,
  title: string
): Promise<string> {
  const { data, error } = await supabase.rpc('generate_source_sku', {
    p_company_id: companyId,
    p_cost_code_id: costCodeId,
    p_title: title,
  })
  if (error) throw error
  return String(data)
}

async function getNextPricingRowSortOrder(
  supabase: DbClient,
  pricingHeaderId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('pricing_rows')
    .select('sort_order')
    .eq('pricing_header_id', pricingHeaderId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return Number(data?.sort_order ?? -1) + 1
}

export async function listPricingRowsForHeader(
  supabase: DbClient,
  pricingHeaderId: string
): Promise<PricingRow[]> {
  const { data, error } = await supabase
    .from('pricing_rows')
    .select(PRICING_ROW_COLS)
    .eq('pricing_header_id', pricingHeaderId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as PricingRow[]
}

export async function createPricingRow(
  supabase: DbClient,
  input: CreatePricingRowInput
): Promise<PricingRow> {
  const [header, nextSortOrder] = await Promise.all([
    getPricingHeader(supabase, input.pricing_header_id),
    getNextPricingRowSortOrder(supabase, input.pricing_header_id),
  ])

  if (!header) throw new Error('Pricing header not found')

  let catalogItem: CatalogItem | null = null

  if (input.catalog_sku) {
    catalogItem = await getCatalogItemBySku(supabase, input.catalog_sku)
    if (!catalogItem) throw new Error('Catalog item not found')
  }

  const descriptionSnapshot = input.description_snapshot?.trim() || catalogItem?.title

  if (!descriptionSnapshot) {
    throw new Error('Description is required')
  }

  const costCodeId = catalogItem?.cost_code_id || header.cost_code_id
  const sourceSku = await generateSourceSku(
    supabase,
    header.company_id,
    costCodeId,
    descriptionSnapshot
  )

  const { data, error } = await supabase
    .from('pricing_rows')
    .insert({
      pricing_header_id: input.pricing_header_id,
      catalog_sku: catalogItem?.catalog_sku ?? null,
      cost_code_id: costCodeId,
      source_sku: sourceSku,
      vendor_sku: input.vendor_sku?.trim() || null,
      description_snapshot: descriptionSnapshot,
      unit: input.unit?.trim() || catalogItem?.default_unit || null,
      unit_price: input.unit_price ?? null,
      lead_days: input.lead_days ?? null,
      notes: input.notes?.trim() || null,
      sort_order: nextSortOrder,
      is_active: input.is_active ?? true,
    })
    .select(PRICING_ROW_COLS)
    .single()

  if (error) throw error
  return data as PricingRow
}

export async function updatePricingRow(
  supabase: DbClient,
  id: string,
  patch: UpdatePricingRowPatch
): Promise<PricingRow> {
  const payload = {
    ...patch,
    vendor_sku:
      typeof patch.vendor_sku === 'string' ? patch.vendor_sku.trim() || null : patch.vendor_sku,
    description_snapshot:
      typeof patch.description_snapshot === 'string'
        ? patch.description_snapshot.trim()
        : patch.description_snapshot,
    unit: typeof patch.unit === 'string' ? patch.unit.trim() || null : patch.unit,
    notes: typeof patch.notes === 'string' ? patch.notes.trim() || null : patch.notes,
  }

  const { data, error } = await supabase
    .from('pricing_rows')
    .update(payload)
    .eq('id', id)
    .select(PRICING_ROW_COLS)
    .single()

  if (error) throw error
  return data as PricingRow
}

export async function reorderPricingRows(
  supabase: DbClient,
  input: ReorderPricingRowsInput
): Promise<void> {
  for (let index = 0; index < input.ordered_row_ids.length; index += 1) {
    const rowId = input.ordered_row_ids[index]
    const { error } = await supabase
      .from('pricing_rows')
      .update({ sort_order: index })
      .eq('id', rowId)
      .eq('pricing_header_id', input.pricing_header_id)

    if (error) throw error
  }
}
