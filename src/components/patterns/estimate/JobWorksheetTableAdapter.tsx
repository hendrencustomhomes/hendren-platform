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

const rowKindLabels: Record<JobWorksheetRowKind, string> = {
  line_item: 'Line item',
  assembly: 'Assembly',
  allowance: 'Allowance',
  note: 'Note',
}

const pricingTypeLabels: Record<JobWorksheetPricingType, string> = {
  unit: 'Unit',
  lump_sum: 'Lump sum',
  allowance: 'Allowance',
  manual: 'Manual',
  unpriced: 'Unpriced',
}

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

function getRowStatusLabel(row: JobWorksheetRow) {
  if (row.row_kind === 'assembly') return 'Assembly / group'
  if (row.row_kind === 'allowance') return 'Allowance · no selection yet'
  if (row.row_kind === 'note') return 'Note · non-priced'
  if (row.pricing_type === 'unpriced') return 'Unpriced'
  return 'Ready'
}

function isQuantityEditable(row: JobWorksheetRow) {
  return row.row_kind === 'line_item'
}

function isUnitEditable(row: JobWorksheetRow) {
  return row.row_kind === 'line_item'
}

function getCellValue(row: JobWorksheetRow, field: JobWorksheetCellKey): string | boolean {
  switch (field) {
    case 'row_kind': return rowKindLabels[row.row_kind]
    case 'description': return row.description
    case 'location': return row.location ?? ''
    case 'quantity': return row.row_kind !== 'line_item' ? '' : formatNumber(row.quantity)
    case 'unit': return row.row_kind !== 'line_item' ? '' : row.unit ?? ''
    case 'pricing_type': return pricingTypeLabels[row.pricing_type]
    case 'unit_price': return row.row_kind !== 'line_item' ? '' : formatWorksheetMoney(row.unit_price)
    case 'total_price': return row.row_kind !== 'line_item' ? '' : formatWorksheetMoney(row.total_price)
    case 'source_identity': return row.row_kind !== 'line_item' ? '' : [row.catalog_sku, row.source_sku].filter(Boolean).join(' / ')
    case 'status': return getRowStatusLabel(row)
    case 'notes': return row.notes ?? ''
  }
}

function getColumns(rowsById: Map<string, JobWorksheetRow>): EditableDataTableColumn<JobWorksheetRow>[] {
  return [
    { key: 'row_kind', label: 'Type', kind: 'static', width: '120px', getValue: (row) => rowKindLabels[row.row_kind] },
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
    { key: 'location', label: 'Location', kind: 'text', width: '150px', getValue: (row) => row.location ?? '' },
    { key: 'quantity', label: 'Qty', kind: 'text', width: '100px', inputMode: 'decimal', isEditable: isQuantityEditable, getValue: (row) => row.quantity == null ? '' : String(row.quantity), formatEditableValue: (value, row) => row.row_kind !== 'line_item' ? '' : formatNumber(value as string) },
    { key: 'unit', label: 'Unit', kind: 'text', width: '90px', isEditable: isUnitEditable, getValue: (row) => row.unit ?? '', formatEditableValue: (value, row) => row.row_kind !== 'line_item' ? '' : String(value ?? '') },
    { key: 'pricing_type', label: 'Pricing', kind: 'static', width: '120px', getValue: (row) => pricingTypeLabels[row.pricing_type] },
    { key: 'unit_price', label: 'Unit Price', kind: 'static', width: '120px', getValue: (row) => row.row_kind !== 'line_item' ? '' : formatWorksheetMoney(row.unit_price) },
    { key: 'total_price', label: 'Total', kind: 'static', width: '120px', getValue: (row) => row.row_kind !== 'line_item' ? '' : formatWorksheetMoney(row.total_price) },
    { key: 'source_identity', label: 'Source', kind: 'static', width: '170px', getValue: (row) => row.row_kind !== 'line_item' ? '' : [row.catalog_sku, row.source_sku].filter(Boolean).join(' / ') },
    { key: 'status', label: 'Status', kind: 'static', width: '180px', getValue: getRowStatusLabel },
    { key: 'notes', label: 'Notes', kind: 'text', width: '220px', getValue: (row) => row.notes ?? '' },
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
  handleUndo: () => void
}

export function JobWorksheetTableAdapter({ rows, activeCell, activeDraft, setActiveCell, setActiveDraft, commitCellValue, createDraftRowAfter, handleUndo }: Props) {
  const rowsById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])
  const columns = useMemo(() => getColumns(rowsById), [rowsById])

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
