// Structure layer for proposal builder. Pure functions — no React, no browser APIs.

import type { JobWorksheetRow } from '@/components/patterns/estimate/JobWorksheetTableAdapter'
import { rowTotal } from '@/components/patterns/estimate/_worksheetFormatters'
import { resolveUnitCost } from '@/components/patterns/estimate/_lib/unitCostResolver'
import type { ProposalLineItem, ProposalSection, ProposalSummary } from './proposalSummary'

// ProposalStatus models proposal_structures.proposal_status — the document workflow state.
// It is intentionally narrower than EstimateStatus:
//
//   'rejected' is absent by design. Rejection is an estimate lifecycle event, not a
//   document state change. After rejectProposal, proposal_structures.proposal_status
//   stays at 'sent' — the proposal document was sent; the business outcome (rejection)
//   is recorded in estimates.status. This is correct behavior, not a gap. Any code
//   that needs to know whether a proposal was rejected must read estimates.status.
//
//   'staged' is absent by design. Staging is an estimate transition; proposal_structures
//   has no staged concept.
//
// estimates.status is always the authoritative lifecycle source.
export type ProposalStatus = 'draft' | 'sent' | 'signed' | 'voided'

export type ProposalStructureSection = {
  id: string
  title: string | null        // null = use first source row's description
  source_row_ids: string[]    // top-level worksheet row IDs grouped into this section
  visible: boolean
}

export type ProposalStructureJson = {
  sections: ProposalStructureSection[]
}

// Reconcile a saved structure with current worksheet rows (call only when NOT locked).
// Preserves saved section order, visibility, and title overrides.
// Appends newly discovered top-level rows as visible sections at the end.
// Rows that have been deleted from the worksheet are left in-place (applyStructure skips them).
export function reconcileStructure(
  saved: ProposalStructureJson,
  rows: JobWorksheetRow[],
): ProposalStructureJson {
  const rowsById = new Map<string, JobWorksheetRow>()
  for (const row of rows) rowsById.set(row.id, row)

  const topLevel = rows
    .filter((row) => !row.parent_id || !rowsById.has(row.parent_id))
    .sort((a, b) => a.sort_order - b.sort_order)

  const knownIds = new Set<string>()
  for (const s of saved.sections) {
    for (const rowId of s.source_row_ids) knownIds.add(rowId)
  }

  const newSections: ProposalStructureSection[] = topLevel
    .filter((row) => !knownIds.has(row.id))
    .map((row) => ({
      id: crypto.randomUUID(),
      title: null,
      source_row_ids: [row.id],
      visible: true,
    }))

  if (newSections.length === 0) return saved
  return { sections: [...saved.sections, ...newSections] }
}

// Derive a default structure from worksheet rows: each top-level row becomes one section.
export function deriveDefaultStructure(rows: JobWorksheetRow[]): ProposalStructureJson {
  const rowsById = new Map<string, JobWorksheetRow>()
  for (const row of rows) rowsById.set(row.id, row)

  const topLevel = rows
    .filter((row) => !row.parent_id || !rowsById.has(row.parent_id))
    .sort((a, b) => a.sort_order - b.sort_order)

  return {
    sections: topLevel.map((row) => ({
      id: crypto.randomUUID(),
      title: null,
      source_row_ids: [row.id],
      visible: true,
    })),
  }
}

// Apply a saved (or derived) structure to worksheet rows, producing the display-ready summary.
// Rows referenced by source_row_ids that no longer exist are silently skipped.
// Hidden sections are excluded. Sections with no resolvable source rows are excluded.
export function applyStructure(
  structure: ProposalStructureJson,
  rows: JobWorksheetRow[],
): ProposalSummary {
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
        unit_price: resolveUnitCost(child),
        location: child.location,
        notes: child.notes,
        lineTotal: rowTotal(child),
      })
      result.push(...flattenDescendants(child.id, depth + 1))
    }
    return result
  }

  function leafTotal(row: JobWorksheetRow): number {
    const children = childrenByParent.get(row.id) ?? []
    if (children.length === 0) return rowTotal(row)
    return children.reduce((sum, child) => sum + leafTotal(child), 0)
  }

  const sections: ProposalSection[] = []

  for (const s of structure.sections) {
    if (!s.visible) continue

    const sourceRows = s.source_row_ids
      .map((rowId) => rowsById.get(rowId))
      .filter((r): r is JobWorksheetRow => r !== undefined)

    if (sourceRows.length === 0) continue

    const firstRow = sourceRows[0]
    const title = s.title?.trim() || firstRow.description

    // Single source row: section header is the row, items are its descendants.
    // Multiple source rows: each source row appears as a depth-1 item with its subtree.
    const items: ProposalLineItem[] = []
    let subtotal = 0

    if (sourceRows.length === 1) {
      items.push(...flattenDescendants(firstRow.id, 1))
      subtotal = leafTotal(firstRow)
    } else {
      for (const sourceRow of sourceRows) {
        items.push({
          id: sourceRow.id,
          depth: 1,
          row_kind: sourceRow.row_kind,
          description: sourceRow.description,
          quantity: sourceRow.quantity,
          unit: sourceRow.unit,
          unit_price: resolveUnitCost(sourceRow),
          location: sourceRow.location,
          notes: sourceRow.notes,
          lineTotal: rowTotal(sourceRow),
        })
        items.push(...flattenDescendants(sourceRow.id, 2))
        subtotal += leafTotal(sourceRow)
      }
    }

    sections.push({
      id: s.id,
      description: title,
      row_kind: firstRow.row_kind,
      location: firstRow.location,
      notes: firstRow.notes,
      items,
      subtotal,
    })
  }

  const grandTotal = sections.reduce((sum, s) => sum + s.subtotal, 0)
  return { sections, grandTotal }
}
