'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { EditableDataTable } from '@/components/data-display/EditableDataTable'
import { getPricingWorksheetColumns, type PricingWorksheetEditableCellKey } from './_lib/pricingWorksheetColumns'
import type { PricingRow } from '@/lib/pricing/types'

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
  activeCell: { rowId: string; field: PricingWorksheetEditableCellKey } | null
  activeDraft: string | boolean | null
  setActiveCell: (v: any) => void
  setActiveDraft: (v: any) => void
  commitCellValue: (rowId: string, field: PricingWorksheetEditableCellKey, value: any) => void
  handleUndo: () => void
  canManage: boolean
  costCodeMap: Map<string, string>
}) {
  const cellRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})

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

  function getRenderedCellValue(row: PricingRow, field: string) {
    if (activeCell?.rowId === row.id && activeCell.field === field) {
      return activeDraft
    }
    return (row as any)[field] ?? ''
  }

  function handleTextCellKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    rowId: string,
    field: string
  ) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      handleUndo()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      commitCellValue(rowId, field as any, activeDraft)
      setActiveCell(null)
      setActiveDraft(null)
    }
  }

  return (
    <EditableDataTable
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      canManage={canManage}
      shouldVirtualize={rows.length > 20}
      visibleRange={{ rows, startIndex: 0, endIndex: rows.length - 1, topSpacerHeight: 0, bottomSpacerHeight: 0 }}
      scrollContainerRef={useRef(null)}
      cellRefs={cellRefs}
      activeCell={activeCell as any}
      activeDraft={activeDraft}
      onTableScrollTopChange={() => {}}
      onTextCellFocus={(rowId, field, el) => {
        setActiveCell({ rowId, field })
        setActiveDraft(el.value)
      }}
      onTextCellBlur={(rowId, field) => {
        commitCellValue(rowId, field as any, activeDraft)
        setActiveCell(null)
        setActiveDraft(null)
      }}
      onTextCellKeyDown={handleTextCellKeyDown}
      onTextCellDraftChange={(v) => setActiveDraft(v)}
      onCheckboxFocus={(rowId, field) => setActiveCell({ rowId, field })}
      onCheckboxBlur={() => setActiveCell(null)}
      onCheckboxKeyDown={() => {}}
      onCheckboxCommit={(rowId, field, next) => commitCellValue(rowId, field as any, next)}
      getRenderedCellValue={getRenderedCellValue}
    />
  )
}
