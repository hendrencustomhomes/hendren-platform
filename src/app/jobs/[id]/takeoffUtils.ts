import type { CostCodeOption, ScopeContextItem, TakeoffItem, TradeOption } from './takeoffTypes'

export function sortTakeoffItems(items: TakeoffItem[]) {
  return [...items].sort((a, b) => {
    const sortDelta = (a.sort_order ?? 0) - (b.sort_order ?? 0)
    if (sortDelta !== 0) return sortDelta

    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return aTime - bTime
  })
}

export function parsePositiveNumber(value: string, fallback = 1) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

export function parseNumberOrNull(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export function getExtendedCost(item: Pick<TakeoffItem, 'qty' | 'unit_cost' | 'extended_cost'>) {
  if (item.extended_cost !== null && item.extended_cost !== undefined) return item.extended_cost
  if (item.qty === null || item.qty === undefined) return null
  if (item.unit_cost === null || item.unit_cost === undefined) return null
  return item.qty * item.unit_cost
}

export function buildCostCodeLabel(item: CostCodeOption) {
  return `${item.cost_code} - ${item.title}`
}

export function filterCostCodesForTrade(
  costCodes: CostCodeOption[],
  trades: TradeOption[],
  tradeName: string | null | undefined
) {
  if (!tradeName) return costCodes
  const matchingTrade = trades.find((trade) => trade.name === tradeName)
  if (!matchingTrade) return costCodes
  return costCodes.filter((costCode) => !costCode.trade_id || costCode.trade_id === matchingTrade.id)
}

export function getScopeContextItems(scopeItems: ScopeContextItem[]) {
  const priorityTypes = new Set([
    'job_type',
    'project_category',
    'construction_type',
    'bedroom_count',
    'bathroom_count',
    'stories',
    'garage_stalls',
    'basement_type',
    'outdoor_living',
    'special_features',
    'scope_summary',
  ])

  return [...scopeItems]
    .filter((item) => item.scope_type && priorityTypes.has(item.scope_type))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

export function hasIncompleteTakeoffCore(item: TakeoffItem) {
  return !item.trade?.trim() || !item.description?.trim() || !item.unit?.trim() || !item.cost_code?.trim()
}
