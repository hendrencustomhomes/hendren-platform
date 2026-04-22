import type {
  DbClient,
  ListCatalogItemsFilters,
  PricingCompanyOption,
  PricingCostCodeOption,
  PricingTradeOption,
} from './types'

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
