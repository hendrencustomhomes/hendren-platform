import type { SupabaseClient } from '@supabase/supabase-js'

export type CostCodeOption = {
  id: string
  cost_code: string
  title: string
  sort_order: number
}

export async function fetchActiveCostCodes(supabase: SupabaseClient): Promise<CostCodeOption[]> {
  const { data, error } = await supabase
    .from('cost_codes')
    .select('id, cost_code, title, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('cost_code', { ascending: true })
  if (error) {
    console.error('fetchActiveCostCodes:', error)
    return []
  }
  return data ?? []
}
