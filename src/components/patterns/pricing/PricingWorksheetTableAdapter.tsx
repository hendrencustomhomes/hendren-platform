'use client'

import type { Dispatch, KeyboardEvent as ReactKeyboardEvent, MutableRefObject, SetStateAction } from 'react'
import { useMemo, useRef } from 'react'
import { EditableDataTable } from '@/components/data-display/EditableDataTable'
import type { PricingRow } from '@/lib/pricing/types'
import { getPricingWorksheetColumns, type PricingWorksheetEditableCellKey } from './_lib/pricingWorksheetColumns'

const editableCellOrder: PricingWorksheetEditableCellKey[] = [
  'description_snapshot',
  'vendor_sku',
  'unit',
  'unit_price',
  'lead_days',
  'is_active',
  'notes',
]

type ActiveCell = {
  rowId: string
  field: PricingWorksheetEditableCellKey
}

type CellDraftValue = string | boolean | null

function getCellDomKey(rowId: string, field: string) {
  return `${rowId}:${field}`
}

function isFullySelected(element: HTMLInputElement | HTMLTextAreaElement) {
  const valueLength = element.value.length
  return (element.selectionStart ?? 0) === 0 && (element.selectionEnd ?? 0) === valueLength
}

function getEditableCellValue(row: PricingRow, field: PricingWorksheetEditableCellKey): string | boolean {
  switch (field) {
    case 'description_snapshot':
      return row.description_snapshot
    case 'vendor_sku':
      return row.vendor_sku ?? ''
    case 'unit':
      return row.unit ?? ''
    case 'unit_price':
      return row.unit_price == null ? '' : String(row.unit_price)
    case 'lead_days':
      return row.lead_days == null ? '' : String(row.lead_days)
    case 'notes':
      return row.notes ?? ''
    case 'is_active':
      return row.is_active
  }
}

