import type {
  CatalogItem,
  CreateCatalogItemInput,
  CreatePricingHeaderInput,
  CreatePricingRowInput,
  DbClient,
  ListCatalogItemsFilters,
  ListPricingHeadersFilters,
  PricingCompanyOption,
  PricingCostCodeOption,
  PricingHeader,
  PricingRow,
  PricingTradeOption,
  ReorderPricingRowsInput,
  UpdateCatalogItemPatch,
  UpdatePricingHeaderPatch,
  UpdatePricingRowPatch,
} from './pricing-sources-types'

const CATALOG_ITEM_COLS =
  'id, catalog_sku, title, description, trade_id, cost_code_id, default_unit, is_active, created_at, updated_at'

const PRICING_HEADER_COLS =
  'id, kind, job_id, company_id, trade_id, cost_code_id, title, revision, status, effective_date, received_at, supersedes_header_id, notes, is_active, created_at, updated_at'

const PRICING_ROW_COLS =
  'id, pricing_header_id, catalog_sku, cost_code_id, source_sku, vendor_sku, description_snapshot, unit, unit_price, lead_days, notes, sort_order, is_active, created_at, updated_at'

async function generateCatalogSku(
  supabase: DbClient,
  costCodeId: string,
  title: string
): Promise<string> {
  const { data, error } = await supabase.rpc('generate_catalog_sku', {
    p_cost_code_id: costCodeId,
    p_title: title,
  })
  if (error) throw error
  return String(data)
}

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

