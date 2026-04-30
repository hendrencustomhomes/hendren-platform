'use client'

import { useMemo } from 'react'
import { EditableDataTable } from '@/components/data-display/EditableDataTable'
import type { EditableDataTableColumn } from '@/components/data-display/EditableDataTable'
import { useWorksheetInteraction } from '@/components/data-display/worksheet/useWorksheetInteraction'
import { useWorksheetVirtualization } from '@/components/data-display/worksheet/useWorksheetVirtualization'
import type { WorksheetActiveCell, WorksheetCellDraftValue } from '@/components/data-display/worksheet/worksheetTypes'

export type JobWorksheetRowKind = 'line_item' | 'assembly' | 'note' | 'allowance'
export type JobWorksheetPricingType = 'unit' | 'lump_sum' | 'allowance' | 'manual' | 'unpriced'
export type JobWorksheetScopeStatus = 'included' | 'excluded'

export type JobWorksheetRow = {
  id: string
  parent_id: string | null
  sort_order: number
  row_kind: JobWorksheetRowKind
  description: string
  location: string | null
  notes: string | null
  scope_status: JobWorksheetScopeStatus
  is_upgrade: boolean
  replaces_item_id: string | null
  quantity: number | string | null
  unit: string | null
  pricing_source_row_id: string | null
  pricing_header_id: string | null
  catalog_sku: string | null
  source_sku: string | null
  unit_price: number | string | null
  total_price: number | string | null
  pricing_type: JobWorksheetPricingType
}

export type JobWorksheetEditableCellKey =
  | 'description'
  | 'quantity'
  | 'unit_price'
  | 'unit'
  | 'location'
  | 'notes'

const editableCellOrder: readonly JobWorksheetEditableCellKey[] = [
  'description',
  'quantity',
  'unit_price',
  'unit',
  'location',
  'notes',
]

const unitOptions = ['flat', 'ea', 'sqft', 'lnft', 'cuft'] as const

function getDepth(row: JobWorksheetRow, rowsById: Map<string, JobWorksheetRow>) {
  let depth = 0
  let current = row.parent_id
  while (current) {
    const parent = rowsById.get(current)
    if (!parent) break
    depth++
    current = parent.parent_id
  }
  return depth
}

function currency(val: any, editing: boolean) {
  if (!val) return ''
  const num = Number(val)
  if (isNaN(num)) return val
  return editing ? String(num) : `$${num.toFixed(2)}`
}

function getColumns(rowsById: Map<string, JobWorksheetRow>, onDeleteRow: any, commit: any): EditableDataTableColumn<JobWorksheetRow>[] {
  return [
    {
      key: 'description',
      label: 'Item',
      kind: 'text',
      width: '300px',
      getValue: (row) => row.description,
      getCellPaddingLeft: (row) => 8 + getDepth(row, rowsById) * 16,
    },
    { key: 'quantity', label: 'Qty', kind: 'text', width: '90px', getValue: (row) => String(row.quantity ?? '') },
    {
      key: 'unit_price',
      label: 'Unit Price',
      kind: 'text',
      width: '120px',
      getValue: (row) => String(row.unit_price ?? ''),
      formatEditableValue: (v, r, editing) => currency(v, editing),
    },
    {
      key: 'unit',
      label: 'Unit',
      kind: 'static',
      width: '120px',
      renderStaticCell: (row) => (
        <input list="unit-options" value={row.unit ?? 'ea'} onChange={(e) => commit(row.id, 'unit', e.target.value)} />
      ),
    },
    {
      key: 'total_price',
      label: 'Total',
      kind: 'static',
      width: '120px',
      getValue: (row) => {
        const q = Number(row.quantity)
        const p = Number(row.unit_price)
        if (!q || !p) return ''
        return `$${(q * p).toFixed(2)}`
      },
    },
    { key: 'location', label: 'Location', kind: 'text', width: '140px', getValue: (row) => row.location ?? '' },
    { key: 'notes', label: 'Notes', kind: 'text', width: '200px', getValue: (row) => row.notes ?? '' },
    {
      key: 'actions',
      label: '',
      kind: 'static',
      width: '50px',
      renderStaticCell: (row) => (
        <button onClick={() => onDeleteRow(row.id)} style={{ color: '#dc2626' }}>✕</button>
      ),
    },
  ]
}

export function JobWorksheetTableAdapter({ rows, activeCell, activeDraft, setActiveCell, setActiveDraft, commitCellValue, createDraftRowAfter, deleteRow, handleUndo }: any) {
  const rowsById = useMemo(() => new Map(rows.map((r: any) => [r.id, r])), [rows])
  const columns = useMemo(() => getColumns(rowsById, deleteRow, commitCellValue), [rowsById, deleteRow])

  const virt = useWorksheetVirtualization({ rows, rowHeight: 64, overscan: 8, threshold: 20, maxBodyHeight: 560 })

  const interaction = useWorksheetInteraction({
    rows,
    getRowId: (r: any) => r.id,
    cellOrder: editableCellOrder,
    activeCell,
    onActiveCellChange: setActiveCell,
    activeDraft,
    onActiveDraftChange: setActiveDraft,
    getCellValue: (row: any, field: any) => row[field] ?? '',
    commitCellValue,
    handleUndo,
    onCreateRow: createDraftRowAfter,
    onDeleteRow: deleteRow,
    scrollContainerRef: virt.scrollContainerRef,
    shouldVirtualize: virt.shouldVirtualize,
    tableViewportHeight: virt.tableViewportHeight,
    onTableScrollTopChange: virt.setTableScrollTop,
    rowHeight: 64,
    tableScrollTop: virt.tableScrollTop,
  })

  return (
    <>
      <datalist id="unit-options">
        {unitOptions.map(u => <option key={u} value={u} />)}
      </datalist>
      <EditableDataTable
        columns={columns}
        rows={rows}
        getRowId={(r: any) => r.id}
        canManage
        cellRefs={interaction.cellRefs}
        activeCell={activeCell}
        activeDraft={activeDraft}
        scrollContainerRef={virt.scrollContainerRef}
        shouldVirtualize={virt.shouldVirtualize}
        visibleRange={virt.visibleRange}
        onTableScrollTopChange={virt.setTableScrollTop}
        onTextCellFocus={interaction.handleTextCellFocus}
        onTextCellBlur={interaction.handleTextCellBlur}
        onTextCellKeyDown={interaction.handleTextCellKeyDown}
        onTextCellDraftChange={interaction.handleDraftChange}
        onCheckboxFocus={interaction.handleCheckboxFocus}
        onCheckboxBlur={interaction.handleCheckboxBlur}
        onCheckboxKeyDown={interaction.handleCheckboxKeyDown}
        onCheckboxCommit={interaction.handleCheckboxCommit}
        getRenderedCellValue={interaction.getRenderedCellValue}
      />
    </>
  )
}
