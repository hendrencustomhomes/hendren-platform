import type { TakeoffItem } from './takeoffTypes'
import { getExtendedCost, isAssemblyRow } from './takeoffUtils'

export type TakeoffTreeNode = {
  row: TakeoffItem
  children: TakeoffTreeNode[]
}

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
    item.row_kind,
    item.item_kind,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(trimmed)
}

export function buildTakeoffTree(items: TakeoffItem[]) {
  const nodes = new Map<string, TakeoffTreeNode>()
  const roots: TakeoffTreeNode[] = []

  items.forEach((item) => {
    nodes.set(item.id, { row: item, children: [] })
  })

  items.forEach((item) => {
    const node = nodes.get(item.id)
    if (!node) return

    const parentId = item.parent_id?.trim() || null
    if (parentId && nodes.has(parentId)) {
      nodes.get(parentId)?.children.push(node)
      return
    }

    roots.push(node)
  })

  return roots
}

export function filterTakeoffTree(
  nodes: TakeoffTreeNode[],
  predicate: (item: TakeoffItem) => boolean
): TakeoffTreeNode[] {
  return nodes.flatMap((node) => {
    const filteredChildren = filterTakeoffTree(node.children, predicate)
    if (predicate(node.row) || filteredChildren.length) {
      return [{ ...node, children: filteredChildren }]
    }
    return []
  })
}

export function flattenTakeoffTree(nodes: TakeoffTreeNode[]) {
  const flattened: TakeoffItem[] = []

  function walk(list: TakeoffTreeNode[]) {
    list.forEach((node) => {
      flattened.push(node.row)
      if (node.children.length) walk(node.children)
    })
  }

  walk(nodes)
  return flattened
}

export function getNodeSubtotal(node: TakeoffTreeNode): number {
  if (!isAssemblyRow(node.row)) {
    return getExtendedCost(node.row) ?? 0
  }

  return node.children.reduce((sum, child) => sum + getNodeSubtotal(child), 0)
}

export function getTreeSubtotal(nodes: TakeoffTreeNode[]) {
  return nodes.reduce((sum, node) => sum + getNodeSubtotal(node), 0)
}
