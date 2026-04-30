'use client'

import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject } from 'react'
import { useEffect, useRef } from 'react'

function getCellDomKey(rowId: string, field: string) {
  return `${rowId}:${field}`
}

function selectElement(element: HTMLInputElement | HTMLTextAreaElement) {
  if (element instanceof HTMLInputElement && element.type !== 'checkbox') element.select()
  if (element instanceof HTMLTextAreaElement) element.select()
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
  onDeleteRow?: (rowId: string) => void | Promise<unknown>
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
  onDeleteRow,
  scrollContainerRef,
  shouldVirtualize,
  tableViewportHeight,
  onTableScrollTopChange,
  rowHeight,
  tableScrollTop,
}: Options<Row, CellKey>) {
  const cellRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})
  const pendingFocusRef = useRef<{ rowId: string; field: CellKey; select: boolean } | null>(null)
  const editingCellRef = useRef<string | null>(null)
  const activeCellRef = useRef<{ rowId: string; field: CellKey } | null>(null)
  const activeDraftRef = useRef<string | boolean | null>(null)

  useEffect(() => {
    activeCellRef.current = activeCell
  }, [activeCell])

  useEffect(() => {
    activeDraftRef.current = activeDraft
  }, [activeDraft])

  function handleDraftChange(value: string) {
    activeDraftRef.current = value
    onActiveDraftChange(value)
  }

  useEffect(() => {
    const pending = pendingFocusRef.current
    if (!pending) return

    const element = cellRefs.current[getCellDomKey(pending.rowId, pending.field)]
    if (!element) return

    pendingFocusRef.current = null
    window.requestAnimationFrame(() => {
      element.focus()
      if (pending.select) selectElement(element)
    })
  }, [tableScrollTop, tableViewportHeight, rows])

  useEffect(() => {
    if (!activeCell) return
    const element = cellRefs.current[getCellDomKey(activeCell.rowId, activeCell.field)]
    if (element && document.activeElement === element) return
    focusCell(activeCell.rowId, activeCell.field, true)
  }, [activeCell, rows])

  function getRowById(rowId: string) {
    return rows.find((row) => getRowId(row) === rowId) ?? null
  }

  function setActiveCellWithDraft(cell: { rowId: string; field: CellKey }, options?: { select?: boolean }) {
    const row = getRowById(cell.rowId)
    const draft = row ? getCellValue(row, cell.field) : null
    activeCellRef.current = cell
    activeDraftRef.current = draft
    onActiveCellChange(cell)
    onActiveDraftChange(draft)
    if (options?.select !== false) editingCellRef.current = null
    focusCell(cell.rowId, cell.field, options?.select ?? true)
  }

  function focusCell(rowId: string, field: CellKey, shouldSelect = true) {
    const rowIndex = rows.findIndex((row) => getRowId(row) === rowId)
    if (rowIndex < 0) return

    pendingFocusRef.current = { rowId, field, select: shouldSelect }

    const existingElement = cellRefs.current[getCellDomKey(rowId, field)]
    if (existingElement) {
      pendingFocusRef.current = null
      window.requestAnimationFrame(() => {
        existingElement.focus()
        if (shouldSelect) selectElement(existingElement)
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

  function getNeighborCell(rowId: string, field: CellKey, mode: 'left' | 'right' | 'up' | 'down') {
    const rowIndex = rows.findIndex((row) => getRowId(row) === rowId)
    const fieldIndex = cellOrder.findIndex((key) => key === field)
    if (rowIndex < 0 || fieldIndex < 0) return null

    if (mode === 'left') {
      if (fieldIndex > 0) return { rowId, field: cellOrder[fieldIndex - 1] }
      if (rowIndex > 0) return { rowId: getRowId(rows[rowIndex - 1]), field: cellOrder[cellOrder.length - 1] }
      return { rowId, field }
    }
    if (mode === 'right') {
      if (fieldIndex < cellOrder.length - 1) return { rowId, field: cellOrder[fieldIndex + 1] }
      if (rowIndex < rows.length - 1) return { rowId: getRowId(rows[rowIndex + 1]), field: cellOrder[0] }
      return { rowId, field }
    }
    if (mode === 'up') {
      if (rowIndex > 0) return { rowId: getRowId(rows[rowIndex - 1]), field }
      return { rowId, field }
    }
    if (rowIndex < rows.length - 1) return { rowId: getRowId(rows[rowIndex + 1]), field }
    return { rowId, field }
  }

  function commitActiveCell(options?: { move?: 'left' | 'right' | 'up' | 'down'; draftValue?: string | boolean }) {
    const cell = activeCellRef.current
    if (!cell) return
    const row = getRowById(cell.rowId)
    if (!row) return

    const nextValue = (options?.draftValue ?? activeDraftRef.current ?? getCellValue(row, cell.field)) as string | boolean
    commitCellValue(cell.rowId, cell.field, nextValue)

    if (options?.move) {
      const neighbor = getNeighborCell(cell.rowId, cell.field, options.move)
      if (neighbor) setActiveCellWithDraft(neighbor, { select: true })
      return
    }

    setActiveCellWithDraft(cell, { select: false })
  }

  function deleteRow(rowId: string) {
    editingCellRef.current = null
    void onDeleteRow?.(rowId)
  }

  function getRenderedCellValue(row: Row, field: string) {
    const typedField = field as CellKey
    if (activeCell?.rowId === getRowId(row) && activeCell.field === typedField) {
      return (activeDraft ?? '') as string | boolean
    }
    return getCellValue(row, typedField)
  }

  function handleTextCellFocus(rowId: string, field: string) {
    const typedField = field as CellKey
    const row = rows.find((r) => getRowId(r) === rowId)
    if (!row) return
    const draft = getCellValue(row, typedField)
    activeCellRef.current = { rowId, field: typedField }
    activeDraftRef.current = draft
    onActiveCellChange({ rowId, field: typedField })
    onActiveDraftChange(draft)
    editingCellRef.current = null
  }

  function handleTextCellBlur(rowId: string, field: string) {
    const typedField = field as CellKey
    const element = cellRefs.current[getCellDomKey(rowId, typedField)]
    const row = getRowById(rowId)
    if (!row) return
    commitCellValue(rowId, typedField, element?.value ?? getCellValue(row, typedField))
  }

  function createRow(rowId: string, asChild: boolean, draftValue?: string | boolean) {
    commitActiveCell({ draftValue })
    editingCellRef.current = null
    void onCreateRow({ sourceRowId: rowId, asChild })
  }

  function wantsCreateRow(event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    return event.key === 'Enter' && (event.ctrlKey || event.metaKey)
  }

  function shouldArrowEditText(event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, rowId: string, field: string) {
    return editingCellRef.current === getCellDomKey(rowId, field)
  }

  function handleTextCellKeyDown(event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, rowId: string, field: string) {
    const typedField = field as CellKey
    const currentValue = event.currentTarget.value

    if (event.key.length === 1 || event.key === 'Backspace') {
      editingCellRef.current = getCellDomKey(rowId, field)
    }

    if (event.key === 'Delete') {
      event.preventDefault()
      deleteRow(rowId)
      return
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      handleUndo()
      return
    }

    if (wantsCreateRow(event)) {
      event.preventDefault()
      createRow(rowId, event.shiftKey, currentValue)
      return
    }

    // SHIFT+ENTER = child row
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault()
      createRow(rowId, true, currentValue)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      const row = getRowById(rowId)
      const value = row ? getCellValue(row, typedField) : ''
      activeDraftRef.current = value
      onActiveDraftChange(value)
      editingCellRef.current = null
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      editingCellRef.current = null
      commitActiveCell({ move: event.shiftKey ? 'left' : 'right', draftValue: currentValue })
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      editingCellRef.current = null
      commitActiveCell({ move: 'down', draftValue: currentValue })
      return
    }

    if (event.key.startsWith('Arrow')) {
      if (shouldArrowEditText(event, rowId, field)) return
      event.preventDefault()
      editingCellRef.current = null
      if (event.key === 'ArrowUp') commitActiveCell({ move: 'up', draftValue: currentValue })
      if (event.key === 'ArrowDown') commitActiveCell({ move: 'down', draftValue: currentValue })
      if (event.key === 'ArrowLeft') commitActiveCell({ move: 'left', draftValue: currentValue })
      if (event.key === 'ArrowRight') commitActiveCell({ move: 'right', draftValue: currentValue })
    }
  }

  function handleCheckboxFocus(rowId: string, field: string) {
    const typedField = field as CellKey
    const row = rows.find((r) => getRowId(r) === rowId)
    if (!row) return
    const draft = Boolean(getCellValue(row, typedField))
    activeCellRef.current = { rowId, field: typedField }
    activeDraftRef.current = draft
    onActiveCellChange({ rowId, field: typedField })
    onActiveDraftChange(draft)
    editingCellRef.current = null
  }

  function handleCheckboxBlur(rowId: string, field: string) {
    const typedField = field as CellKey
    commitActiveCell({ draftValue: Boolean(getCellValue(getRowById(rowId) as Row, typedField)) })
  }

  function handleCheckboxKeyDown(event: ReactKeyboardEvent<HTMLInputElement>, rowId: string, field: string) {
    const typedField = field as CellKey

    if (event.key === 'Delete') {
      event.preventDefault()
      deleteRow(rowId)
      return
    }

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
      if (neighbor) setActiveCellWithDraft(neighbor, { select: true })
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const neighbor = getNeighborCell(rowId, typedField, 'down')
      if (neighbor) setActiveCellWithDraft(neighbor, { select: true })
      return
    }

    if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      if (event.key === 'ArrowUp') setActiveCellWithDraft(getNeighborCell(rowId, typedField, 'up') ?? { rowId, field: typedField }, { select: true })
      if (event.key === 'ArrowDown') setActiveCellWithDraft(getNeighborCell(rowId, typedField, 'down') ?? { rowId, field: typedField }, { select: true })
      if (event.key === 'ArrowLeft') setActiveCellWithDraft(getNeighborCell(rowId, typedField, 'left') ?? { rowId, field: typedField }, { select: true })
      if (event.key === 'ArrowRight') setActiveCellWithDraft(getNeighborCell(rowId, typedField, 'right') ?? { rowId, field: typedField }, { select: true })
    }
  }

  function handleCheckboxCommit(rowId: string, field: string, nextValue: boolean) {
    commitCellValue(rowId, field as CellKey, nextValue)
    activeDraftRef.current = nextValue
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
    handleDraftChange,
  }
}
