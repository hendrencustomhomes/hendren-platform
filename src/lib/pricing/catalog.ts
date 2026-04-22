import type {
  CatalogItem,
  CreateCatalogItemInput,
  DbClient,
  ListCatalogItemsFilters,
  UpdateCatalogItemPatch,
} from './types'

export async function listCatalogItems(
  supabase: DbClient,
  filters: ListCatalogItemsFilters = {}
): Promise<CatalogItem[]> {
  let query = supabase
    .from('catalog_items')
    .select('*')
    .order('title', { ascending: true })

  if (filters.trade_id) query = query.eq('trade_id', filters.trade_id)
  if (filters.cost_code_id) query = query.eq('cost_code_id', filters.cost_code_id)
  if (typeof filters.is_active === 'boolean') query = query.eq('is_active', filters.is_active)
  if (filters.search) query = query.ilike('title', `%${filters.search}%`)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as CatalogItem[]
}

export async function createCatalogItem(
  supabase: DbClient,
  input: CreateCatalogItemInput
): Promise<CatalogItem> {
  const { data, error } = await supabase
    .from('catalog_items')
    .insert({
      title: input.title,
      description: input.description ?? null,
      trade_id: input.trade_id,
      cost_code_id: input.cost_code_id,
      default_unit: input.default_unit ?? null,
      is_active: input.is_active ?? true,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as CatalogItem
}

export async function updateCatalogItem(
  supabase: DbClient,
  id: string,
  patch: UpdateCatalogItemPatch
): Promise<CatalogItem> {
  const { data, error } = await supabase
    .from('catalog_items')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as CatalogItem
}
