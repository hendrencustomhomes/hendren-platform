'use client'

import { useMemo } from 'react'
import { EditableDataTable } from '@/components/data-display/EditableDataTable'
import type { EditableDataTableColumn } from '@/components/data-display/EditableDataTable'
import { useWorksheetInteraction } from '@/components/data-display/worksheet/useWorksheetInteraction'
import { useWorksheetVirtualization } from '@/components/data-display/worksheet/useWorksheetVirtualization'
import type { WorksheetActiveCell, WorksheetCellDraftValue } from '@/components/data-display/worksheet/worksheetTypes'
import { formatMoney } from '@/lib/shared/numbers'

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

export type JobWorksheetEditableCellKey = 'description' | 'location' | 'quantity' | 'unit' | 'notes'

type JobWorksheetCellKey =
  | 'row_kind'
  | 'description'
  | 'location'
  | 'quantity'
  | 'unit'
  | 'pricing_type'
  | 'unit_price'
  | 'total_price'
  | 'source_identity'
  | 'status'
  | 'notes'

export type JobWorksheetCreateRowOptions = {
  sourceRowId?: string
  asChild?: boolean
}

const editableCellOrder: readonly JobWorksheetEditableCellKey[] = [
  'description',
  'location',
  'quantity',
  'unit',
  'notes',
]

const VIRTUAL_ROW_HEIGHT = 64
const VIRTUAL_OVERSCAN = 8
const VIRTUAL_MAX_BODY_HEIGHT = 560
const VIRTUAL_THRESHOLD = 20

function formatNumber(value: number | string | null) {
  if (value === null || value === '') return ''
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return String(value)
  return numericValue.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function normalizeMoneyForDisplay(value: number | string | null) {
  if (value === null || value === '') return null
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue === 0) return null
  return numericValue
}

function formatWorksheetMoney(value: number | string | null) {
  return formatMoney(normalizeMoneyForDisplay(value))
}

function getDepth(row: JobWorksheetRow, rowsById: Map<string, JobWorksheetRow>) {
  let depth = 0
  let currentParentId = row.parent_id
  const seen = new Set<string>()

  while (currentParentId && !seen.has(currentParentId) && depth < 8) {
    seen.add(currentParentId)
    const parent = rowsById.get(currentParentId)
    if (!parent) break
    depth += 1
    currentParentId = parent.parent_id
  }

  return depth
}

function getCellValue(row: JobWorksheetRow, field: JobWorksheetCellKey): string | boolean {
  switch (field) {
    case 'row_kind': return row.row_kind
    case 'description': return row.description
    case 'location': return row.location ?? ''
    case 'quantity': return formatNumber(row.quantity)
    case 'unit': return row.unit ?? ''
    case 'pricing_type': return row.pricing_type
    case 'unit_price': return formatWorksheetMoney(row.unit_price)
    case 'total_price': return formatWorksheetMoney(row.total_price)
    case 'source_identity': return ''
    case 'status': return ''
    case 'notes': return row.notes ?? ''
  }
}

function getColumns(rowsById: Map<string, JobWorksheetRow>, onDeleteRow: (id: string) => void): EditableDataTableColumn<JobWorksheetRow>[] {
  return [
    {
      key: 'description',
      label: 'Description',
      kind: 'text',
      width: '260px',
      getValue: (row) => row.description,
      formatEditableValue: (value, row) => {
        const depth = getDepth(row, rowsById)
        const prefix = depth > 0 ? `${'— '.repeat(depth)}` : ''
        return `${prefix}${String(value ?? '')}`
      },
    },
    {
      key: 'actions',
      label: '',
      kind: 'static',
      width: '60px',
      getValue: () => '',
      renderStaticCell: (_value, row) => (
        <button onClick={() => onDeleteRow(row.id)} style={{ cursor: 'pointer' }}>X</button>
      ),
    },
  ]
}

type Props = {
  rows: JobWorksheetRow[]
  activeCell: WorksheetActiveCell<JobWorksheetEditableCellKey> | null
  activeDraft: WorksheetCellDraftValue
  setActiveCell: (cell: WorksheetActiveCell<JobWorksheetEditableCellKey> | null) => void
  setActiveDraft: (draft: WorksheetCellDraftValue) => void
  commitCellValue: (rowId: string, field: JobWorksheetEditableCellKey, value: string | boolean) => void
  createDraftRowAfter: (options?: JobWorksheetCreateRowOptions) => void
  deleteRow: (rowId: string) => void
  handleUndo: () => void
}

export function JobWorksheetTableAdapter({ rows, activeCell, activeDraft, setActiveCell, setActiveDraft, commitCellValue, createDraftRowAfter, deleteRow, handleUndo }: Props) {
  const rowsById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])
  const columns = useMemo(() => getColumns(rowsById, deleteRow), [rowsById, deleteRow])

  const virt = useWorksheetVirtualization({
    rows,
    rowHeight: VIRTUAL_ROW_HEIGHT,
    overscan: VIRTUAL_OVERSCAN,
    threshold: VIRTUAL_THRESHOLD,
    maxBodyHeight: VIRTUAL_MAX_BODY_HEIGHT,
  })

  const interaction = useWorksheetInteraction<JobWorksheetRow, JobWorksheetEditableCellKey>({
    rows,
    getRowId: (row) => row.id,
    cellOrder: editableCellOrder,
    activeCell,
    onActiveCellChange: setActiveCell,
    activeDraft,
    onActiveDraftChange: setActiveDraft,
    getCellValue,
    commitCellValue,
    handleUndo,
    onCreateRow: createDraftRowAfter,
    onDeleteRow: deleteRow,
    scrollContainerRef: virt.scrollContainerRef,
    shouldVirtualize: virt.shouldVirtualize,
    tableViewportHeight: virt.tableViewportHeight,
    onTableScrollTopChange: virt.setTableScrollTop,
    rowHeight: VIRTUAL_ROW_HEIGHT,
    tableScrollTop: virt.tableScrollTop,
  })

  return (
    <EditableDataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      canManage
      minWidth="1550px"
      rowHeight={VIRTUAL_ROW_HEIGHT}
      shouldVirtualize={virt.shouldVirtualize}
      visibleRange={virt.visibleRange}
      scrollContainerRef={virt.scrollContainerRef}
      cellRefs={interaction.cellRefs}
      activeCell={activeCell}
      activeDraft={activeDraft}
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
