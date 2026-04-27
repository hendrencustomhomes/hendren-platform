'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { WorksheetActiveCell, WorksheetCellDraftValue, WorksheetRowSaveState } from '@/components/data-display/worksheet/worksheetTypes'
import { parseNumber } from '@/lib/shared/numbers'
import type { JobWorksheetEditableCellKey, JobWorksheetRow } from '../JobWorksheetTableAdapter'
import type { CreateJobWorksheetRowInput, UpdateJobWorksheetRowPatch, WorksheetSortOrderUpdate } from './useJobWorksheetPersistence'

type UndoEntry = {
  rowId: string
  previousRow: JobWorksheetRow
  nextRow: JobWorksheetRow
}

type WorksheetBackup = {
  savedAt: string
  rows: JobWorksheetRow[]
}

type CreateDraftRowOptions = {
  sourceRowId?: string
  asChild?: boolean
}

function getBackupKey(jobId: string) {
  return `hendren:job-worksheet:${jobId}:draft`
}

function getDraftId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `draft_${crypto.randomUUID()}`
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function isDraftRowId(rowId: string) {
  return rowId.startsWith('draft_')
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
      return isDraftRowId(row.id) ? { ...row, description: next } : next ? { ...row, description: next } : row
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

function buildCreateInput(jobId: string, row: JobWorksheetRow): CreateJobWorksheetRowInput {
  return {
    job_id: jobId,
    parent_id: row.parent_id,
    sort_order: row.sort_order,
    row_kind: 'line_item',
    description: row.description,
    location: row.location,
    quantity: row.quantity,
    unit: row.unit,
    notes: row.notes,
    scope_status: 'included',
    is_upgrade: false,
    pricing_type: 'unpriced',
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
      if (isDraftRowId(row.id)) return [row.id, 'dirty'] as const
      const server = serverById.get(row.id)
      return [row.id, areEditableFieldsEqual(row, server) ? 'idle' : 'dirty'] as const
    })
  ) as Record<string, WorksheetRowSaveState>
}

