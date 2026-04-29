'use client'

import { useMemo } from 'react'
import { EditableDataTable } from '@/components/data-display/EditableDataTable'
import type { EditableDataTableColumn } from '@/components/data-display/EditableDataTable'
import { useWorksheetInteraction } from '@/components/data-display/worksheet/useWorksheetInteraction'
import { useWorksheetVirtualization } from '@/components/data-display/worksheet/useWorksheetVirtualization'
import type { WorksheetActiveCell, WorksheetCellDraftValue } from '@/components/data-display/worksheet/worksheetTypes'

export type JobWorksheetRow = {
  id: string
  parent_id: string | null
  sort_order: number
  description: string
  location: string | null
  notes: string | null
  quantity: number | string | null
  unit: string | null
  unit_price: number | string | null
  total_price: number | string | null
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

function getColumns(rowsById: Map<string, JobWorksheetRow>, onDeleteRow: (id: string) => void): EditableDataTableColumn<JobWorksheetRow>[] {
  return [
    {
      key: 'description',
      label: 'Item',
      kind: 'text',
      width: '300px',
      getValue: (row) => row.description,
      formatEditableValue: (value, row) => String(value ?? ''),
      renderStaticCell: (row) => (
        <div style={{ paddingLeft: getDepth(row, rowsById) * 16 }}>
          {row.description}
        </div>
      ),
    },
    { key: 'quantity', label: 'Qty', kind: 'text', width: '90px', getValue: (row) => row.quantity ?? '' },
    { key: 'unit_price', label: 'Unit Price', kind: 'text', width: '120px', getValue: (row) => row.unit_price ?? '' },
    {
      key: 'unit',
      label: 'Unit',
      kind: 'select',
      width: '90px',
      getValue: (row) => row.unit ?? 'ea',
      options: ['flat','ea','sqft','lnft','cuft'],
    },
    { key: 'total_price', label: 'Total', kind: 'static', width: '120px', getValue: (row) => row.total_price ?? '' },
    { key: 'location', label: 'Location', kind: 'text', width: '140px', getValue: (row) => row.location ?? '' },
    { key: 'notes', label: 'Notes', kind: 'text', width: '200px', getValue: (row) => row.notes ?? '' },
    {
      key: 'actions',
      label: '',
      kind: 'static',
      width: '50px',
      renderStaticCell: (row) => (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => onDeleteRow(row.id)}
            style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      ),
    },
  ]
}

export function JobWorksheetTableAdapter({ rows, activeCell, activeDraft, setActiveCell, setActiveDraft, commitCellValue, createDraftRowAfter, deleteRow, handleUndo }: any) {
  const rowsById = useMemo(() => new Map(rows.map((r: any) => [r.id, r])), [rows])
  const columns = useMemo(() => getColumns(rowsById, deleteRow), [rowsById, deleteRow])

  const virt = useWorksheetVirtualization({ rows, rowHeight: 64, overscan: 8, threshold: 20, maxBodyHeight: 560 })

  const interaction = useWorksheetInteraction({
    rows,
    getRowId: (r: any) => r.id,
    cellOrder: editableCellOrder,
    activeCell,
    onActiveCellChange: setActiveCell,
    activeDraft,
    onActiveDraftChange: setActiveDraft,
    getCellValue: (row: any, field: any) => row[field],
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
      onTextCellDraftChange={setActiveDraft}
      onCheckboxFocus={interaction.handleCheckboxFocus}
      onCheckboxBlur={interaction.handleCheckboxBlur}
      onCheckboxKeyDown={interaction.handleCheckboxKeyDown}
      onCheckboxCommit={interaction.handleCheckboxCommit}
      getRenderedCellValue={interaction.getRenderedCellValue}
    />
  )
}
