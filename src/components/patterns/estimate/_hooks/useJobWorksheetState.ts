'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { WorksheetActiveCell, WorksheetCellDraftValue, WorksheetRowSaveState } from '@/components/data-display/worksheet/worksheetTypes'
import { parseNumber } from '@/lib/shared/numbers'
import type { JobWorksheetEditableCellKey, JobWorksheetRow } from '../JobWorksheetTableAdapter'
import type { UpdateJobWorksheetRowPatch } from './useJobWorksheetPersistence'

type UndoEntry = {
  rowId: string
  previousRow: JobWorksheetRow
  nextRow: JobWorksheetRow
}

type WorksheetBackup = {
  savedAt: string
  rows: JobWorksheetRow[]
}

function getBackupKey(jobId: string) {
  return `hendren:job-worksheet:${jobId}:draft`
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

function buildPatch(row: JobWorksheetRow): UpdateJobWorksheetRowPatch {
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

function buildRowStateMap(localRows: JobWorksheetRow[], serverRows: JobWorksheetRow[]) {
  const serverById = new Map(serverRows.map((row) => [row.id, row]))
  return Object.fromEntries(
    localRows.map((row) => {
      const server = serverById.get(row.id)
      return [row.id, areEditableFieldsEqual(row, server) ? 'idle' : 'dirty'] as const
    })
  ) as Record<string, WorksheetRowSaveState>
}

function mergeBackupRows(initialRows: JobWorksheetRow[], backupRows: JobWorksheetRow[]) {
  const initialById = new Map(initialRows.map((row) => [row.id, row]))
  return backupRows
    .filter((row) => initialById.has(row.id))
    .map((row) => ({ ...initialById.get(row.id)!, ...row }))
}

function readBackup(jobId: string): WorksheetBackup | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(getBackupKey(jobId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as WorksheetBackup
    if (!Array.isArray(parsed.rows)) return null
    return parsed
  } catch {
    return null
  }
}

function writeBackup(jobId: string, rows: JobWorksheetRow[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      getBackupKey(jobId),
      JSON.stringify({ savedAt: new Date().toISOString(), rows } satisfies WorksheetBackup)
    )
  } catch {
    // local backup is a failsafe only; failed localStorage must not block editing.
  }
}

function clearBackup(jobId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(getBackupKey(jobId))
  } catch {
    // no-op
  }
}

function hasUnsavedRows(localRows: JobWorksheetRow[], serverRows: JobWorksheetRow[]) {
  const serverById = new Map(serverRows.map((row) => [row.id, row]))
  return localRows.some((row) => !areEditableFieldsEqual(row, serverById.get(row.id)))
}

export function useJobWorksheetState(
  jobId: string,
  initialRows: JobWorksheetRow[],
  persistRow: (rowId: string, patch: UpdateJobWorksheetRowPatch) => Promise<JobWorksheetRow>
) {
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

    const backup = readBackup(jobId)
    const restoredRows = backup ? mergeBackupRows(initialRows, backup.rows) : initialRows
    const nextRows = restoredRows.length === initialRows.length ? restoredRows : initialRows

    setLocalRows(nextRows)
    setServerRows(initialRows)
    localRowsRef.current = nextRows
    serverRowsRef.current = initialRows
    setRowSaveState(buildRowStateMap(nextRows, initialRows))
    setUndoStack([])
    setActiveCell(null)
    setActiveDraft(null)
    activeCellRef.current = null

    if (hasUnsavedRows(nextRows, initialRows)) {
      writeBackup(jobId, nextRows)
      nextRows.forEach((row) => {
        if (!areEditableFieldsEqual(row, initialRows.find((serverRow) => serverRow.id === row.id))) {
          scheduleFlush(row.id, 900)
        }
      })
    } else {
      clearBackup(jobId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, initialRows])

  useEffect(() => {
    if (!localRows.length) {
      clearBackup(jobId)
      return
    }
    if (hasUnsavedRows(localRows, serverRows)) {
      writeBackup(jobId, localRows)
      return
    }
    clearBackup(jobId)
  }, [jobId, localRows, serverRows])

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

    try {
      const updated = await persistRow(rowId, buildPatch(requestRow))

      replaceServerRow(rowId, updated)

      const latestLocal = getLocalRow(rowId)
      if (latestLocal && areEditableFieldsEqual(latestLocal, requestRow)) {
        replaceLocalRow(rowId, updated)
        setRowState(rowId, 'idle')
        return
      }

      setRowState(rowId, 'dirty')
      scheduleFlush(rowId, 220)
    } catch {
      setRowState(rowId, 'error')
      writeBackup(jobId, localRowsRef.current)
    } finally {
      savingRowsRef.current.delete(rowId)
    }
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
    writeBackup(jobId, localRowsRef.current.map((currentRow) => (currentRow.id === rowId ? next : currentRow)))
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
