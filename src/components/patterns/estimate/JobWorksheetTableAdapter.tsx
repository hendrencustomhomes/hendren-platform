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

export type JobWorksheetCreateRowOptions = {
  sourceRowId?: string
  asChild?: boolean
}

const editableCellOrder: readonly JobWorksheetEditableCellKey[] = [
  'description',
  'quantity',
  'unit_price',
  'unit',
  'location',
  'notes',
]

const unitOptions = ['flat', 'ea', 'sqft', 'lnft', 'cuft'] as const
const VIRTUAL_ROW_HEIGHT = 64
const VIRTUAL_OVERSCAN = 8
const VIRTUAL_MAX_BODY_HEIGHT = 560
const VIRTUAL_THRESHOLD = 20

function toCellString(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return ''
  return String(value)
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

function getWorksheetCellValue(row: JobWorksheetRow, field: JobWorksheetEditableCellKey): string {
  switch (field) {
    case 'description':
      return row.description
    case 'quantity':
      return toCellString(row.quantity)
    case 'unit_price':
      return toCellString(row.unit_price)
    case 'unit':
      return row.unit ?? 'ea'
    case 'location':
      return row.location ?? ''
    case 'notes':
      return row.notes ?? ''
  }
}

function getColumns(
  rowsById: Map<string, JobWorksheetRow>,
  onDeleteRow: (id: string) => void,
  onUnitChange: (rowId: string, value: string) => void
): EditableDataTableColumn<JobWorksheetRow>[] {
  return [
    {
      key: 'description',
      label: 'Item',
      kind: 'text',
      width: '300px',
      getValue: (row) => row.description,
      formatEditableValue: (value, row, isEditing) => {
        if (isEditing) return String(value ?? '')
        return String(value ?? '')
      },
      renderStaticCell: (row) => (
        <div style={{ padding: '8px', paddingLeft: 8 + getDepth(row, rowsById) * 16, fontSize: '13px' }}>
          {row.description}
        </div>
      ),
    },
    {
      key: 'quantity',
      label: 'Qty',
      kind: 'text',
      width: '90px',
      inputMode: 'decimal',
      getValue: (row) => toCellString(row.quantity),
    },
    {
      key: 'unit_price',
      label: 'Unit Price',
      kind: 'text',
      width: '120px',
      inputMode: 'decimal',
      getValue: (row) => toCellString(row.unit_price),
    },
    {
      key: 'unit',
      label: 'Unit',
      kind: 'static',
      width: '90px',
      getValue: (row) => row.unit ?? 'ea',
      renderStaticCell: (row) => (
        <select
          value={row.unit ?? 'ea'}
          onChange={(event) => onUnitChange(row.id, event.currentTarget.value)}
          style={{
            width: '100%',
            height: '100%',
            minHeight: '34px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            fontSize: '13px',
            padding: '6px 8px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        >
          {unitOptions.map((unit) => (
            <option key={unit} value={unit}>{unit}</option>
          ))}
        </select>
      ),
    },
    {
      key: 'total_price',
      label: 'Total',
      kind: 'static',
      width: '120px',
      getValue: (row) => toCellString(row.total_price),
    },
    {
      key: 'location',
      label: 'Location',
      kind: 'text',
      width: '140px',
      getValue: (row) => row.location ?? '',
    },
    {
      key: 'notes',
      label: 'Notes',
      kind: 'text',
      width: '200px',
      getValue: (row) => row.notes ?? '',
    },
    {
      key: 'actions',
      label: '',
      kind: 'static',
      width: '50px',
      getValue: () => '',
      renderStaticCell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <button
            type="button"
            aria-label="Delete row"
            onClick={() => onDeleteRow(row.id)}
            style={{
              color: '#dc2626',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '16px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
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

export function JobWorksheetTableAdapter({
  rows,
  activeCell,
  activeDraft,
  setActiveCell,
  setActiveDraft,
  commitCellValue,
  createDraftRowAfter,
  deleteRow,
  handleUndo,
}: Props) {
  const rowsById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])
  const columns = useMemo(
    () => getColumns(rowsById, deleteRow, (rowId, value) => commitCellValue(rowId, 'unit', value)),
    [rowsById, deleteRow, commitCellValue]
  )

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
    getCellValue: getWorksheetCellValue,
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
      minWidth="1070px"
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
