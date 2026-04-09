import type { SupabaseClient } from '@supabase/supabase-js'

export type TradeOption = {
  id: string
  name: string
  sort_order: number
}

/**
 * Fetch active trades sorted by sort_order then name.
 * Returns [] on error — safe fallback for UI.
 */
export async function fetchActiveTrades(
  supabase: SupabaseClient
): Promise<TradeOption[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('id, name, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('fetchActiveTrades:', error)
    return []
  }

  return data ?? []
}
