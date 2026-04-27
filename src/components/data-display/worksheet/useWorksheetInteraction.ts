'use client'

import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject } from 'react'
import { useEffect, useRef } from 'react'

function getCellDomKey(rowId: string, field: string) {
  return `${rowId}:${field}`
}

function isFullySelected(element: HTMLInputElement | HTMLTextAreaElement) {
  const valueLength = element.value.length
  return (element.selectionStart ?? 0) === 0 && (element.selectionEnd ?? 0) === valueLength
}

type CreateRowOptions = {
  sourceRowId?: string
  asChild?: boolean
}

type Options<Row, CellKey extends string> = {
  rows: Row[]
  getRowId: (row: Row) => string
  cellOrder: readonly CellKey[]
  activeCell: { rowId: string; field: CellKey } | null
  onActiveCellChange: (cell: { rowId: string; field: CellKey } | null) => void
  activeDraft: string | boolean | null
  onActiveDraftChange: (draft: string | boolean | null) => void
  getCellValue: (row: Row, field: CellKey) => string | boolean
  commitCellValue: (rowId: string, field: CellKey, value: string | boolean) => void
  handleUndo: () => void
  onCreateRow: (options?: CreateRowOptions) => void | Promise<unknown>
  scrollContainerRef: MutableRefObject<HTMLDivElement | null>
  shouldVirtualize: boolean
  tableViewportHeight: number
  onTableScrollTopChange: (scrollTop: number) => void
  rowHeight: number
  tableScrollTop: number
}