function mergeBackupRows(initialRows: JobWorksheetRow[], backupRows: JobWorksheetRow[]) {
  const initialById = new Map(initialRows.map((row) => [row.id, row]))
  const mergedRows = backupRows
    .filter((row) => isDraftRowId(row.id) || initialById.has(row.id))
    .map((row) => (isDraftRowId(row.id) ? row : { ...initialById.get(row.id)!, ...row }))

  const seen = new Set(mergedRows.map((row) => row.id))
  const missingServerRows = initialRows.filter((row) => !seen.has(row.id))
  return [...mergedRows, ...missingServerRows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
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
  return localRows.some((row) => isDraftRowId(row.id) || !areEditableFieldsEqual(row, serverById.get(row.id)))
}

function normalizeSortOrders(rows: JobWorksheetRow[]) {
  return rows.map((row, index) => ({ ...row, sort_order: index + 1 }))
}

function buildSortOrderUpdates(localRows: JobWorksheetRow[], serverRows: JobWorksheetRow[]) {
  const serverById = new Map(serverRows.map((row) => [row.id, row]))
  return localRows
    .filter((row) => !isDraftRowId(row.id))
    .filter((row) => serverById.get(row.id)?.sort_order !== row.sort_order)
    .map((row) => ({ id: row.id, sort_order: row.sort_order }))
}

function applySortOrdersToServerRows(serverRows: JobWorksheetRow[], updates: WorksheetSortOrderUpdate[]) {
  const updateById = new Map(updates.map((update) => [update.id, update.sort_order]))
  return serverRows.map((row) => updateById.has(row.id) ? { ...row, sort_order: updateById.get(row.id)! } : row)
}

function findLastDescendantIndex(rows: JobWorksheetRow[], sourceIndex: number) {
  const source = rows[sourceIndex]
  if (!source) return sourceIndex
  const sourceDepth = getDepthFromRows(source, rows)
  let lastIndex = sourceIndex

  for (let index = sourceIndex + 1; index < rows.length; index += 1) {
    const row = rows[index]
    if (getDepthFromRows(row, rows) <= sourceDepth) break
    lastIndex = index
  }

  return lastIndex
}

function getDepthFromRows(row: JobWorksheetRow, rows: JobWorksheetRow[]) {
  const rowsById = new Map(rows.map((item) => [item.id, item]))
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

function createDraftRow(jobId: string, sourceRow: JobWorksheetRow | null, asChild: boolean): JobWorksheetRow {
  return {
    id: getDraftId(),
    parent_id: asChild ? sourceRow?.id ?? null : sourceRow?.parent_id ?? null,
    sort_order: 0,
    row_kind: 'line_item',
    description: '',
    location: sourceRow?.location ?? null,
    notes: null,
    scope_status: 'included',
    is_upgrade: false,
    replaces_item_id: null,
    quantity: null,
    unit: null,
    pricing_source_row_id: null,
    pricing_header_id: null,
    catalog_sku: null,
    source_sku: null,
    unit_price: null,
    total_price: null,
    pricing_type: 'unpriced',
  }
}

export function useJobWorksheetState(
  jobId: string,
  initialRows: JobWorksheetRow[],
  persistRow: (rowId: string, patch: UpdateJobWorksheetRowPatch) => Promise<JobWorksheetRow>,
  createRow: (input: CreateJobWorksheetRowInput) => Promise<JobWorksheetRow>,
  persistSortOrders: (updates: WorksheetSortOrderUpdate[]) => Promise<void>
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
    const nextRows = backup ? mergeBackupRows(initialRows, backup.rows) : initialRows

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
        if (!isDraftRowId(row.id) && !areEditableFieldsEqual(row, initialRows.find((serverRow) => serverRow.id === row.id))) {
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
    if (!localRow) return
    if (isDraftRowId(rowId)) {
      setRowState(rowId, 'dirty')
      return
    }
    if (!serverRow) return
    setRowState(rowId, areEditableFieldsEqual(localRow, serverRow) ? 'idle' : 'dirty')
  }

  async function persistCurrentSortOrders(nextRows: JobWorksheetRow[], nextServerRows: JobWorksheetRow[]) {
    const updates = buildSortOrderUpdates(nextRows, nextServerRows)
    if (updates.length === 0) return nextServerRows

    await persistSortOrders(updates)
    return applySortOrdersToServerRows(nextServerRows, updates)
  }

  async function promoteDraftRow(row: JobWorksheetRow) {
    if (!isDraftRowId(row.id) || !row.description.trim()) return
    if (savingRowsRef.current.has(row.id)) return

    savingRowsRef.current.add(row.id)
    setRowState(row.id, 'saving')
    writeBackup(jobId, localRowsRef.current)

    try {
      const created = await createRow(buildCreateInput(jobId, row))
      const nextRows = localRowsRef.current.map((currentRow) => (currentRow.id === row.id ? created : currentRow))
      const createdServerRows = [...serverRowsRef.current, created]
      const nextServerRows = await persistCurrentSortOrders(nextRows, createdServerRows)

      setLocalRowsSync(nextRows)
      setServerRowsSync(nextServerRows)
      setRowSaveState(buildRowStateMap(nextRows, nextServerRows))
      setActiveCell({ rowId: created.id, field: 'description' })
      setActiveDraft(created.description)
      writeBackup(jobId, nextRows)
    } catch {
      setRowState(row.id, 'error')
      writeBackup(jobId, localRowsRef.current)
    } finally {
      savingRowsRef.current.delete(row.id)
    }
  }

  async function flushRow(rowId: string) {
    if (isDraftRowId(rowId)) return
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
    if (isDraftRowId(rowId)) return
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

    if (isDraftRowId(rowId)) {
      if (field === 'description' && next.description.trim()) void promoteDraftRow(next)
      return
    }

    scheduleFlush(rowId)
  }

  function createDraftRowAfter(options?: CreateDraftRowOptions) {
    const rows = localRowsRef.current
    const sourceIndex = options?.sourceRowId ? rows.findIndex((row) => row.id === options.sourceRowId) : rows.length - 1
    const safeSourceIndex = sourceIndex >= 0 ? sourceIndex : rows.length - 1
    const sourceRow = safeSourceIndex >= 0 ? rows[safeSourceIndex] : null
    const insertIndex = options?.asChild ? safeSourceIndex + 1 : safeSourceIndex >= 0 ? findLastDescendantIndex(rows, safeSourceIndex) + 1 : rows.length
    const draftRow = createDraftRow(jobId, sourceRow, Boolean(options?.asChild))
    const nextRows = normalizeSortOrders([
      ...rows.slice(0, insertIndex),
      draftRow,
      ...rows.slice(insertIndex),
    ])

    setLocalRowsSync(nextRows)
    setRowSaveState(buildRowStateMap(nextRows, serverRowsRef.current))
    writeBackup(jobId, nextRows)
    setActiveCell({ rowId: draftRow.id, field: 'description' })
    setActiveDraft('')
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
    createDraftRowAfter,
    handleUndo,
    saveCounts,
  }
}
