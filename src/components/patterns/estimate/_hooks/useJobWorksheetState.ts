'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { WorksheetActiveCell, WorksheetCellDraftValue, WorksheetRowSaveState } from '@/components/data-display/worksheet/worksheetTypes'
import { parseNumber } from '@/lib/shared/numbers'
import type { JobWorksheetRow } from '../JobWorksheetTableAdapter'

export type JobWorksheetEditableCellKey = 'description' | 'location' | 'quantity' | 'unit' | 'notes'

type UndoEntry = {
  rowId: string
  previousRow: JobWorksheetRow
  nextRow: JobWorksheetRow
}

function cloneRow(row: JobWorksheetRow): JobWorksheetRow {
  return { ...row }
}

function normalizeText(value: WorksheetCellDraftValue) {
  const next = String(value ?? '').trim()
  return next || null
}

function applyEditableCellValue(
  row: JobWorksheetRow,
  field: JobWorksheetEditableCellKey,
  draftValue: WorksheetCellDraftValue
): JobWorksheetRow {
  switch (field) {
    case 'description': {
      const next = String(draftValue ?? '').trim()
      return next ? { ...row, description: next } : row
    }
    case 'location':
      return { ...row, location: normalizeText(draftValue) }
    case 'quantity':
      return { ...row, quantity: row.row_kind === 'note' ? null : parseNumber(String(draftValue ?? '')) }
    case 'unit':
      return { ...row, unit: row.row_kind === 'note' ? null : normalizeText(draftValue) }
    case 'notes':
      return { ...row, notes: normalizeText(draftValue) }
  }
}

function buildPatch(row: JobWorksheetRow) {
  return {
    description: row.description,
    location: row.location,
    quantity: row.row_kind === 'note' ? null : row.quantity,
    unit: row.row_kind === 'note' ? null : row.unit,
    notes: row.notes,
  }
}

function areEditableFieldsEqual(a: JobWorksheetRow | null | undefined, b: JobWorksheetRow | null | undefined) {
  if (!a || !b) return false
  return (
    a.description === b.description &&
    (a.location ?? null) === (b.location ?? null) &&
    (a.quantity ?? null) === (b.quantity ?? null) &&
    (a.unit ?? null) === (b.unit ?? null) &&
    (a.notes ?? null) === (b.notes ?? null)
  )
}

