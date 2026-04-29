'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { WorksheetActiveCell, WorksheetCellDraftValue, WorksheetRowSaveState } from '@/components/data-display/worksheet/worksheetTypes'
import { parseNumber } from '@/lib/shared/numbers'
import type { JobWorksheetEditableCellKey, JobWorksheetRow } from '../JobWorksheetTableAdapter'
import type { CreateJobWorksheetRowInput, UpdateJobWorksheetRowPatch, WorksheetSortOrderUpdate } from './useJobWorksheetPersistence'

type UndoEntry =
  | {
      kind: 'edit'
      rowId: string
      previousRow: JobWorksheetRow
      nextRow: JobWorksheetRow
    }
  | {
      kind: 'delete'
      rows: JobWorksheetRow[]
    }

type WorksheetBackup = {
  savedAt: string
  rows: JobWorksheetRow[]
}

type CreateDraftRowOptions = {
  sourceRowId?: string
  asChild?: boolean
}

const ALLOWED_UNITS = ['flat', 'ea', 'sqft', 'lnft', 'cuft']

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

function isBlankDraftRow(row: JobWorksheetRow) {
  return isDraftRowId(row.id) && !row.description.trim()
}

function canHaveChildRows(_row: JobWorksheetRow | null) {
  return true
}

function cloneRow(row: JobWorksheetRow): JobWorksheetRow {
  return { ...row }
}

function normalizeText(value: WorksheetCellDraftValue) {
  const next = String(value ?? '').trim()
  return next || null
}

function normalizeUnit(value: WorksheetCellDraftValue, fallback: string | null) {
  const next = String(value ?? '')
  return ALLOWED_UNITS.includes(next) ? next : fallback ?? 'ea'
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
      return { ...row, quantity: row.row_kind === 'note' ? null : parseNumber(String(draftValue ?? '')) ?? 1 }
    case 'unit_price':
      return { ...row, unit_price: row.row_kind === 'note' ? null : parseNumber(String(draftValue ?? '')) }
    case 'unit':
      return { ...row, unit: row.row_kind === 'note' ? null : normalizeUnit(draftValue, row.unit) }
    case 'notes':
      return { ...row, notes: normalizeText(draftValue) }
  }
}

function buildPatch(row: JobWorksheetRow): UpdateJobWorksheetRowPatch {
  return {
    description: row.description,
    location: row.location,
    quantity: row.row_kind === 'note' ? null : row.quantity,
    unit: row.row_kind === 'note' ? null : row.unit ?? 'ea',
    unit_price: row.row_kind === 'note' ? null : row.unit_price,
    notes: row.notes,
  }
}