export function useWorksheetInteraction<Row, CellKey extends string>({
  rows,
  getRowId,
  cellOrder,
  activeCell,
  onActiveCellChange,
  activeDraft,
  onActiveDraftChange,
  getCellValue,
  commitCellValue,
  handleUndo,
  onCreateRow,
  scrollContainerRef,
  shouldVirtualize,
  tableViewportHeight,
  onTableScrollTopChange,
  rowHeight,
  tableScrollTop,
}: Options<Row, CellKey>) {
  const cellRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})
  const pendingFocusRef = useRef<{ rowId: string; field: CellKey } | null>(null)

  useEffect(() => {
    const pending = pendingFocusRef.current
    if (!pending) return

    const element = cellRefs.current[getCellDomKey(pending.rowId, pending.field)]
    if (!element) return

    pendingFocusRef.current = null
    window.requestAnimationFrame(() => {
      element.focus()
      if (element instanceof HTMLInputElement && element.type !== 'checkbox') element.select()
      if (element instanceof HTMLTextAreaElement) element.select()
    })
  }, [tableScrollTop, tableViewportHeight, rows])

  useEffect(() => {
    if (!activeCell) return
    const element = cellRefs.current[getCellDomKey(activeCell.rowId, activeCell.field)]
    if (element && document.activeElement === element) return
    focusCell(activeCell.rowId, activeCell.field)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCell])

  function focusCell(rowId: string, field: CellKey) {
    const rowIndex = rows.findIndex((row) => getRowId(row) === rowId)
    if (rowIndex < 0) return

    pendingFocusRef.current = { rowId, field }

    const existingElement = cellRefs.current[getCellDomKey(rowId, field)]
    if (existingElement) {
      pendingFocusRef.current = null
      window.requestAnimationFrame(() => {
        existingElement.focus()
        if (existingElement instanceof HTMLInputElement && existingElement.type !== 'checkbox') {
          existingElement.select()
        }
        if (existingElement instanceof HTMLTextAreaElement) {
          existingElement.select()
        }
      })
      return
    }

    if (!shouldVirtualize) return

    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const rowTop = rowIndex * rowHeight
    const rowBottom = rowTop + rowHeight
    const viewportTop = scrollContainer.scrollTop
    const viewportBottom = viewportTop + tableViewportHeight
    let nextScrollTop = viewportTop

    if (rowTop < viewportTop) nextScrollTop = rowTop
    else if (rowBottom > viewportBottom) nextScrollTop = rowBottom - tableViewportHeight

    if (nextScrollTop !== viewportTop) {
      scrollContainer.scrollTop = nextScrollTop
      onTableScrollTopChange(nextScrollTop)
    }
  }

  function getNeighborCell(
    rowId: string,
    field: CellKey,
    mode: 'left' | 'right' | 'up' | 'down'
  ): { rowId: string; field: CellKey } | null {
    const rowIndex = rows.findIndex((row) => getRowId(row) === rowId)
    const fieldIndex = cellOrder.findIndex((key) => key === field)
    if (rowIndex < 0 || fieldIndex < 0) return null

    if (mode === 'left') {
      if (fieldIndex > 0) return { rowId, field: cellOrder[fieldIndex - 1] }
      if (rowIndex > 0) return { rowId: getRowId(rows[rowIndex - 1]), field: cellOrder[cellOrder.length - 1] }
      return null
    }
    if (mode === 'right') {
      if (fieldIndex < cellOrder.length - 1) return { rowId, field: cellOrder[fieldIndex + 1] }
      if (rowIndex < rows.length - 1) return { rowId: getRowId(rows[rowIndex + 1]), field: cellOrder[0] }
      return null
    }
    if (mode === 'up') {
      if (rowIndex > 0) return { rowId: getRowId(rows[rowIndex - 1]), field }
      return null
    }
    if (rowIndex < rows.length - 1) return { rowId: getRowId(rows[rowIndex + 1]), field }
    return null
  }

  function clearActiveCell() {
    onActiveCellChange(null)
    onActiveDraftChange(null)
  }

  function abandonActiveCellDraft() {
    if (!activeCell) return
    const row = rows.find((r) => getRowId(r) === activeCell.rowId)
    if (!row) return
    onActiveDraftChange(getCellValue(row, activeCell.field))
  }

  function commitActiveCell(options?: { move?: 'left' | 'right' | 'up' | 'down' }) {
    if (!activeCell) return
    const row = rows.find((r) => getRowId(r) === activeCell.rowId)
    if (!row) {
      clearActiveCell()
      return
    }

    const nextValue = (activeDraft ?? getCellValue(row, activeCell.field)) as string | boolean
    commitCellValue(activeCell.rowId, activeCell.field, nextValue)
    const previousCell = activeCell
    clearActiveCell()

    if (options?.move) {
      const neighbor = getNeighborCell(previousCell.rowId, previousCell.field, options.move)
      if (neighbor) focusCell(neighbor.rowId, neighbor.field)
    }
  }

  function getRenderedCellValue(row: Row, field: string): string | boolean {
    const typedField = field as CellKey
    if (activeCell?.rowId === getRowId(row) && activeCell.field === typedField) {
      return (activeDraft ?? '') as string | boolean
    }
    return getCellValue(row, typedField)
  }

  function handleTextCellFocus(
    rowId: string,
    field: string,
    element: HTMLInputElement | HTMLTextAreaElement
  ) {
    const typedField = field as CellKey
    const row = rows.find((r) => getRowId(r) === rowId)
    if (!row) return
    onActiveCellChange({ rowId, field: typedField })
    onActiveDraftChange(getCellValue(row, typedField))
    element.select()
  }

  function handleTextCellBlur(rowId: string, field: string) {
    if (!activeCell) return
    if (activeCell.rowId !== rowId || activeCell.field !== field) return
    commitActiveCell()
  }

  function createRow(rowId: string, asChild: boolean) {
    commitActiveCell()
    void onCreateRow({ sourceRowId: rowId, asChild })
  }

  function wantsCreateRow(event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLInputElement>) {
    return event.key === 'Enter' && (event.ctrlKey || event.metaKey)
  }

  function handleTextCellKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    rowId: string,
    field: string
  ) {
    const typedField = field as CellKey

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      const row = rows.find((r) => getRowId(r) === rowId)
      const localValue = row ? getCellValue(row, typedField) : ''
      if (activeDraft !== localValue) {
        onActiveDraftChange(localValue as string | boolean)
        return
      }
      handleUndo()
      return
    }

    if (wantsCreateRow(event)) {
      event.preventDefault()
      createRow(rowId, event.shiftKey)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      abandonActiveCellDraft()
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      commitActiveCell({ move: event.shiftKey ? 'left' : 'right' })
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      commitActiveCell({ move: 'down' })
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

  function handleCheckboxFocus(rowId: string, field: string) {
    const typedField = field as CellKey
    const row = rows.find((r) => getRowId(r) === rowId)
    if (!row) return
    onActiveCellChange({ rowId, field: typedField })
    onActiveDraftChange(Boolean(getCellValue(row, typedField)))
  }

  function handleCheckboxBlur(rowId: string, field: string) {
    if (!activeCell) return
    if (activeCell.rowId !== rowId || activeCell.field !== field) return
    clearActiveCell()
  }

  function handleCheckboxKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
    rowId: string,
    field: string
  ) {
    const typedField = field as CellKey

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      handleUndo()
      return
    }

    if (wantsCreateRow(event)) {
      event.preventDefault()
      void onCreateRow({ sourceRowId: rowId, asChild: event.shiftKey })
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
      const neighbor = getNeighborCell(rowId, typedField, 'down')
      if (neighbor) focusCell(neighbor.rowId, neighbor.field)
    }
  }

  function handleCheckboxCommit(rowId: string, field: string, nextValue: boolean) {
    commitCellValue(rowId, field as CellKey, nextValue)
    onActiveDraftChange(nextValue)
  }

  return {
    cellRefs,
    getRenderedCellValue,
    handleTextCellFocus,
    handleTextCellBlur,
    handleTextCellKeyDown,
    handleCheckboxFocus,
    handleCheckboxBlur,
    handleCheckboxKeyDown,
    handleCheckboxCommit,
  }
}
