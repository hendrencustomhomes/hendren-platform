import type {
  CatalogItem,
  CreateCatalogItemInput,
  DbClient,
  ListCatalogItemsFilters,
  UpdateCatalogItemPatch,
} from './types'

const CATALOG_ITEM_COLS =
  'id, catalog_sku, title, description, trade_id, cost_code_id, default_unit, is_active, created_at, updated_at'

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