function buildCreateInput(jobId: string, row: JobWorksheetRow): CreateJobWorksheetRowInput {
  return {
    job_id: jobId,
    parent_id: row.parent_id,
    sort_order: row.sort_order,
    row_kind: row.row_kind,
    description: row.description,
    location: row.location,
    quantity: row.quantity ?? 1,
    unit: row.unit ?? 'ea',
    unit_price: row.unit_price,
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
    (a.unit_price ?? null) === (b.unit_price ?? null) &&
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

function collectRowSubtree(rows: JobWorksheetRow[], rowId: string) {
  const ids = new Set([rowId])
  let changed = true

  while (changed) {
    changed = false
    rows.forEach((row) => {
      if (row.parent_id && ids.has(row.parent_id) && !ids.has(row.id)) {
        ids.add(row.id)
        changed = true
      }
    })
  }

  return rows.filter((row) => ids.has(row.id))
}

function findNextActiveRowAfterDelete(rows: JobWorksheetRow[], deletedIds: Set<string>, deletedRows: JobWorksheetRow[]) {
  const sortedDeletedIndexes = deletedRows
    .map((row) => rows.findIndex((candidate) => candidate.id === row.id))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)

  const firstDeletedIndex = sortedDeletedIndexes[0] ?? -1
  if (firstDeletedIndex < 0) return null

  for (let index = firstDeletedIndex - 1; index >= 0; index -= 1) {
    if (!deletedIds.has(rows[index].id)) return rows[index]
  }

  for (let index = firstDeletedIndex; index < rows.length; index += 1) {
    if (!deletedIds.has(rows[index].id)) return rows[index]
  }

  return null
}

function createDraftRow(jobId: string, sourceRow: JobWorksheetRow | null, asChild: boolean): JobWorksheetRow {
  const childOfSource = asChild && canHaveChildRows(sourceRow)

  return {
    id: getDraftId(),
    parent_id: childOfSource ? sourceRow?.id ?? null : sourceRow?.parent_id ?? null,
    sort_order: 0,
    row_kind: 'line_item',
    description: '',
    location: sourceRow?.location ?? null,
    notes: null,
    scope_status: 'included',
    is_upgrade: false,
    replaces_item_id: null,
    quantity: 1,
    unit: 'ea',
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
  restoreRows: (rows: JobWorksheetRow[]) => Promise<JobWorksheetRow[]>,
  deleteRow: (rowId: string) => Promise<void>,
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
  const undoStackRef = useRef<UndoEntry[]>([])
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
    undoStackRef.current = undoStack
  }, [undoStack])

  useEffect(() => {
    activeCellRef.current = activeCell
  }, [activeCell])

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() !== 'z') return
      if (event.defaultPrevented) return
      if (undoStackRef.current.length === 0) return
      event.preventDefault()
      handleUndo()
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    const nextRows = restoredRows.length > 0 ? restoredRows : normalizeSortOrders([createDraftRow(jobId, null, false)])

    setLocalRows(nextRows)
    setServerRows(initialRows)
    localRowsRef.current = nextRows
    serverRowsRef.current = initialRows
    setRowSaveState(buildRowStateMap(nextRows, initialRows))
    setUndoStack([])
    undoStackRef.current = []
    setActiveCell({ rowId: nextRows[0].id, field: 'description' })
    setActiveDraft(nextRows[0].description)
    activeCellRef.current = { rowId: nextRows[0].id, field: 'description' }

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

  function setUndoStackSync(nextStack: UndoEntry[]) {
    undoStackRef.current = nextStack
    setUndoStack(nextStack)
  }

  function setActiveCellSync(cell: WorksheetActiveCell<JobWorksheetEditableCellKey>, draft: WorksheetCellDraftValue) {
    activeCellRef.current = cell
    setActiveCell(cell)
    setActiveDraft(draft)
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
      setActiveCellSync({ rowId: created.id, field: 'description' }, created.description)
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
    setUndoStackSync([...undoStackRef.current, { kind: 'edit', rowId, previousRow: cloneRow(row), nextRow: cloneRow(next) }])
    syncRowState(rowId, next)
    writeBackup(jobId, localRowsRef.current.map((currentRow) => (currentRow.id === rowId ? next : currentRow)))

    if (isDraftRowId(rowId)) {
      if (field === 'description' && next.description.trim()) void promoteDraftRow(next)
      return
    }

    scheduleFlush(rowId)
  }

  function focusExistingBlankDraft() {
    const blankDraft = localRowsRef.current.find(isBlankDraftRow)
    if (!blankDraft) return false
    setActiveCellSync({ rowId: blankDraft.id, field: 'description' }, '')
    return true
  }

  function createDraftRowAfter(options?: CreateDraftRowOptions) {
    if (!options?.sourceRowId && focusExistingBlankDraft()) return

    const rows = localRowsRef.current
    const sourceIndex = options?.sourceRowId ? rows.findIndex((row) => row.id === options.sourceRowId) : rows.length - 1
    const safeSourceIndex = sourceIndex >= 0 ? sourceIndex : rows.length - 1
    const sourceRow = safeSourceIndex >= 0 ? rows[safeSourceIndex] : null
    const childOfSource = Boolean(options?.asChild && canHaveChildRows(sourceRow))
    const insertIndex = childOfSource ? safeSourceIndex + 1 : safeSourceIndex >= 0 ? findLastDescendantIndex(rows, safeSourceIndex) + 1 : rows.length
    const draftRow = createDraftRow(jobId, sourceRow, childOfSource)
    const nextRows = normalizeSortOrders([
      ...rows.slice(0, insertIndex),
      draftRow,
      ...rows.slice(insertIndex),
    ])

    setLocalRowsSync(nextRows)
    setRowSaveState(buildRowStateMap(nextRows, serverRowsRef.current))
    writeBackup(jobId, nextRows)
    setActiveCellSync({ rowId: draftRow.id, field: 'description' }, '')
  }

  function deleteWorksheetRow(rowId: string) {
    const rows = localRowsRef.current
    const deletedRows = collectRowSubtree(rows, rowId)
    if (deletedRows.length === 0) return

    const deletedIds = new Set(deletedRows.map((row) => row.id))
    const targetRow = findNextActiveRowAfterDelete(rows, deletedIds, deletedRows)
    const remainingRows = rows.filter((row) => !deletedIds.has(row.id))
    const nextRows = remainingRows.length > 0
      ? normalizeSortOrders(remainingRows)
      : normalizeSortOrders([createDraftRow(jobId, null, false)])
    const nextServerRows = serverRowsRef.current.filter((row) => !deletedIds.has(row.id))
    const nextActiveRow = targetRow && nextRows.some((row) => row.id === targetRow.id) ? targetRow : nextRows[0]

    Object.values(saveTimersRef.current).forEach((timer) => clearTimeout(timer))
    saveTimersRef.current = {}
    setUndoStackSync([...undoStackRef.current, { kind: 'delete', rows: deletedRows.map(cloneRow) }])
    setLocalRowsSync(nextRows)
    setServerRowsSync(nextServerRows)
    setRowSaveState(buildRowStateMap(nextRows, nextServerRows))
    setActiveCellSync({ rowId: nextActiveRow.id, field: 'description' }, nextActiveRow.description)
    writeBackup(jobId, nextRows)

    deletedRows
      .filter((row) => !isDraftRowId(row.id))
      .slice()
      .reverse()
      .forEach((row) => {
        void deleteRow(row.id).catch(() => {
          setRowState(row.id, 'error')
          writeBackup(jobId, localRowsRef.current)
        })
      })
  }

  function handleUndo() {
    const stack = undoStackRef.current
    const last = stack[stack.length - 1]
    if (!last) return

    if (last.kind === 'delete') {
      const restoredRows = last.rows.map(cloneRow)
      const restoredIds = new Set(restoredRows.map((row) => row.id))
      const nextRows = [
        ...localRowsRef.current.filter((row) => !restoredIds.has(row.id)),
        ...restoredRows,
      ].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      const nextServerRows = [
        ...serverRowsRef.current.filter((row) => !restoredIds.has(row.id)),
        ...restoredRows.filter((row) => !isDraftRowId(row.id)),
      ]
      const activeRow = restoredRows[0] ?? nextRows[0]

      setLocalRowsSync(nextRows)
      setServerRowsSync(nextServerRows)
      setRowSaveState(buildRowStateMap(nextRows, nextServerRows))
      if (activeRow) setActiveCellSync({ rowId: activeRow.id, field: 'description' }, activeRow.description)
      writeBackup(jobId, nextRows)
      void restoreRows(restoredRows.filter((row) => !isDraftRowId(row.id))).catch(() => {
        restoredRows.forEach((row) => setRowState(row.id, 'error'))
      })
      setUndoStackSync(stack.slice(0, -1))
      return
    }

    replaceLocalRow(last.rowId, cloneRow(last.previousRow))
    syncRowState(last.rowId, last.previousRow)
    scheduleFlush(last.rowId, 120)
    setActiveCellSync({ rowId: last.rowId, field: 'description' }, last.previousRow.description)

    setUndoStackSync(stack.slice(0, -1))
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
    deleteWorksheetRow,
    handleUndo,
    saveCounts,
  }
}
