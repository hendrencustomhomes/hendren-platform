export type TakeoffItem = {
  id: string
  trade: string
  description: string
  cost_code?: string | null
  qty?: number | null
  unit?: string | null
  unit_cost?: number | null
  extended_cost?: number | null
  notes?: string | null
  sort_order?: number | null
  created_at?: string | null
}

export type TradeOption = {
  id: string
  name: string
  sort_order?: number | null
}

export type CostCodeOption = {
  id: string
  trade_id?: string | null
  cost_code: string
  title: string
  sort_order?: number | null
}

export type ScopeContextItem = {
  id: string
  scope_type?: string | null
  label: string
  value_text?: string | null
  value_number?: number | null
  notes?: string | null
  sort_order?: number | null
}

export type TakeoffEditablePatch = Partial<
  Pick<
    TakeoffItem,
    'trade' | 'description' | 'cost_code' | 'qty' | 'unit' | 'unit_cost' | 'extended_cost' | 'notes'
  >
>

export type TakeoffWorkspaceMode = 'mobile' | 'desktop'
