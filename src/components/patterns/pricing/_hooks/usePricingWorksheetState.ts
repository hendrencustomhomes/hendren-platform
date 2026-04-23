'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PricingRow, UpdatePricingRowPatch } from '@/lib/pricing/types'

const editableCellOrder = [
  'description_snapshot',
  'vendor_sku',
  'unit',
  'unit_price',
  'lead_days',
  'is_active',
  'notes',
] as const

type EditableCellKey = (typeof editableCellOrder)[number]
type CellDraftValue = string | boolean

type ActiveCell = {
  rowId: string
  field: EditableCellKey
}

type RowSaveState = 'idle' | 'dirty' | 'saving' | 'error'

type UndoEntry = {
  rowId: string
  previousRow: PricingRow
  nextRow: PricingRow
}

function parseNullableNumber(value: string) {
  const trimmed = value.trim().replace(/[$,]/g, '')
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function cloneRow(row: PricingRow): PricingRow {
  return { ...row }
}

function applyEditableCellValue(
  row: PricingRow,
  field: EditableCellKey,
  draftValue: CellDraftValue
): PricingRow {
  switch (field) {
    case 'description_snapshot':
      return { ...row, description_snapshot: String(draftValue) }
    case 'vendor_sku': {
      const next = String(draftValue).trim()
      return { ...row, vendor_sku: next || null }
    }
    case 'unit': {
      const next = String(draftValue).trim()
      return { ...row, unit: next || null }
    }
    case 'unit_price':
      return { ...row, unit_price: parseNullableNumber(String(draftValue)) }
    case 'lead_days':
      return { ...row, lead_days: parseNullableNumber(String(draftValue)) }
    case 'notes': {
      const next = String(draftValue).trim()
      return { ...row, notes: next || null }
    }
    case 'is_active':
      return { ...row, is_active: Boolean(draftValue) }
    default:
      return row
  }
}

function areEqual(a: PricingRow | null | undefined, b: PricingRow | null | undefined) {
  if (!a || !b) return false

  return (
    a.description_snapshot === b.description_snapshot &&
    (a.vendor_sku ?? null) === (b.vendor_sku ?? null) &&
    (a.unit ?? null) === (b.unit ?? null) &&
    (a.unit_price ?? null) === (b.unit_price ?? null) &&
    (a.lead_days ?? null) === (b.lead_days ?? null) &&
    (a.notes ?? null) === (b.notes ?? null) &&
    a.is_active === b.is_active
  )
}

export function usePricingWorksheetState({
  initialRows,
  onPersistRow,
}: {
  initialRows: PricingRow[]
  onPersistRow: (rowId: string, patch: UpdatePricingRowPatch) => Promise<PricingRow>
}) {
  const [localRows, setLocalRows] = useState<PricingRow[]>([])
  const [serverRows, setServerRows] = useState<PricingRow[]>([])
  const [rowSaveState, setRowSaveState] = useState<Record<string, RowSaveState>>({})
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])

  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const [activeDraft, setActiveDraft] = useState<CellDraftValue | null>(null)

  const localRowsRef = useRef<PricingRow[]>([])
  const serverRowsRef = useRef<PricingRow[]>([])
  const activeCellRef = useRef<ActiveCell | null>(null)
  const activeDraftRef = useRef<CellDraftValue | null>(null)
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const savingRowsRef = useRef<Set<string>>(new Set())

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
    activeDraftRef.current = activeDraft
  }, [activeDraft])

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
    setRowSaveState(Object.fromEntries(initialRows.map((r) => [r.id, 'idle' as RowSaveState])))
    setUndoStack([])
    setActiveCell(null)
    setActiveDraft(null)
    activeCellRef.current = null
    activeDraftRef.current = null
  }, [initialRows])

  function setLocalRowsSync(nextRows: PricingRow[]) {
    localRowsRef.current = nextRows
    setLocalRows(nextRows)
  }

  function setServerRowsSync(nextRows: PricingRow[]) {
    serverRowsRef.current = nextRows
    setServerRows(nextRows)
  }

  function replaceLocalRow(rowId: string, nextRow: PricingRow) {
    const nextRows = localRowsRef.current.map((row) => (row.id === rowId ? nextRow : row))
    setLocalRowsSync(nextRows)
  }

  function replaceServerRow(rowId: string, nextRow: PricingRow) {
    const nextRows = serverRowsRef.current.map((row) => (row.id === rowId ? nextRow : row))
    setServerRowsSync(nextRows)
  }

  function getLocalRow(rowId: string) {
    return localRowsRef.current.find((r) => r.id === rowId) ?? null
  }

  function getServerRow(rowId: string) {
    return serverRowsRef.current.find((r) => r.id === rowId) ?? null
  }

  function setRowState(rowId: string, state: RowSaveState) {
    setRowSaveState((prev) => ({ ...prev, [rowId]: state }))
  }

  function syncRowStateFromRows(rowId: string, row?: PricingRow | null) {
    const localRow = row ?? getLocalRow(rowId)
    const serverRow = getServerRow(rowId)
    if (!localRow || !serverRow) return
    setRowState(rowId, areEqual(localRow, serverRow) ? 'idle' : 'dirty')
  }

  async function flushRow(rowId: string) {
    const local = getLocalRow(rowId)
    const server = getServerRow(rowId)

    if (!local || !server) return
    if (savingRowsRef.current.has(rowId)) return

    if (areEqual(local, server)) {
      setRowState(rowId, 'idle')
      return
    }

    const requestRow = cloneRow(local)
    savingRowsRef.current.add(rowId)
    setRowState(rowId, 'saving')

    try {
      const updated = await onPersistRow(rowId, {
        description_snapshot: requestRow.description_snapshot,
        vendor_sku: requestRow.vendor_sku,
        unit: requestRow.unit,
        unit_price: requestRow.unit_price,
        lead_days: requestRow.lead_days,
        notes: requestRow.notes,
        is_active: requestRow.is_active,
      })

      replaceServerRow(rowId, updated)

      const latestLocalRow = getLocalRow(rowId)
      if (latestLocalRow && areEqual(latestLocalRow, requestRow)) {
        replaceLocalRow(rowId, updated)
      }

      const refreshedLocalRow = getLocalRow(rowId)
      if (refreshedLocalRow && !areEqual(refreshedLocalRow, updated)) {
        setRowState(rowId, 'dirty')
        scheduleFlush(rowId, 220)
      } else {
        setRowState(rowId, 'idle')
      }
    } catch {
      setRowState(rowId, 'error')
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

  function commitCellValue(rowId: string, field: EditableCellKey, value: CellDraftValue) {
    const row = getLocalRow(rowId)
    if (!row) return

    const next = applyEditableCellValue(row, field, value)
    if (areEqual(row, next)) return row

    replaceLocalRow(rowId, next)
    setUndoStack((u) => [...u.slice(-39), { rowId, previousRow: cloneRow(row), nextRow: cloneRow(next) }])

    if (activeCellRef.current?.rowId === rowId && activeCellRef.current.field === field) {
      const nextDraft = next[field] as unknown as CellDraftValue
      setActiveDraft(nextDraft)
      activeDraftRef.current = nextDraft
    }

    syncRowStateFromRows(rowId, next)
    scheduleFlush(rowId)
    return next
  }

  function handleUndo() {
    setUndoStack((stack) => {
      const last = stack[stack.length - 1]
      if (!last) return stack

      replaceLocalRow(last.rowId, cloneRow(last.previousRow))
      syncRowStateFromRows(last.rowId, last.previousRow)
      scheduleFlush(last.rowId, 120)

      const currentActiveCell = activeCellRef.current
      if (currentActiveCell?.rowId === last.rowId) {
        const restoredValue = last.previousRow[currentActiveCell.field] as unknown as CellDraftValue
        setActiveDraft(restoredValue)
        activeDraftRef.current = restoredValue
      }

      return stack.slice(0, -1)
    })
  }

  function appendRow(row: PricingRow) {
    const nextLocalRows = [...localRowsRef.current, row]
    const nextServerRows = [...serverRowsRef.current, row]
    setLocalRowsSync(nextLocalRows)
    setServerRowsSync(nextServerRows)
    setRowState(row.id, 'idle')
  }

  const saveCounts = useMemo(() => {
    return localRows.reduce(
      (acc, row) => {
        const s = rowSaveState[row.id] || 'idle'
        if (s === 'saving') acc.saving += 1
        if (s === 'dirty') acc.dirty += 1
        if (s === 'error') acc.error += 1
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
    appendRow,
    saveCounts,
  }
}
