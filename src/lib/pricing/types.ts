import type { SupabaseClient } from '@supabase/supabase-js'

export type DbClient = SupabaseClient

export type PricingHeaderKind = 'price_sheet' | 'bid'

export type CatalogItem = {
  id: string
  catalog_sku: string
  title: string
  description: string | null
  trade_id: string
  cost_code_id: string
  default_unit: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PricingHeader = {
  id: string
  kind: PricingHeaderKind
  job_id: string | null
  company_id: string
  trade_id: string
  cost_code_id: string
  title: string
  revision: number
  status: string
  effective_date: string | null
  received_at: string | null
  supersedes_header_id: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PricingRow = {
  id: string
  pricing_header_id: string
  catalog_sku: string | null
  cost_code_id: string
  source_sku: string
  vendor_sku: string | null
  description_snapshot: string
  quantity: number | null
  uom: string | null
  unit_price: number | null
  lead_days: number | null
  notes: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PricingCompanyOption = {
  id: string
  company_name: string
  is_active: boolean
}

export type PricingTradeOption = {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

export type PricingCostCodeOption = {
  id: string
  trade_id: string | null
  cost_code: string
  title: string
  description: string | null
  sort_order: number
  is_active: boolean
}

export type CreateCatalogItemInput = {
  title: string
  description?: string | null
  trade_id: string
  cost_code_id: string
  default_unit?: string | null
  is_active?: boolean
}

export type UpdateCatalogItemPatch = Partial<{
  title: string
  description: string | null
  trade_id: string
  cost_code_id: string
  default_unit: string | null
  is_active: boolean
}>

export type CreatePricingHeaderInput = {
  kind: PricingHeaderKind
  job_id?: string | null
  company_id: string
  trade_id: string
  cost_code_id: string
  title?: string | null
  status: string
  effective_date?: string | null
  received_at?: string | null
  notes?: string | null
  is_active?: boolean
}

export type UpdatePricingHeaderPatch = Partial<{
  company_id: string
  trade_id: string
  cost_code_id: string
  title: string
  status: string
  effective_date: string | null
  received_at: string | null
  notes: string | null
  is_active: boolean
}>

export type CreatePricingRowInput = {
  pricing_header_id: string
  catalog_sku?: string | null
  vendor_sku?: string | null
  description_snapshot?: string | null
  quantity?: number | null
  uom?: string | null
  unit_price?: number | null
  lead_days?: number | null
  notes?: string | null
  is_active?: boolean
}

export type UpdatePricingRowPatch = Partial<{
  vendor_sku: string | null
  description_snapshot: string
  quantity: number | null
  uom: string | null
  unit_price: number | null
  lead_days: number | null
  notes: string | null
  sort_order: number
  is_active: boolean
}>

export type ListCatalogItemsFilters = Partial<{
  trade_id: string
  cost_code_id: string
  is_active: boolean
  search: string
}>

export type ListPricingHeadersFilters = Partial<{
  kind: PricingHeaderKind
  job_id: string
  company_id: string
  trade_id: string
  cost_code_id: string
  is_active: boolean
}>

export type ReorderPricingRowsInput = {
  pricing_header_id: string
  ordered_row_ids: string[]
}
