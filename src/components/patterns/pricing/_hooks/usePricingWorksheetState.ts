'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PricingRow } from '@/lib/pricing/types'
import type { UpdatePricingRowPatch } from '@/lib/pricing/types'

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

function areEqual(a: PricingRow, b: PricingRow) {
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

  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const savingRowsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    setLocalRows(initialRows)
    setServerRows(initialRows)
    setRowSaveState(Object.fromEntries(initialRows.map((r) => [r.id, 'idle'])))
  }, [initialRows])

  function replaceLocalRow(rowId: string, nextRow: PricingRow) {
    setLocalRows((rows) => rows.map((r) => (r.id === rowId ? nextRow : r)))
  }

  function replaceServerRow(rowId: string, nextRow: PricingRow) {
    setServerRows((rows) => rows.map((r) => (r.id === rowId ? nextRow : r)))
  }

  function getLocalRow(rowId: string) {
    return localRows.find((r) => r.id === rowId)
  }

  function getServerRow(rowId: string) {
    return serverRows.find((r) => r.id === rowId)
  }

  function setRowState(rowId: string, state: RowSaveState) {
    setRowSaveState((prev) => ({ ...prev, [rowId]: state }))
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

    savingRowsRef.current.add(rowId)
    setRowState(rowId, 'saving')

    try {
      const updated = await onPersistRow(rowId, {
        description_snapshot: local.description_snapshot,
        vendor_sku: local.vendor_sku,
        unit: local.unit,
        unit_price: local.unit_price,
        lead_days: local.lead_days,
        notes: local.notes,
        is_active: local.is_active,
      })

      replaceServerRow(rowId, updated)
      replaceLocalRow(rowId, updated)
      setRowState(rowId, 'idle')
    } catch {
      setRowState(rowId, 'error')
    } finally {
      savingRowsRef.current.delete(rowId)
    }
  }

  function scheduleFlush(rowId: string, delay = 600) {
    if (saveTimersRef.current[rowId]) clearTimeout(saveTimersRef.current[rowId])
    saveTimersRef.current[rowId] = setTimeout(() => flushRow(rowId), delay)
  }

  function commitCellValue(rowId: string, field: EditableCellKey, value: CellDraftValue) {
    const row = getLocalRow(rowId)
    if (!row) return

    const next = applyEditableCellValue(row, field, value)
    if (areEqual(row, next)) return

    replaceLocalRow(rowId, next)
    setUndoStack((u) => [...u.slice(-39), { rowId, previousRow: row, nextRow: next }])

    setRowState(rowId, 'dirty')
    scheduleFlush(rowId)
  }

  function handleUndo() {
    setUndoStack((stack) => {
      const last = stack[stack.length - 1]
      if (!last) return stack

      replaceLocalRow(last.rowId, last.previousRow)
      setRowState(last.rowId, 'dirty')
      scheduleFlush(last.rowId, 100)

      return stack.slice(0, -1)
    })
  }

  function appendRow(row: PricingRow) {
    setLocalRows((r) => [...r, row])
    setServerRows((r) => [...r, row])
    setRowState(row.id, 'idle')
  }

  const saveCounts = useMemo(() => {
    return localRows.reduce(
      (acc, row) => {
        const s = rowSaveState[row.id] || 'idle'
        if (s === 'saving') acc.saving++
        if (s === 'dirty') acc.dirty++
        if (s === 'error') acc.error++
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