export function useJobWorksheetState(initialRows: JobWorksheetRow[]) {
  const supabase = createClient()

  const [localRows, setLocalRows] = useState<JobWorksheetRow[]>([])
  const [serverRows, setServerRows] = useState<JobWorksheetRow[]>([])
  const [rowSaveState, setRowSaveState] = useState<Record<string, WorksheetRowSaveState>>({})
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const [activeCell, setActiveCell] = useState<WorksheetActiveCell<JobWorksheetEditableCellKey> | null>(null)
  const [activeDraft, setActiveDraft] = useState<WorksheetCellDraftValue>(null)

  const localRowsRef = useRef<JobWorksheetRow[]>([])
  const serverRowsRef = useRef<JobWorksheetRow[]>([])
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const savingRowsRef = useRef<Set<string>>(new Set())
  const activeCellRef = useRef<WorksheetActiveCell<JobWorksheetEditableCellKey> | null>(null)

  useEffect(() => {
    localRowsRef.current = localRows
  }, [localRows])

  useEffect(() => {
    serverRowsRef.current = serverRows
  }, [serverRows])

  useEffect(() => {
    activeCellRef.current = activeCell
  }, [activeCell])

  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    Object.values(saveTimersRef.current).forEach((timer) => clearTimeout(timer))
    saveTimersRef.current = {}
    savingRowsRef.current = new Set()
    setLocalRows(initialRows)
    setServerRows(initialRows)
    localRowsRef.current = initialRows
    serverRowsRef.current = initialRows
    setRowSaveState(Object.fromEntries(initialRows.map((row) => [row.id, 'idle' as WorksheetRowSaveState])))
    setUndoStack([])
    setActiveCell(null)
    setActiveDraft(null)
    activeCellRef.current = null
  }, [initialRows])

  function getLocalRow(rowId: string) {
    return localRowsRef.current.find((row) => row.id === rowId) ?? null
  }

  function getServerRow(rowId: string) {
    return serverRowsRef.current.find((row) => row.id === rowId) ?? null
  }

  function setLocalRowsSync(nextRows: JobWorksheetRow[]) {
    localRowsRef.current = nextRows
    setLocalRows(nextRows)
  }

  function setServerRowsSync(nextRows: JobWorksheetRow[]) {
    serverRowsRef.current = nextRows
    setServerRows(nextRows)
  }

  function replaceLocalRow(rowId: string, nextRow: JobWorksheetRow) {
    setLocalRowsSync(localRowsRef.current.map((row) => (row.id === rowId ? nextRow : row)))
  }

  function replaceServerRow(rowId: string, nextRow: JobWorksheetRow) {
    setServerRowsSync(serverRowsRef.current.map((row) => (row.id === rowId ? nextRow : row)))
  }

  function setRowState(rowId: string, state: WorksheetRowSaveState) {
    setRowSaveState((current) => ({ ...current, [rowId]: state }))
  }

  function syncRowState(rowId: string, row?: JobWorksheetRow | null) {
    const localRow = row ?? getLocalRow(rowId)
    const serverRow = getServerRow(rowId)
    if (!localRow || !serverRow) return
    setRowState(rowId, areEditableFieldsEqual(localRow, serverRow) ? 'idle' : 'dirty')
  }

  async function flushRow(rowId: string) {
    const local = getLocalRow(rowId)
    const server = getServerRow(rowId)
    if (!local || !server) return
    if (savingRowsRef.current.has(rowId)) return

    if (areEditableFieldsEqual(local, server)) {
      setRowState(rowId, 'idle')
      return
    }

    const requestRow = cloneRow(local)
    savingRowsRef.current.add(rowId)
    setRowState(rowId, 'saving')

    const { data, error } = await supabase
      .from('job_worksheet_items')
      .update(buildPatch(requestRow))
      .eq('id', rowId)
      .select('*')
      .single()

    savingRowsRef.current.delete(rowId)

    if (error || !data) {
      setRowState(rowId, 'error')
      return
    }

    const updated = data as JobWorksheetRow
    replaceServerRow(rowId, updated)

    const latestLocal = getLocalRow(rowId)
    if (latestLocal && areEditableFieldsEqual(latestLocal, requestRow)) {
      replaceLocalRow(rowId, updated)
      setRowState(rowId, 'idle')
      return
    }

    setRowState(rowId, 'dirty')
    scheduleFlush(rowId, 220)
  }

  function scheduleFlush(rowId: string, delay = 650) {
    if (saveTimersRef.current[rowId]) clearTimeout(saveTimersRef.current[rowId])
    saveTimersRef.current[rowId] = setTimeout(() => {
      void flushRow(rowId)
    }, delay)
  }

  function commitCellValue(
    rowId: string,
    field: JobWorksheetEditableCellKey,
    value: string | boolean
  ) {
    const row = getLocalRow(rowId)
    if (!row) return

    const next = applyEditableCellValue(row, field, value)
    if (areEditableFieldsEqual(row, next)) return

    replaceLocalRow(rowId, next)
    setUndoStack((stack) => [...stack.slice(-39), { rowId, previousRow: cloneRow(row), nextRow: cloneRow(next) }])
    syncRowState(rowId, next)
    scheduleFlush(rowId)
  }

  function handleUndo() {
    setUndoStack((stack) => {
      const last = stack[stack.length - 1]
      if (!last) return stack

      replaceLocalRow(last.rowId, cloneRow(last.previousRow))
      syncRowState(last.rowId, last.previousRow)
      scheduleFlush(last.rowId, 120)

      const currentActiveCell = activeCellRef.current
      if (currentActiveCell?.rowId === last.rowId) {
        const restored = last.previousRow[currentActiveCell.field] as WorksheetCellDraftValue
        setActiveDraft(restored)
      }

      return stack.slice(0, -1)
    })
  }

  const saveCounts = useMemo(() => {
    return localRows.reduce(
      (acc, row) => {
        const state = rowSaveState[row.id] ?? 'idle'
        if (state === 'saving') acc.saving += 1
        if (state === 'dirty') acc.dirty += 1
        if (state === 'error') acc.error += 1
        return acc
      },
      { saving: 0, dirty: 0, error: 0 }
    )
  }, [localRows, rowSaveState])

  return {
    localRows,
    rowSaveState,
    activeCell,
    activeDraft,
    setActiveCell,
    setActiveDraft,
    commitCellValue,
    handleUndo,
    saveCounts,
  }
}