export function PricingWorksheetTableAdapter({
  rows,
  rowSaveState,
  activeCell,
  activeDraft,
  setActiveCell,
  setActiveDraft,
  commitCellValue,
  handleUndo,
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
  canManage: boolean
  costCodeMap: Map<string, string>
}) {
  const cellRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  function getRowStatusLabel(rowId: string) {
    const state = rowSaveState[rowId] ?? 'idle'
    if (state === 'saving') return { text: 'Saving…', tone: 'default' as const }
    if (state === 'dirty') return { text: 'Queued', tone: 'warning' as const }
    if (state === 'error') return { text: 'Failed', tone: 'danger' as const }
    return { text: 'Ready', tone: 'active' as const }
  }

  const columns = useMemo(
    () => getPricingWorksheetColumns({ costCodeMap, getRowStatusLabel }),
    [costCodeMap, rowSaveState]
  )

  function focusCell(rowId: string, field: PricingWorksheetEditableCellKey) {
    const element = cellRefs.current[getCellDomKey(rowId, field)]
    if (!element) return
    window.requestAnimationFrame(() => {
      element.focus()
      if (element instanceof HTMLInputElement && element.type !== 'checkbox') element.select()
      if (element instanceof HTMLTextAreaElement) element.select()
    })
  }

  function getNeighborCell(rowId: string, field: PricingWorksheetEditableCellKey, mode: 'left' | 'right' | 'up' | 'down') {
    const rowIndex = rows.findIndex((row) => row.id === rowId)
    const fieldIndex = editableCellOrder.findIndex((value) => value === field)
    if (rowIndex < 0 || fieldIndex < 0) return null

    if (mode === 'left') {
      if (fieldIndex > 0) return { rowId, field: editableCellOrder[fieldIndex - 1] }
      if (rowIndex > 0) return { rowId: rows[rowIndex - 1].id, field: editableCellOrder[editableCellOrder.length - 1] }
      return null
    }

    if (mode === 'right') {
      if (fieldIndex < editableCellOrder.length - 1) return { rowId, field: editableCellOrder[fieldIndex + 1] }
      if (rowIndex < rows.length - 1) return { rowId: rows[rowIndex + 1].id, field: editableCellOrder[0] }
      return null
    }

    if (mode === 'up') {
      if (rowIndex > 0) return { rowId: rows[rowIndex - 1].id, field }
      return null
    }

    if (rowIndex < rows.length - 1) return { rowId: rows[rowIndex + 1].id, field }
    return null
  }

  function clearActiveCell() {
    setActiveCell(null)
    setActiveDraft(null)
  }

  function commitActiveCell(options?: { move?: 'left' | 'right' | 'up' | 'down' }) {
    if (!activeCell) return
    const row = rows.find((item) => item.id === activeCell.rowId)
    if (!row) {
      clearActiveCell()
      return
    }

    const nextValue = (activeDraft ?? getEditableCellValue(row, activeCell.field)) as string | boolean
    commitCellValue(activeCell.rowId, activeCell.field, nextValue)
    const previousCell = activeCell
    clearActiveCell()

    if (options?.move) {
      const neighbor = getNeighborCell(previousCell.rowId, previousCell.field, options.move)
      if (neighbor) focusCell(neighbor.rowId, neighbor.field)
    }
  }

  function getRenderedCellValue(row: PricingRow, field: string) {
    if (activeCell?.rowId === row.id && activeCell.field === field) return activeDraft ?? ''
    return getEditableCellValue(row, field as PricingWorksheetEditableCellKey)
  }

  function handleTextCellKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    rowId: string,
    field: string
  ) {
    const typedField = field as PricingWorksheetEditableCellKey

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      handleUndo()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      const row = rows.find((item) => item.id === rowId)
      if (!row) return
      setActiveDraft(getEditableCellValue(row, typedField) as string | boolean)
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      commitActiveCell({ move: event.shiftKey ? 'left' : 'right' })
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      commitActiveCell({ move: event.shiftKey ? 'up' : 'down' })
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      commitActiveCell({ move: 'up' })
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      commitActiveCell({ move: 'down' })
      return
    }

    if (event.key === 'ArrowLeft' && isFullySelected(event.currentTarget)) {
      event.preventDefault()
      commitActiveCell({ move: 'left' })
      return
    }

    if (event.key === 'ArrowRight' && isFullySelected(event.currentTarget)) {
      event.preventDefault()
      commitActiveCell({ move: 'right' })
    }
  }

  return (
    <EditableDataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      canManage={canManage}
      shouldVirtualize={false}
      visibleRange={{ rows, startIndex: 0, endIndex: Math.max(0, rows.length - 1), topSpacerHeight: 0, bottomSpacerHeight: 0 }}
      scrollContainerRef={scrollContainerRef as MutableRefObject<HTMLDivElement | null>}
      cellRefs={cellRefs}
      activeCell={activeCell}
      activeDraft={activeDraft ?? null}
      onTableScrollTopChange={((_value: SetStateAction<number>) => {}) as Dispatch<SetStateAction<number>>}
      onTextCellFocus={(rowId, field, element) => {
        const row = rows.find((item) => item.id === rowId)
        if (!row) return
        const typedField = field as PricingWorksheetEditableCellKey
        setActiveCell({ rowId, field: typedField })
        setActiveDraft(getEditableCellValue(row, typedField) as string | boolean)
        element.select()
      }}
      onTextCellBlur={(rowId, field) => {
        if (!activeCell) return
        if (activeCell.rowId !== rowId || activeCell.field !== field) return
        commitActiveCell()
      }}
      onTextCellKeyDown={handleTextCellKeyDown}
      onTextCellDraftChange={(value) => setActiveDraft(value)}
      onCheckboxFocus={(rowId, field) => {
        const row = rows.find((item) => item.id === rowId)
        if (!row) return
        setActiveCell({ rowId, field: field as PricingWorksheetEditableCellKey })
        setActiveDraft(Boolean(getEditableCellValue(row, field as PricingWorksheetEditableCellKey)))
      }}
      onCheckboxBlur={(rowId, field) => {
        if (!activeCell) return
        if (activeCell.rowId !== rowId || activeCell.field !== field) return
        clearActiveCell()
      }}
      onCheckboxKeyDown={(event, rowId, field) => {
        const typedField = field as PricingWorksheetEditableCellKey
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
          event.preventDefault()
          handleUndo()
          return
        }
        if (event.key === 'Tab') {
          event.preventDefault()
          const neighbor = getNeighborCell(rowId, typedField, event.shiftKey ? 'left' : 'right')
          if (neighbor) focusCell(neighbor.rowId, neighbor.field)
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          const neighbor = getNeighborCell(rowId, typedField, event.shiftKey ? 'up' : 'down')
          if (neighbor) focusCell(neighbor.rowId, neighbor.field)
        }
      }}
      onCheckboxCommit={(rowId, field, nextValue) => {
        commitCellValue(rowId, field as PricingWorksheetEditableCellKey, nextValue)
        setActiveDraft(nextValue)
      }}
      getRenderedCellValue={getRenderedCellValue}
    />
  )
}