async function derivePricingHeaderTitle(
  supabase: DbClient,
  input: CreatePricingHeaderInput
): Promise<string> {
  const [companyResult, tradeResult, costCodeResult, jobResult] = await Promise.all([
    supabase
      .from('companies')
      .select('company_name, name')
      .eq('id', input.company_id)
      .single(),
    supabase.from('trades').select('name').eq('id', input.trade_id).single(),
    supabase
      .from('cost_codes')
      .select('cost_code, title')
      .eq('id', input.cost_code_id)
      .single(),
    input.kind === 'bid' && input.job_id
      ? supabase
          .from('jobs')
          .select('job_name, project_address')
          .eq('id', input.job_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (companyResult.error) throw companyResult.error
  if (tradeResult.error) throw tradeResult.error
  if (costCodeResult.error) throw costCodeResult.error
  if (jobResult && 'error' in jobResult && jobResult.error) throw jobResult.error

  const companyLabel = String(
    companyResult.data.company_name ?? companyResult.data.name ?? 'Company'
  ).trim()
  const tradeLabel = String(tradeResult.data.name ?? 'Trade').trim()
  const costCodeLabel = String(costCodeResult.data.cost_code ?? 'Cost Code').trim()

  if (input.kind === 'bid') {
    const jobLabel = String(
      jobResult && 'data' in jobResult
        ? jobResult.data?.job_name ?? jobResult.data?.project_address ?? 'Job'
        : 'Job'
    ).trim()
    return `${jobLabel} - ${companyLabel} - ${tradeLabel} - ${costCodeLabel}`
  }

  return `${companyLabel} - ${tradeLabel} - ${costCodeLabel}`
}

export async function fetchPricingCompanies(
  supabase: DbClient
): Promise<PricingCompanyOption[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('id, company_name, name, is_active')
    .eq('is_active', true)
    .order('company_name', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    company_name: String(row.company_name ?? row.name ?? 'Unnamed Company'),
    is_active: row.is_active === true,
  }))
}

export async function fetchPricingTrades(
  supabase: DbClient
): Promise<PricingTradeOption[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('id, name, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []) as PricingTradeOption[]
}

export async function fetchPricingCostCodes(
  supabase: DbClient,
  filters: Partial<Pick<ListCatalogItemsFilters, 'trade_id' | 'is_active'>> = {}
): Promise<PricingCostCodeOption[]> {
  let query = supabase
    .from('cost_codes')
    .select('id, trade_id, cost_code, title, description, sort_order, is_active')
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  if (filters.trade_id) query = query.eq('trade_id', filters.trade_id)
  if (typeof filters.is_active === 'boolean') query = query.eq('is_active', filters.is_active)
  else query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as PricingCostCodeOption[]
}

export async function listCatalogItems(
  supabase: DbClient,
  filters: ListCatalogItemsFilters = {}
): Promise<CatalogItem[]> {
  let query = supabase.from('catalog_items').select(CATALOG_ITEM_COLS)

  if (filters.trade_id) query = query.eq('trade_id', filters.trade_id)
  if (filters.cost_code_id) query = query.eq('cost_code_id', filters.cost_code_id)
  if (typeof filters.is_active === 'boolean') query = query.eq('is_active', filters.is_active)
  if (filters.search?.trim()) {
    const escaped = filters.search.trim().replace(/,/g, ' ')
    query = query.or(
      `catalog_sku.ilike.%${escaped}%,title.ilike.%${escaped}%,description.ilike.%${escaped}%`
    )
  }

  query = query.order('title', { ascending: true })

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as CatalogItem[]
}

export async function getCatalogItemBySku(
  supabase: DbClient,
  catalogSku: string
): Promise<CatalogItem | null> {
  const { data, error } = await supabase
    .from('catalog_items')
    .select(CATALOG_ITEM_COLS)
    .eq('catalog_sku', catalogSku)
    .maybeSingle()

  if (error) throw error
  return (data as CatalogItem | null) ?? null
}

export async function createCatalogItem(
  supabase: DbClient,
  input: CreateCatalogItemInput
): Promise<CatalogItem> {
  const catalogSku = await generateCatalogSku(supabase, input.cost_code_id, input.title)

  const { data, error } = await supabase
    .from('catalog_items')
    .insert({
      catalog_sku: catalogSku,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      trade_id: input.trade_id,
      cost_code_id: input.cost_code_id,
      default_unit: input.default_unit?.trim() || null,
      is_active: input.is_active ?? true,
    })
    .select(CATALOG_ITEM_COLS)
    .single()

  if (error) throw error
  return data as CatalogItem
}

export async function updateCatalogItem(
  supabase: DbClient,
  id: string,
  patch: UpdateCatalogItemPatch
): Promise<CatalogItem> {
  const payload = {
    ...patch,
    description:
      typeof patch.description === 'string' ? patch.description.trim() || null : patch.description,
    default_unit:
      typeof patch.default_unit === 'string'
        ? patch.default_unit.trim() || null
        : patch.default_unit,
  }

  const { data, error } = await supabase
    .from('catalog_items')
    .update(payload)
    .eq('id', id)
    .select(CATALOG_ITEM_COLS)
    .single()

  if (error) throw error
  return data as CatalogItem
}

export async function listPricingHeaders(
  supabase: DbClient,
  filters: ListPricingHeadersFilters = {}
): Promise<PricingHeader[]> {
  let query = supabase.from('pricing_headers').select(PRICING_HEADER_COLS)

  if (filters.kind) query = query.eq('kind', filters.kind)
  if (filters.job_id) query = query.eq('job_id', filters.job_id)
  if (filters.company_id) query = query.eq('company_id', filters.company_id)
  if (filters.trade_id) query = query.eq('trade_id', filters.trade_id)
  if (filters.cost_code_id) query = query.eq('cost_code_id', filters.cost_code_id)
  if (typeof filters.is_active === 'boolean') query = query.eq('is_active', filters.is_active)

  query = query.order('updated_at', { ascending: false }).order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as PricingHeader[]
}

export async function getPricingHeader(
  supabase: DbClient,
  id: string
): Promise<PricingHeader | null> {
  const { data, error } = await supabase
    .from('pricing_headers')
    .select(PRICING_HEADER_COLS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return (data as PricingHeader | null) ?? null
}

export async function createPricingHeader(
  supabase: DbClient,
  input: CreatePricingHeaderInput
): Promise<PricingHeader> {
  if (input.kind === 'bid' && !input.job_id) {
    throw new Error('job_id is required when kind is bid')
  }
  if (input.kind === 'price_sheet' && input.job_id) {
    throw new Error('job_id must be null when kind is price_sheet')
  }

  const title = input.title?.trim() || (await derivePricingHeaderTitle(supabase, input))

  const { data, error } = await supabase
    .from('pricing_headers')
    .insert({
      kind: input.kind,
      job_id: input.kind === 'bid' ? input.job_id ?? null : null,
      company_id: input.company_id,
      trade_id: input.trade_id,
      cost_code_id: input.cost_code_id,
      title,
      status: input.status,
      effective_date: input.effective_date ?? null,
      received_at: input.received_at ?? null,
      notes: input.notes?.trim() || null,
      is_active: input.is_active ?? true,
    })
    .select(PRICING_HEADER_COLS)
    .single()

  if (error) throw error
  return data as PricingHeader
}

export async function updatePricingHeader(
  supabase: DbClient,
  id: string,
  patch: UpdatePricingHeaderPatch
): Promise<PricingHeader> {
  const payload = {
    ...patch,
    title: typeof patch.title === 'string' ? patch.title.trim() : patch.title,
    notes: typeof patch.notes === 'string' ? patch.notes.trim() || null : patch.notes,
  }

  const { data, error } = await supabase
    .from('pricing_headers')
    .update(payload)
    .eq('id', id)
    .select(PRICING_HEADER_COLS)
    .single()

  if (error) throw error
  return data as PricingHeader
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
