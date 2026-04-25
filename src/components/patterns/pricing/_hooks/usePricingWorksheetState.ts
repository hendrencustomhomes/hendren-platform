'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PricingRow, PricingType, UpdatePricingRowPatch } from '@/lib/pricing/types'

const editableCellOrder = [
  'description_snapshot',
  'vendor_sku',
  'pricing_type',
  'quantity',
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

function parseNullableMoney(value: string) {
  const parsed = parseNullableNumber(value)
  if (parsed == null) return null
  return parsed === 0 ? null : parsed
}

function parsePricingType(value: string): PricingType | null {
  const normalized = value.toLowerCase().trim().replace(/[\s-]+/g, '_')
  if (normalized === 'unit') return 'unit'
  if (normalized === 'lump' || normalized === 'lump_sum' || normalized === 'lumpsum') return 'lump_sum'
  if (normalized === 'allow' || normalized === 'allowance') return 'allowance'
  return null
}

function cloneRow(row: PricingRow): PricingRow {
  return { ...row }
}

function isDraftRowId(rowId: string) {
  return rowId.startsWith('draft-')
}

function hasMeaningfulData(row: PricingRow) {
  return Boolean(
    row.catalog_sku ||
      row.vendor_sku ||
      row.description_snapshot.trim() ||
      row.pricing_type !== 'unit' ||
      row.quantity != null ||
      row.unit ||
      row.unit_price != null ||
      row.lead_days != null ||
      row.notes
  )
}

function createDraftRow(sortOrder: number): PricingRow {
  const now = new Date().toISOString()
  const id = `draft-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`

  return {
    id,
    pricing_header_id: '',
    catalog_sku: null,
    cost_code_id: '',
    source_sku: '',
    vendor_sku: null,
    description_snapshot: '',
    pricing_type: 'unit',
    quantity: null,
    unit: null,
    unit_price: null,
    lead_days: null,
    notes: null,
    sort_order: sortOrder,
    is_active: true,
    created_at: now,
    updated_at: now,
  }
}

function buildRowPatch(row: PricingRow): UpdatePricingRowPatch {
  return {
    description_snapshot: row.description_snapshot,
    vendor_sku: row.vendor_sku,
    pricing_type: row.pricing_type,
    quantity: row.quantity,
    unit: row.unit,
    unit_price: row.unit_price,
    lead_days: row.lead_days,
    notes: row.notes,
    is_active: row.is_active,
  }
}

function applyEditableFields(base: PricingRow, source: PricingRow): PricingRow {
  return {
    ...base,
    description_snapshot: source.description_snapshot,
    vendor_sku: source.vendor_sku,
    pricing_type: source.pricing_type,
    quantity: source.quantity,
    unit: source.unit,
    unit_price: source.unit_price,
    lead_days: source.lead_days,
    notes: source.notes,
    is_active: source.is_active,
  }
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
    case 'pricing_type': {
      const next = parsePricingType(String(draftValue))
      return next ? { ...row, pricing_type: next } : row
    }
    case 'quantity':
      return { ...row, quantity: parseNullableNumber(String(draftValue)) }
    case 'unit': {
      const next = String(draftValue).trim()
      return { ...row, unit: next || null }
    }
    case 'unit_price':
      return { ...row, unit_price: parseNullableMoney(String(draftValue)) }
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
    a.pricing_type === b.pricing_type &&
    (a.quantity ?? null) === (b.quantity ?? null) &&
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
  onCreateRow,
}: {
  initialRows: PricingRow[]
  onPersistRow: (rowId: string, patch: UpdatePricingRowPatch) => Promise<PricingRow>
  onCreateRow: (draft: PricingRow) => Promise<PricingRow>
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
  const promotingRowsRef = useRef<Set<string>>(new Set())

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
    promotingRowsRef.current = new Set()
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

  function promoteDraftRow(draftId: string, requestRow: PricingRow, created: PricingRow) {
    const latestLocalRow = getLocalRow(draftId)
    const promotedBase = latestLocalRow && !areEqual(latestLocalRow, requestRow)
      ? applyEditableFields(created, latestLocalRow)
      : created

    replaceLocalRow(draftId, promotedBase)
    const nextServerRows = [...serverRowsRef.current, created]
    setServerRowsSync(nextServerRows)
    setRowSaveState((prev) => {
      const { [draftId]: _removed, ...rest } = prev
      return { ...rest, [created.id]: areEqual(promotedBase, created) ? 'idle' : 'dirty' }
    })
    setUndoStack((stack) =>
      stack.map((entry) =>
        entry.rowId === draftId ? { ...entry, rowId: created.id } : entry
      )
    )
    if (activeCellRef.current?.rowId === draftId) {
      const nextCell = { ...activeCellRef.current, rowId: created.id }
      setActiveCell(nextCell)
      activeCellRef.current = nextCell
    }
    if (!areEqual(promotedBase, created)) {
      scheduleFlush(created.id, 120)
    }
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
    if (!localRow) return
    if (isDraftRowId(rowId)) {
      setRowState(rowId, hasMeaningfulData(localRow) ? 'dirty' : 'idle')
      return
    }
    if (!serverRow) return
    setRowState(rowId, areEqual(localRow, serverRow) ? 'idle' : 'dirty')
  }

  async function flushRow(rowId: string) {
    const local = getLocalRow(rowId)

    if (!local) return
    if (savingRowsRef.current.has(rowId)) return

    if (isDraftRowId(rowId)) {
      if (!hasMeaningfulData(local)) {
        setRowState(rowId, 'idle')
        return
      }

      const requestRow = cloneRow(local)
      savingRowsRef.current.add(rowId)
      promotingRowsRef.current.add(rowId)
      setRowState(rowId, 'saving')

      try {
        const created = await onCreateRow(requestRow)
        promoteDraftRow(rowId, requestRow, created)
      } catch {
        setRowState(rowId, 'error')
      } finally {
        savingRowsRef.current.delete(rowId)
        promotingRowsRef.current.delete(rowId)
      }
      return
    }

    const server = getServerRow(rowId)
    if (!server) return

    if (areEqual(local, server)) {
      setRowState(rowId, 'idle')
      return
    }

    const requestRow = cloneRow(local)
    savingRowsRef.current.add(rowId)
    setRowState(rowId, 'saving')

    try {
      const updated = await onPersistRow(rowId, buildRowPatch(requestRow))

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
    if (!promotingRowsRef.current.has(rowId)) scheduleFlush(rowId)
    return next
  }

  function handleUndo() {
    setUndoStack((stack) => {
      const last = stack[stack.length - 1]
      if (!last) return stack
      if (promotingRowsRef.current.has(last.rowId)) return stack

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

  function appendDraftRow() {
    const draft = createDraftRow(localRowsRef.current.length)
    const nextLocalRows = [...localRowsRef.current, draft]
    setLocalRowsSync(nextLocalRows)
    setRowState(draft.id, 'idle')
    setActiveCell({ rowId: draft.id, field: 'description_snapshot' })
    setActiveDraft('')
    activeCellRef.current = { rowId: draft.id, field: 'description_snapshot' }
    activeDraftRef.current = ''
    return draft
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
    appendDraftRow,
    saveCounts,
  }
}
