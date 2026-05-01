// Server-safe proposal summary transformation. No React, no browser APIs.

import type { JobWorksheetRow } from '@/components/patterns/estimate/JobWorksheetTableAdapter'
import { rowTotal } from '@/components/patterns/estimate/_worksheetFormatters'

export type ProposalLineItem = {
  id: string
  depth: number
  row_kind: string
  description: string
  quantity: number | string | null
  unit: string | null
  unit_price: number | string | null
  location: string | null
  notes: string | null
  lineTotal: number
}

export type ProposalSection = {
  id: string
  description: string
  row_kind: string
  location: string | null
  notes: string | null
  items: ProposalLineItem[]
  subtotal: number
}

export type ProposalSummary = {
  sections: ProposalSection[]
  grandTotal: number
}

export function buildProposalSummary(rows: JobWorksheetRow[]): ProposalSummary {
  if (rows.length === 0) return { sections: [], grandTotal: 0 }

  const rowsById = new Map<string, JobWorksheetRow>()
  for (const row of rows) rowsById.set(row.id, row)

  const childrenByParent = new Map<string, JobWorksheetRow[]>()
  for (const row of rows) {
    if (row.parent_id) {
      const list = childrenByParent.get(row.parent_id) ?? []
      list.push(row)
      childrenByParent.set(row.parent_id, list)
    }
  }

  // Top-level: no parent, or parent not found (orphaned rows are promoted to top-level)
  const topLevel = rows
    .filter((row) => !row.parent_id || !rowsById.has(row.parent_id))
    .sort((a, b) => a.sort_order - b.sort_order)

  function flattenDescendants(parentId: string, depth: number): ProposalLineItem[] {
    const children = (childrenByParent.get(parentId) ?? []).sort((a, b) => a.sort_order - b.sort_order)
    const result: ProposalLineItem[] = []
    for (const child of children) {
      result.push({
        id: child.id,
        depth,
        row_kind: child.row_kind,
        description: child.description,
        quantity: child.quantity,
        unit: child.unit,
        unit_price: child.unit_price,
        location: child.location,
        notes: child.notes,
        lineTotal: rowTotal(child),
      })
      result.push(...flattenDescendants(child.id, depth + 1))
    }
    return result
  }

  // Leaf-total: recurse until a row has no children, then use its rowTotal.
  // Rows with children are skipped to avoid double-counting parent + child prices.
  function leafTotal(row: JobWorksheetRow): number {
    const children = childrenByParent.get(row.id) ?? []
    if (children.length === 0) return rowTotal(row)
    return children.reduce((sum, child) => sum + leafTotal(child), 0)
  }

  const sections: ProposalSection[] = topLevel.map((row) => ({
    id: row.id,
    description: row.description,
    row_kind: row.row_kind,
    location: row.location,
    notes: row.notes,
    items: flattenDescendants(row.id, 1),
    subtotal: leafTotal(row),
  }))

  const grandTotal = sections.reduce((sum, s) => sum + s.subtotal, 0)
  return { sections, grandTotal }
}
