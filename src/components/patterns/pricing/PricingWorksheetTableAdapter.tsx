'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useMemo } from 'react'
import { EditableDataTable } from '@/components/data-display/EditableDataTable'
import { useWorksheetVirtualization } from '@/components/data-display/worksheet/useWorksheetVirtualization'
import { useWorksheetInteraction } from '@/components/data-display/worksheet/useWorksheetInteraction'
import type { PricingRow } from '@/lib/pricing/types'
import { getPricingWorksheetColumns, type PricingWorksheetEditableCellKey } from './_lib/pricingWorksheetColumns'

// Pricing-local column order — drives Tab/Enter/Arrow navigation contract.
const editableCellOrder: readonly PricingWorksheetEditableCellKey[] = [
  'description_snapshot',
  'vendor_sku',
  'quantity',
  'unit',
  'unit_price',
  'lead_days',
  'is_active',
  'notes',
]

const VIRTUAL_ROW_HEIGHT = 70
const VIRTUAL_OVERSCAN = 8
const VIRTUAL_MAX_BODY_HEIGHT = 560
const VIRTUAL_THRESHOLD = 20

// Pricing-local field accessor — maps PricingRow fields to editable cell values.
function getEditableCellValue(row: PricingRow, field: PricingWorksheetEditableCellKey): string | boolean {
  switch (field) {
    case 'description_snapshot': return row.description_snapshot
    case 'vendor_sku': return row.vendor_sku ?? ''
    case 'quantity': return row.quantity == null ? '' : String(row.quantity)
    case 'unit': return row.unit ?? ''
    case 'unit_price': return row.unit_price == null ? '' : String(row.unit_price)
    case 'lead_days': return row.lead_days == null ? '' : String(row.lead_days)
    case 'notes': return row.notes ?? ''
    case 'is_active': return row.is_active
  }
}

type ActiveCell = { rowId: string; field: PricingWorksheetEditableCellKey }
type CellDraftValue = string | boolean | null

export function PricingWorksheetTableAdapter({
  rows,
  rowSaveState,
  activeCell,
  activeDraft,
  setActiveCell,
  setActiveDraft,
  commitCellValue,
  handleUndo,
  onCreateRow,
  canManage,
  costCodeMap,
}: {
  rows: PricingRow[]
  rowSaveState: Record<string, 'idle' | 'dirty' | 'saving' | 'error'>
  activeCell: ActiveCell | null
  activeDraft: CellDraftValue
  setActiveCell: Dispatch<SetStateAction<ActiveCell | null>>
  setActiveDraft: Dispatch<SetStateAction<CellDraftValue>>
  commitCellValue: (rowId: string, field: PricingWorksheetEditableCellKey, value: string | boolean) => void
  handleUndo: () => void
  onCreateRow: () => void | Promise<unknown>
  canManage: boolean
  costCodeMap: Map<string, string>
}) {
  function getRowStatusLabel(rowId: string) {
    const state = rowSaveState[rowId] ?? 'idle'
    if (state === 'saving') return { text: 'Saving…', tone: 'default' as const }
    if (state === 'dirty') return { text: 'Queued', tone: 'warning' as const }
    if (state === 'error') return { text: 'Failed', tone: 'danger' as const }
    return { text: 'Ready', tone: 'active' as const }
  }

  const virt = useWorksheetVirtualization({
    rows,
    rowHeight: VIRTUAL_ROW_HEIGHT,
    overscan: VIRTUAL_OVERSCAN,
    threshold: VIRTUAL_THRESHOLD,
    maxBodyHeight: VIRTUAL_MAX_BODY_HEIGHT,
  })

  const interaction = useWorksheetInteraction<PricingRow, PricingWorksheetEditableCellKey>({
    rows,
    getRowId: (row) => row.id,
    cellOrder: editableCellOrder,
    activeCell,
    onActiveCellChange: (cell) => setActiveCell(cell),
    activeDraft,
    onActiveDraftChange: (draft) => setActiveDraft(draft),
    getCellValue: getEditableCellValue,
    commitCellValue,
    handleUndo,
    onCreateRow,
    scrollContainerRef: virt.scrollContainerRef,
    shouldVirtualize: virt.shouldVirtualize,
    tableViewportHeight: virt.tableViewportHeight,
    onTableScrollTopChange: virt.setTableScrollTop,
    rowHeight: VIRTUAL_ROW_HEIGHT,
    tableScrollTop: virt.tableScrollTop,
  })

  const columns = useMemo(
    () => getPricingWorksheetColumns({ costCodeMap, getRowStatusLabel }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [costCodeMap, rowSaveState]
  )

  return (
    <EditableDataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      canManage={canManage}
      rowHeight={VIRTUAL_ROW_HEIGHT}
      shouldVirtualize={virt.shouldVirtualize}
      visibleRange={virt.visibleRange}
      scrollContainerRef={virt.scrollContainerRef}
      cellRefs={interaction.cellRefs}
      activeCell={activeCell}
      activeDraft={activeDraft ?? null}
      onTableScrollTopChange={virt.setTableScrollTop}
      onTextCellFocus={interaction.handleTextCellFocus}
      onTextCellBlur={interaction.handleTextCellBlur}
      onTextCellKeyDown={interaction.handleTextCellKeyDown}
      onTextCellDraftChange={(value) => setActiveDraft(value)}
      onCheckboxFocus={interaction.handleCheckboxFocus}
      onCheckboxBlur={interaction.handleCheckboxBlur}
      onCheckboxKeyDown={interaction.handleCheckboxKeyDown}
      onCheckboxCommit={interaction.handleCheckboxCommit}
      getRenderedCellValue={interaction.getRenderedCellValue}
    />
  )
}
