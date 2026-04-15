import type { TakeoffItem } from './takeoffTypes'
import { getExtendedCost } from './takeoffUtils'

export function matchesTextFilter(item: TakeoffItem, query: string) {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return true

  const haystack = [
    item.trade,
    item.cost_code,
    item.description,
    item.unit,
    item.notes,
    item.qty?.toString(),
    item.unit_cost?.toString(),
    item.extended_cost?.toString(),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(trimmed)
}

export function buildGroupedItems(items: TakeoffItem[]) {
  const groups = new Map<string, TakeoffItem[]>()

  items.forEach((item) => {
    const key = item.trade?.trim() || 'Unassigned'
    const existing = groups.get(key) ?? []
    existing.push(item)
    groups.set(key, existing)
  })

  return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
}

export function getGroupSubtotal(items: TakeoffItem[]) {
  return items.reduce((sum, item) => sum + (getExtendedCost(item) ?? 0), 0)
}
