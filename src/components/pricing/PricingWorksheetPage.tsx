'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import { getCurrentPricingAccess } from '@/app/actions/pricing-access-actions'
import { createClient } from '@/utils/supabase/client'
import {
  createPricingHeaderRevision,
  createPricingRow,
  fetchPricingCompanies,
  fetchPricingCostCodes,
  fetchPricingTrades,
  getPricingHeader,
  listCatalogItems,
  listPricingRowsForHeader,
  updatePricingHeader,
  updatePricingRow,
} from '@/lib/pricing-sources'
import type {
  CatalogItem,
  PricingCompanyOption,
  PricingCostCodeOption,
  PricingHeader,
  PricingRow,
  PricingTradeOption,
} from '@/lib/pricing-sources-types'

const sectionCardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '18px',
  overflow: 'hidden',
} as const

const sectionHeaderStyle = {
  padding: '14px 16px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
} as const

const sectionTitleStyle = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--text)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
} as const

const inputStyle = {
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
} as const

const cellInputStyle = {
  width: '100%',
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '8px 10px',
  color: 'var(--text)',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box' as const,
} as const

const fieldsetResetStyle = {
  border: 'none',
  padding: 0,
  margin: 0,
  minWidth: 0,
} as const

const editableCellOrder = [
  'description_snapshot',
  'vendor_sku',
  'unit',
  'unit_price',
  'lead_days',
  'is_active',
  'notes',
] as const

const virtualRowHeight = 70
const virtualOverscan = 8
const virtualMaxBodyHeight = 560
const virtualThreshold = 20

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

function metaPill(text: string, tone: 'default' | 'active' | 'warning' | 'danger' = 'default') {
  const color =
    tone === 'active'
      ? 'var(--blue)'
      : tone === 'warning'
        ? '#fbbf24'
        : tone === 'danger'
          ? '#fca5a5'
          : 'var(--text-muted)'

  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        color,
        border: '1px solid var(--border)',
        borderRadius: '999px',
        padding: '2px 8px',
      }}
    >
      {text}
    </span>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: '14px', color: 'var(--text)' }}>{value || '—'}</div>
    </div>
  )
}

function formatMoney(value: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function parseNullableNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function getEditableCellValue(row: PricingRow, field: EditableCellKey): CellDraftValue {
  switch (field) {
    case 'description_snapshot':
      return row.description_snapshot
    case 'vendor_sku':
      return row.vendor_sku ?? ''
    case 'unit':
      return row.unit ?? ''
    case 'unit_price':
      return row.unit_price == null ? '' : String(row.unit_price)
    case 'lead_days':
      return row.lead_days == null ? '' : String(row.lead_days)
    case 'notes':
      return row.notes ?? ''
    case 'is_active':
      return row.is_active
    default:
      return ''
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

function areRowEditableValuesEqual(a: PricingRow | null | undefined, b: PricingRow | null | undefined) {
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

function cloneRow(row: PricingRow): PricingRow {
  return { ...row }
}

function getCellDomKey(rowId: string, field: EditableCellKey) {
  return `${rowId}:${field}`
}

type Props = {
  headerId: string
  backHref: string
  detailBasePath: string
  navFallbackTitle: string
  missingLabel: string
  permissionRowKey: 'pricing_sources' | 'bids'
}

export default function PricingWorksheetPage({
  headerId,
  backHref,
  detailBasePath,
  navFallbackTitle,
  missingLabel,
  permissionRowKey,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [header, setHeader] = useState<PricingHeader | null>(null)
  const [serverRows, setServerRows] = useState<PricingRow[]>([])
  const [localRows, setLocalRows] = useState<PricingRow[]>([])
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [companies, setCompanies] = useState<PricingCompanyOption[]>([])
  const [trades, setTrades] = useState<PricingTradeOption[]>([])
  const [costCodes, setCostCodes] = useState<PricingCostCodeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingHeader, setSavingHeader] = useState(false)
  const [creatingRow, setCreatingRow] = useState(false)
  const [creatingRevision, setCreatingRevision] = useState(false)
  const [access, setAccess] = useState<{
    canView: boolean
    canManage: boolean
    canAssign: boolean
    error?: string
  } | null>(null)

  const [headerTitle, setHeaderTitle] = useState('')
  const [headerStatus, setHeaderStatus] = useState('draft')
  const [headerEffectiveDate, setHeaderEffectiveDate] = useState('')
  const [headerNotes, setHeaderNotes] = useState('')
  const [headerIsActive, setHeaderIsActive] = useState(true)

  const [newCatalogSku, setNewCatalogSku] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newVendorSku, setNewVendorSku] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newUnitPrice, setNewUnitPrice] = useState('')
  const [newLeadDays, setNewLeadDays] = useState('')
  const [newNotes, setNewNotes] = useState('')

  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const [activeDraft, setActiveDraft] = useState<CellDraftValue | null>(null)
  const [rowSaveState, setRowSaveState] = useState<Record<string, RowSaveState>>({})
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [tableScrollTop, setTableScrollTop] = useState(0)
  const [tableViewportHeight, setTableViewportHeight] = useState(virtualMaxBodyHeight)

  const localRowsRef = useRef<PricingRow[]>([])
  const serverRowsRef = useRef<PricingRow[]>([])
  const activeCellRef = useRef<ActiveCell | null>(null)
  const activeDraftRef = useRef<CellDraftValue | null>(null)
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const savingRowsRef = useRef<Set<string>>(new Set())
  const cellRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})
  const tableScrollContainerRef = useRef<HTMLDivElement | null>(null)
  const pendingFocusRef = useRef<ActiveCell | null>(null)

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
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const syncViewportMode = () => {
      setIsMobileViewport(mediaQuery.matches)
    }

    syncViewportMode()
    mediaQuery.addEventListener('change', syncViewportMode)

    return () => {
      mediaQuery.removeEventListener('change', syncViewportMode)
    }
  }, [])

  const companyMap = useMemo(
    () => new Map(companies.map((row) => [row.id, row.company_name])),
    [companies]
  )
  const tradeMap = useMemo(() => new Map(trades.map((row) => [row.id, row.name])), [trades])
  const costCodeMap = useMemo(
    () => new Map(costCodes.map((row) => [row.id, `${row.cost_code} · ${row.title}`])),
    [costCodes]
  )
  const catalogMap = useMemo(
    () => new Map(catalogItems.map((row) => [row.catalog_sku, row])),
    [catalogItems]
  )

  const saveCounts = useMemo(() => {
    return localRows.reduce(
      (acc, row) => {
        const state = rowSaveState[row.id] ?? 'idle'
        if (state === 'saving') acc.saving += 1
        else if (state === 'dirty') acc.dirty += 1
        else if (state === 'error') acc.error += 1
        return acc
      },
      { saving: 0, dirty: 0, error: 0 }
    )
  }, [localRows, rowSaveState])

  const shouldVirtualizeDesktop = !isMobileViewport && localRows.length > virtualThreshold

  const desktopVisibleRange = useMemo(() => {
    if (!shouldVirtualizeDesktop) {
      return {
        rows: localRows,
        startIndex: 0,
        endIndex: Math.max(0, localRows.length - 1),
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      }
    }

    const viewportHeight = Math.max(tableViewportHeight, virtualRowHeight)
    const startIndex = Math.max(0, Math.floor(tableScrollTop / virtualRowHeight) - virtualOverscan)
    const visibleCount = Math.ceil(viewportHeight / virtualRowHeight) + virtualOverscan * 2
    const endIndex = Math.min(localRows.length - 1, startIndex + visibleCount - 1)

    return {
      rows: localRows.slice(startIndex, endIndex + 1),
      startIndex,
      endIndex,
      topSpacerHeight: startIndex * virtualRowHeight,
      bottomSpacerHeight: Math.max(0, (localRows.length - endIndex - 1) * virtualRowHeight),
    }
  }, [localRows, shouldVirtualizeDesktop, tableScrollTop, tableViewportHeight])

  useEffect(() => {
    if (isMobileViewport) {
      setTableScrollTop(0)
      return
    }

    const node = tableScrollContainerRef.current
    if (!node) return

    const updateViewportHeight = () => {
      setTableViewportHeight(node.clientHeight || virtualMaxBodyHeight)
    }

    updateViewportHeight()

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      updateViewportHeight()
    })

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [isMobileViewport, localRows.length, shouldVirtualizeDesktop])

  useEffect(() => {
    const pendingFocus = pendingFocusRef.current
    if (!pendingFocus) return

    const element = cellRefs.current[getCellDomKey(pendingFocus.rowId, pendingFocus.field)]
    if (!element) return

    pendingFocusRef.current = null

    window.requestAnimationFrame(() => {
      element.focus()
      if (element instanceof HTMLInputElement && element.type !== 'checkbox') {
        element.select()
      }
      if (element instanceof HTMLTextAreaElement) {
        element.select()
      }
    })
  }, [desktopVisibleRange, isMobileViewport, localRows])

  function setServerRowsSync(nextRows: PricingRow[]) {
    serverRowsRef.current = nextRows
    setServerRows(nextRows)
  }

  function setLocalRowsSync(nextRows: PricingRow[]) {
    localRowsRef.current = nextRows
    setLocalRows(nextRows)
  }

  function replaceServerRow(rowId: string, nextRow: PricingRow) {
    const nextRows = serverRowsRef.current.map((row) => (row.id === rowId ? nextRow : row))
    setServerRowsSync(nextRows)
  }

  function replaceLocalRow(rowId: string, nextRow: PricingRow) {
    const nextRows = localRowsRef.current.map((row) => (row.id === rowId ? nextRow : row))
    setLocalRowsSync(nextRows)
  }

  function getLocalRow(rowId: string) {
    return localRowsRef.current.find((row) => row.id === rowId) ?? null
  }

  function getServerRow(rowId: string) {
    return serverRowsRef.current.find((row) => row.id === rowId) ?? null
  }

  function setRowState(rowId: string, state: RowSaveState) {
    setRowSaveState((current) => ({ ...current, [rowId]: state }))
  }

  function syncRowStateFromRows(rowId: string, row?: PricingRow | null) {
    const localRow = row ?? getLocalRow(rowId)
    const serverRow = getServerRow(rowId)
    if (!localRow || !serverRow) return
    setRowState(rowId, areRowEditableValuesEqual(localRow, serverRow) ? 'idle' : 'dirty')
  }

  async function flushRow(rowId: string) {
    const localRow = getLocalRow(rowId)
    const serverRow = getServerRow(rowId)

    if (!localRow || !serverRow) return
    if (savingRowsRef.current.has(rowId)) return

    if (areRowEditableValuesEqual(localRow, serverRow)) {
      setRowState(rowId, 'idle')
      return
    }

    const requestRow = cloneRow(localRow)
    savingRowsRef.current.add(rowId)
    setRowState(rowId, 'saving')

    try {
      const updated = await updatePricingRow(supabase, rowId, {
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
      if (latestLocalRow && areRowEditableValuesEqual(latestLocalRow, requestRow)) {
        replaceLocalRow(rowId, updated)
      }

      const refreshedLocal = getLocalRow(rowId)
      if (refreshedLocal && !areRowEditableValuesEqual(refreshedLocal, updated)) {
        setRowState(rowId, 'dirty')
        scheduleRowFlush(rowId, 220)
      } else {
        setRowState(rowId, 'idle')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save row.')
      setRowState(rowId, 'error')
    } finally {
      savingRowsRef.current.delete(rowId)
    }
  }

  function scheduleRowFlush(rowId: string, delay = 650) {
    if (saveTimersRef.current[rowId]) {
      clearTimeout(saveTimersRef.current[rowId])
    }

    saveTimersRef.current[rowId] = setTimeout(() => {
      void flushRow(rowId)
    }, delay)
  }

  function clearActiveCell() {
    setActiveCell(null)
    setActiveDraft(null)
    activeCellRef.current = null
    activeDraftRef.current = null
  }

  function focusCell(rowId: string, field: EditableCellKey) {
    const rowIndex = localRowsRef.current.findIndex((row) => row.id === rowId)
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

    if (!shouldVirtualizeDesktop) return

    const scrollContainer = tableScrollContainerRef.current
    if (!scrollContainer) return

    const rowTop = rowIndex * virtualRowHeight
    const rowBottom = rowTop + virtualRowHeight
    const viewportTop = scrollContainer.scrollTop
    const viewportBottom = viewportTop + tableViewportHeight
    let nextScrollTop = viewportTop

    if (rowTop < viewportTop) nextScrollTop = rowTop
    else if (rowBottom > viewportBottom) nextScrollTop = rowBottom - tableViewportHeight

    if (nextScrollTop !== viewportTop) {
      scrollContainer.scrollTop = nextScrollTop
      setTableScrollTop(nextScrollTop)
    }
  }

  function getNeighborCell(rowId: string, field: EditableCellKey, mode: 'left' | 'right' | 'up' | 'down') {
    const rowIndex = localRowsRef.current.findIndex((row) => row.id === rowId)
    const fieldIndex = editableCellOrder.findIndex((value) => value === field)

    if (rowIndex < 0 || fieldIndex < 0) return null

    if (mode === 'left') {
      if (fieldIndex > 0) return { rowId, field: editableCellOrder[fieldIndex - 1] }
      if (rowIndex > 0) {
        return {
          rowId: localRowsRef.current[rowIndex - 1].id,
          field: editableCellOrder[editableCellOrder.length - 1],
        }
      }
      return null
    }

    if (mode === 'right') {
      if (fieldIndex < editableCellOrder.length - 1) {
        return { rowId, field: editableCellOrder[fieldIndex + 1] }
      }
      if (rowIndex < localRowsRef.current.length - 1) {
        return { rowId: localRowsRef.current[rowIndex + 1].id, field: editableCellOrder[0] }
      }
      return null
    }

    if (mode === 'up') {
      if (rowIndex > 0) return { rowId: localRowsRef.current[rowIndex - 1].id, field }
      return null
    }

    if (rowIndex < localRowsRef.current.length - 1) {
      return { rowId: localRowsRef.current[rowIndex + 1].id, field }
    }

    return null
  }

  function commitCellValue(rowId: string, field: EditableCellKey, nextValue: CellDraftValue) {
    const currentRow = getLocalRow(rowId)
    if (!currentRow) return null

    const nextRow = applyEditableCellValue(currentRow, field, nextValue)
    if (areRowEditableValuesEqual(currentRow, nextRow)) return currentRow

    replaceLocalRow(rowId, nextRow)
    setUndoStack((current) => [
      ...current.slice(-39),
      { rowId, previousRow: cloneRow(currentRow), nextRow: cloneRow(nextRow) },
    ])

    if (activeCellRef.current?.rowId === rowId && activeCellRef.current.field === field) {
      setActiveDraft(getEditableCellValue(nextRow, field))
      activeDraftRef.current = getEditableCellValue(nextRow, field)
    }

    syncRowStateFromRows(rowId, nextRow)
    scheduleRowFlush(rowId)
    return nextRow
  }

  function abandonActiveCellDraft() {
    const currentActiveCell = activeCellRef.current
    if (!currentActiveCell) return

    const row = getLocalRow(currentActiveCell.rowId)
    if (!row) return

    const resetValue = getEditableCellValue(row, currentActiveCell.field)
    setActiveDraft(resetValue)
    activeDraftRef.current = resetValue
  }

  function commitActiveCell(options?: { move?: 'left' | 'right' | 'up' | 'down' }) {
    const currentActiveCell = activeCellRef.current
    if (!currentActiveCell) return

    const row = getLocalRow(currentActiveCell.rowId)
    if (!row) {
      clearActiveCell()
      return
    }

    const nextValue = activeDraftRef.current ?? getEditableCellValue(row, currentActiveCell.field)
    commitCellValue(currentActiveCell.rowId, currentActiveCell.field, nextValue)
    clearActiveCell()

    if (options?.move) {
      const neighbor = getNeighborCell(currentActiveCell.rowId, currentActiveCell.field, options.move)
      if (neighbor) {
        focusCell(neighbor.rowId, neighbor.field)
      }
    }
  }

  async function loadPage() {
    if (!headerId) return
    setLoading(true)
    setError(null)
    setTableScrollTop(0)

    Object.values(saveTimersRef.current).forEach((timer) => clearTimeout(timer))
    saveTimersRef.current = {}
    savingRowsRef.current = new Set()
    pendingFocusRef.current = null
    clearActiveCell()
    setUndoStack([])
    setRowSaveState({})

    try {
      const [headerRow, rowRows, companyRows, tradeRows, costCodeRows] = await Promise.all([
        getPricingHeader(supabase, headerId),
        listPricingRowsForHeader(supabase, headerId),
        fetchPricingCompanies(supabase),
        fetchPricingTrades(supabase),
        fetchPricingCostCodes(supabase),
      ])

      setHeader(headerRow)
      setServerRowsSync(rowRows)
      setLocalRowsSync(rowRows)
      setCompanies(companyRows)
      setTrades(tradeRows)
      setCostCodes(costCodeRows)
      setRowSaveState(Object.fromEntries(rowRows.map((row) => [row.id, 'idle' as RowSaveState])))

      if (headerRow) {
        const catalogRows = await listCatalogItems(supabase, {
          cost_code_id: headerRow.cost_code_id,
          is_active: true,
        })
        setCatalogItems(catalogRows)
        setHeaderTitle(headerRow.title)
        setHeaderStatus(headerRow.status)
        setHeaderEffectiveDate(headerRow.effective_date ?? '')
        setHeaderNotes(headerRow.notes ?? '')
        setHeaderIsActive(headerRow.is_active)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to load ${missingLabel.toLowerCase()}.`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function initialize() {
      const accessResult = await getCurrentPricingAccess(permissionRowKey)
      setAccess(accessResult)

      if (!accessResult.canView) {
        setLoading(false)
        setError(accessResult.error || `${missingLabel} access required.`)
        return
      }

      await loadPage()
    }

    void initialize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerId, permissionRowKey])

  function applyCatalogDefaults(catalogSku: string) {
    setNewCatalogSku(catalogSku)
    const item = catalogMap.get(catalogSku)
    if (!item) return
    setNewDescription(item.title)
    setNewUnit(item.default_unit ?? '')
  }

  function handleTextCellFocus(
    rowId: string,
    field: Exclude<EditableCellKey, 'is_active'>,
    element: HTMLInputElement | HTMLTextAreaElement
  ) {
    const row = getLocalRow(rowId)
    if (!row) return
    const value = getEditableCellValue(row, field)
    setActiveCell({ rowId, field })
    setActiveDraft(value)
    activeCellRef.current = { rowId, field }
    activeDraftRef.current = value
    element.select()
  }

  function handleTextCellBlur(rowId: string, field: Exclude<EditableCellKey, 'is_active'>) {
    const currentActiveCell = activeCellRef.current
    if (!currentActiveCell) return
    if (currentActiveCell.rowId !== rowId || currentActiveCell.field !== field) return
    commitActiveCell()
  }

  function handleTextCellKeyDown(
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    rowId: string,
    field: Exclude<EditableCellKey, 'is_active'>
  ) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      const row = getLocalRow(rowId)
      const localValue = row ? getEditableCellValue(row, field) : ''
      if (activeDraftRef.current !== localValue) {
        setActiveDraft(localValue)
        activeDraftRef.current = localValue
        return
      }
      handleUndo()
      return
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      commitActiveCell()
      void handleCreateRow()
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
      commitActiveCell({ move: event.shiftKey ? 'up' : 'down' })
    }
  }

  function handleCheckboxFocus(rowId: string) {
    const row = getLocalRow(rowId)
    if (!row) return
    setActiveCell({ rowId, field: 'is_active' })
    setActiveDraft(row.is_active)
    activeCellRef.current = { rowId, field: 'is_active' }
    activeDraftRef.current = row.is_active
  }

  function handleCheckboxBlur(rowId: string) {
    const currentActiveCell = activeCellRef.current
    if (!currentActiveCell) return
    if (currentActiveCell.rowId !== rowId || currentActiveCell.field !== 'is_active') return
    clearActiveCell()
  }

  function handleCheckboxKeyDown(event: React.KeyboardEvent<HTMLInputElement>, rowId: string) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      handleUndo()
      return
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      void handleCreateRow()
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      const neighbor = getNeighborCell(rowId, 'is_active', event.shiftKey ? 'left' : 'right')
      if (neighbor) focusCell(neighbor.rowId, neighbor.field)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const neighbor = getNeighborCell(rowId, 'is_active', event.shiftKey ? 'up' : 'down')
      if (neighbor) focusCell(neighbor.rowId, neighbor.field)
      return
    }
  }

  function getRenderedCellValue(row: PricingRow, field: EditableCellKey): CellDraftValue {
    if (activeCell?.rowId === row.id && activeCell.field === field && activeDraft != null) {
      return activeDraft
    }
    return getEditableCellValue(row, field)
  }

  async function handleSaveHeader() {
    if (!access?.canManage) {
      setError('Manage access required.')
      return
    }
    if (!header) return
    setSavingHeader(true)
    setError(null)
    try {
      const updated = await updatePricingHeader(supabase, header.id, {
        title: headerTitle,
        status: headerStatus,
        effective_date: headerEffectiveDate || null,
        notes: headerNotes || null,
        is_active: headerIsActive,
      })
      setHeader(updated)
      setHeaderTitle(updated.title)
      setHeaderStatus(updated.status)
      setHeaderEffectiveDate(updated.effective_date ?? '')
      setHeaderNotes(updated.notes ?? '')
      setHeaderIsActive(updated.is_active)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save header.')
    } finally {
      setSavingHeader(false)
    }
  }

  async function handleCreateRevision() {
    if (!access?.canManage) {
      setError('Manage access required.')
      return
    }
    if (!header) return
    setCreatingRevision(true)
    setError(null)
    try {
      const result = await createPricingHeaderRevision(supabase, header.id)
      router.push(`${detailBasePath}/${result.header.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create new revision.')
    } finally {
      setCreatingRevision(false)
    }
  }

  async function handleCreateRow() {
    if (!access?.canManage) {
      setError('Manage access required.')
      return null
    }
    if (!header) return null
    if (!newCatalogSku) {
      setError('Catalog item is required.')
      return null
    }

    setCreatingRow(true)
    setError(null)

    try {
      const created = await createPricingRow(supabase, {
        pricing_header_id: header.id,
        catalog_sku: newCatalogSku,
        description_snapshot: newDescription || null,
        vendor_sku: newVendorSku || null,
        unit: newUnit || null,
        unit_price: parseNullableNumber(newUnitPrice),
        lead_days: parseNullableNumber(newLeadDays),
        notes: newNotes || null,
      })

      const nextRows = [...localRowsRef.current, created]
      setLocalRowsSync(nextRows)
      setServerRowsSync([...serverRowsRef.current, created])
      setRowState(created.id, 'idle')

      setNewCatalogSku('')
      setNewDescription('')
      setNewVendorSku('')
      setNewUnit('')
      setNewUnitPrice('')
      setNewLeadDays('')
      setNewNotes('')

      if (!isMobileViewport) {
        focusCell(created.id, 'description_snapshot')
      }

      return created
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add row.')
      return null
    } finally {
      setCreatingRow(false)
    }
  }

  function handleUndo() {
    setUndoStack((current) => {
      const last = current[current.length - 1]
      if (!last) return current

      replaceLocalRow(last.rowId, cloneRow(last.previousRow))
      syncRowStateFromRows(last.rowId, last.previousRow)
      scheduleRowFlush(last.rowId, 120)

      const currentActiveCell = activeCellRef.current
      if (currentActiveCell?.rowId === last.rowId) {
        const restoredValue = getEditableCellValue(last.previousRow, currentActiveCell.field)
        setActiveDraft(restoredValue)
        activeDraftRef.current = restoredValue
      }

      return current.slice(0, -1)
    })
  }

  function handleNewRowKeyDown(
    event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    onCommit?: () => void
  ) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      handleUndo()
      return
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      void handleCreateRow()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      onCommit?.()
      event.currentTarget.blur()
    }
  }

  function getRowStatusLabel(rowId: string) {
    const state = rowSaveState[rowId] ?? 'idle'
    if (state === 'saving') return { text: 'saving…', tone: 'default' as const }
    if (state === 'dirty') return { text: 'queued', tone: 'warning' as const }
    if (state === 'error') return { text: 'save failed', tone: 'danger' as const }
    return { text: 'saved', tone: 'active' as const }
  }

  if (loading) {
    return (
      <>
        <Nav title={navFallbackTitle} back={backHref} />
        <div style={{ padding: '20px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Loading…
        </div>
      </>
    )
  }

  if (!loading && access && !access.canView) {
    return (
      <>
        <Nav title={navFallbackTitle} back={backHref} />
        <div style={{ padding: '20px 16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {missingLabel} access required.
          </div>
        </div>
      </>
    )
  }

  if (error && !header) {
    return (
      <>
        <Nav title={navFallbackTitle} back={backHref} />
        <div style={{ padding: '20px 16px' }}>
          <div style={{ fontSize: '13px', color: '#fca5a5', marginBottom: '12px' }}>{error}</div>
          <button
            type="button"
            onClick={() => router.push(backHref)}
            style={{
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Back
          </button>
        </div>
      </>
    )
  }

  if (!header) {
    return (
      <>
        <Nav title={navFallbackTitle} back={backHref} />
        <div style={{ padding: '20px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
          {missingLabel} not found.
        </div>
      </>
    )
  }

  return (
    <>
      <Nav title={header.title} back={backHref} />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {error && <div style={{ fontSize: '13px', color: '#fca5a5' }}>{error}</div>}

        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Header</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {metaPill(`rev ${header.revision}`)}
              {metaPill(header.status)}
              {metaPill(header.is_active ? 'active' : 'inactive', header.is_active ? 'active' : 'warning')}
            </div>
          </div>

          <fieldset disabled={!access?.canManage} style={fieldsetResetStyle}>
            <div
              style={{
                padding: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '14px',
              }}
            >
              <div style={{ gridColumn: '1 / -1' }}>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '4px',
                  }}
                >
                  Title
                </div>
                <input value={headerTitle} onChange={(e) => setHeaderTitle(e.target.value)} style={inputStyle} />
              </div>
              <Field label="Company" value={companyMap.get(header.company_id)} />
              <Field label="Trade" value={tradeMap.get(header.trade_id)} />
              <Field label="Cost Code" value={costCodeMap.get(header.cost_code_id)} />
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '4px',
                  }}
                >
                  Status
                </div>
                <select value={headerStatus} onChange={(e) => setHeaderStatus(e.target.value)} style={inputStyle}>
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="superseded">superseded</option>
                  <option value="archived">archived</option>
                  <option value="received">received</option>
                </select>
              </div>
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '4px',
                  }}
                >
                  Effective Date
                </div>
                <input
                  type="date"
                  value={headerEffectiveDate}
                  onChange={(e) => setHeaderEffectiveDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={headerIsActive}
                    onChange={(e) => setHeaderIsActive(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  Active
                </label>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '4px',
                  }}
                >
                  Notes
                </div>
                <textarea
                  value={headerNotes}
                  onChange={(e) => setHeaderNotes(e.target.value)}
                  style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                />
              </div>
              <div
                style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Saving here edits the current {missingLabel.toLowerCase()}. Creating a new revision makes a separate updated {missingLabel.toLowerCase()} record.
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleCreateRevision}
                    disabled={creatingRevision}
                    style={{
                      background: 'transparent',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: creatingRevision ? 'not-allowed' : 'pointer',
                      opacity: creatingRevision ? 0.7 : 1,
                    }}
                  >
                    {creatingRevision ? 'Creating New Revision…' : 'Create New Revision'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveHeader}
                    disabled={savingHeader}
                    style={{
                      background: 'var(--text)',
                      color: 'var(--surface)',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: savingHeader ? 'not-allowed' : 'pointer',
                      opacity: savingHeader ? 0.7 : 1,
                    }}
                  >
                    {savingHeader ? 'Saving Current Sheet…' : 'Save Current Sheet'}
                  </button>
                </div>
              </div>
            </div>
          </fieldset>
        </div>

        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Worksheet</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {metaPill(`${localRows.length} ${localRows.length === 1 ? 'row' : 'rows'}`)}
              {activeCell ? metaPill('active cell', 'active') : null}
              {shouldVirtualizeDesktop ? metaPill('virtualized', 'active') : null}
              {saveCounts.dirty > 0 ? metaPill(`${saveCounts.dirty} queued`, 'warning') : null}
              {saveCounts.saving > 0 ? metaPill(`${saveCounts.saving} saving`, 'default') : null}
              {saveCounts.error > 0 ? metaPill(`${saveCounts.error} failed`, 'danger') : null}
            </div>
          </div>

          <fieldset disabled={!access?.canManage} style={fieldsetResetStyle}>
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 1.2fr) repeat(6, minmax(110px, 1fr))',
                gap: '8px',
                overflowX: 'auto',
              }}
            >
              <select
                value={newCatalogSku}
                onChange={(e) => applyCatalogDefaults(e.target.value)}
                onKeyDown={(e) => handleNewRowKeyDown(e)}
                style={cellInputStyle}
              >
                <option value="">Select catalog item</option>
                {catalogItems.map((item) => (
                  <option key={item.catalog_sku} value={item.catalog_sku}>
                    {item.catalog_sku} · {item.title}
                  </option>
                ))}
              </select>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => handleNewRowKeyDown(e)}
                placeholder="Description"
                style={cellInputStyle}
              />
              <input
                value={newVendorSku}
                onChange={(e) => setNewVendorSku(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => handleNewRowKeyDown(e)}
                placeholder="Vendor SKU"
                style={cellInputStyle}
              />
              <input
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => handleNewRowKeyDown(e)}
                placeholder="Unit"
                style={cellInputStyle}
              />
              <input
                value={newUnitPrice}
                onChange={(e) => setNewUnitPrice(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => handleNewRowKeyDown(e)}
                inputMode="decimal"
                placeholder="Unit price"
                style={cellInputStyle}
              />
              <input
                value={newLeadDays}
                onChange={(e) => setNewLeadDays(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => handleNewRowKeyDown(e)}
                inputMode="numeric"
                placeholder="Lead days"
                style={cellInputStyle}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) =>
                    handleNewRowKeyDown(e, () => {
                      void handleCreateRow()
                    })
                  }
                  placeholder="Notes"
                  style={cellInputStyle}
                />
                <button
                  type="button"
                  onClick={() => void handleCreateRow()}
                  disabled={creatingRow}
                  style={{
                    background: 'var(--text)',
                    color: 'var(--surface)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: creatingRow ? 'not-allowed' : 'pointer',
                    opacity: creatingRow ? 0.7 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {creatingRow ? 'Adding…' : 'Add'}
                </button>
              </div>
            </div>
          </fieldset>

          {localRows.length === 0 ? (
            <div style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
              No pricing rows yet.
            </div>
          ) : !isMobileViewport ? (
            <fieldset disabled={!access?.canManage} style={fieldsetResetStyle}>
              <div style={{ overflowX: 'auto' }}>
                <div
                  ref={tableScrollContainerRef}
                  onScroll={(event) => {
                    if (!shouldVirtualizeDesktop) return
                    setTableScrollTop(event.currentTarget.scrollTop)
                  }}
                  style={{
                    overflowY: shouldVirtualizeDesktop ? 'auto' : 'visible',
                    maxHeight: shouldVirtualizeDesktop ? `${virtualMaxBodyHeight}px` : undefined,
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1180px' }}>
                    <thead>
                      <tr>
                        {[
                          'Source SKU',
                          'Catalog SKU',
                          'Description',
                          'Vendor SKU',
                          'Unit',
                          'Unit Price',
                          'Lead Days',
                          'Active',
                          'Notes',
                          'Cost Code',
                        ].map((label) => (
                          <th
                            key={label}
                            style={{
                              textAlign: 'left',
                              fontSize: '11px',
                              textTransform: 'uppercase',
                              letterSpacing: '.04em',
                              color: 'var(--text-muted)',
                              padding: '12px 14px',
                              borderBottom: '1px solid var(--border)',
                              whiteSpace: 'nowrap',
                              position: shouldVirtualizeDesktop ? 'sticky' : 'static',
                              top: 0,
                              background: 'var(--surface)',
                              zIndex: 1,
                            }}
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shouldVirtualizeDesktop && desktopVisibleRange.topSpacerHeight > 0 ? (
                        <tr aria-hidden="true">
                          <td colSpan={10} style={{ padding: 0, height: `${desktopVisibleRange.topSpacerHeight}px`, borderBottom: 'none' }} />
                        </tr>
                      ) : null}

                      {desktopVisibleRange.rows.map((row) => {
                        const rowStatus = getRowStatusLabel(row.id)
                        return (
                          <tr key={row.id} style={{ height: `${virtualRowHeight}px` }}>
                            <td
                              style={{
                                padding: '12px 14px',
                                borderBottom: '1px solid var(--border)',
                                fontSize: '13px',
                                whiteSpace: 'nowrap',
                                verticalAlign: 'middle',
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>{row.source_sku}</div>
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: rowStatus.tone === 'danger' ? '#fca5a5' : 'var(--text-muted)',
                                }}
                              >
                                {rowStatus.text}
                              </div>
                            </td>
                            <td
                              style={{
                                padding: '12px 14px',
                                borderBottom: '1px solid var(--border)',
                                fontSize: '13px',
                                whiteSpace: 'nowrap',
                                verticalAlign: 'middle',
                              }}
                            >
                              {row.catalog_sku}
                            </td>
                            <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                              <input
                                ref={(element) => {
                                  cellRefs.current[getCellDomKey(row.id, 'description_snapshot')] = element
                                }}
                                value={String(getRenderedCellValue(row, 'description_snapshot'))}
                                onFocus={(e) => handleTextCellFocus(row.id, 'description_snapshot', e.currentTarget)}
                                onChange={(e) => {
                                  setActiveDraft(e.target.value)
                                  activeDraftRef.current = e.target.value
                                }}
                                onBlur={() => handleTextCellBlur(row.id, 'description_snapshot')}
                                onKeyDown={(e) => handleTextCellKeyDown(e, row.id, 'description_snapshot')}
                                style={cellInputStyle}
                              />
                            </td>
                            <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                              <input
                                ref={(element) => {
                                  cellRefs.current[getCellDomKey(row.id, 'vendor_sku')] = element
                                }}
                                value={String(getRenderedCellValue(row, 'vendor_sku'))}
                                onFocus={(e) => handleTextCellFocus(row.id, 'vendor_sku', e.currentTarget)}
                                onChange={(e) => {
                                  setActiveDraft(e.target.value)
                                  activeDraftRef.current = e.target.value
                                }}
                                onBlur={() => handleTextCellBlur(row.id, 'vendor_sku')}
                                onKeyDown={(e) => handleTextCellKeyDown(e, row.id, 'vendor_sku')}
                                style={cellInputStyle}
                              />
                            </td>
                            <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                              <input
                                ref={(element) => {
                                  cellRefs.current[getCellDomKey(row.id, 'unit')] = element
                                }}
                                value={String(getRenderedCellValue(row, 'unit'))}
                                onFocus={(e) => handleTextCellFocus(row.id, 'unit', e.currentTarget)}
                                onChange={(e) => {
                                  setActiveDraft(e.target.value)
                                  activeDraftRef.current = e.target.value
                                }}
                                onBlur={() => handleTextCellBlur(row.id, 'unit')}
                                onKeyDown={(e) => handleTextCellKeyDown(e, row.id, 'unit')}
                                style={cellInputStyle}
                              />
                            </td>
                            <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                              <input
                                ref={(element) => {
                                  cellRefs.current[getCellDomKey(row.id, 'unit_price')] = element
                                }}
                                value={String(getRenderedCellValue(row, 'unit_price'))}
                                onFocus={(e) => handleTextCellFocus(row.id, 'unit_price', e.currentTarget)}
                                onChange={(e) => {
                                  setActiveDraft(e.target.value)
                                  activeDraftRef.current = e.target.value
                                }}
                                onBlur={() => handleTextCellBlur(row.id, 'unit_price')}
                                onKeyDown={(e) => handleTextCellKeyDown(e, row.id, 'unit_price')}
                                inputMode="decimal"
                                style={cellInputStyle}
                              />
                            </td>
                            <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                              <input
                                ref={(element) => {
                                  cellRefs.current[getCellDomKey(row.id, 'lead_days')] = element
                                }}
                                value={String(getRenderedCellValue(row, 'lead_days'))}
                                onFocus={(e) => handleTextCellFocus(row.id, 'lead_days', e.currentTarget)}
                                onChange={(e) => {
                                  setActiveDraft(e.target.value)
                                  activeDraftRef.current = e.target.value
                                }}
                                onBlur={() => handleTextCellBlur(row.id, 'lead_days')}
                                onKeyDown={(e) => handleTextCellKeyDown(e, row.id, 'lead_days')}
                                inputMode="numeric"
                                style={cellInputStyle}
                              />
                            </td>
                            <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                              <label style={{ display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>
                                <input
                                  ref={(element) => {
                                    cellRefs.current[getCellDomKey(row.id, 'is_active')] = element
                                  }}
                                  type="checkbox"
                                  checked={Boolean(getRenderedCellValue(row, 'is_active'))}
                                  onFocus={() => handleCheckboxFocus(row.id)}
                                  onChange={(e) => {
                                    const nextValue = e.target.checked
                                    setActiveCell({ rowId: row.id, field: 'is_active' })
                                    setActiveDraft(nextValue)
                                    activeCellRef.current = { rowId: row.id, field: 'is_active' }
                                    activeDraftRef.current = nextValue
                                    commitCellValue(row.id, 'is_active', nextValue)
                                  }}
                                  onBlur={() => handleCheckboxBlur(row.id)}
                                  onKeyDown={(e) => handleCheckboxKeyDown(e, row.id)}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                              </label>
                            </td>
                            <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                              <textarea
                                ref={(element) => {
                                  cellRefs.current[getCellDomKey(row.id, 'notes')] = element
                                }}
                                value={String(getRenderedCellValue(row, 'notes'))}
                                onFocus={(e) => handleTextCellFocus(row.id, 'notes', e.currentTarget)}
                                onChange={(e) => {
                                  setActiveDraft(e.target.value)
                                  activeDraftRef.current = e.target.value
                                }}
                                onBlur={() => handleTextCellBlur(row.id, 'notes')}
                                onKeyDown={(e) => handleTextCellKeyDown(e, row.id, 'notes')}
                                rows={1}
                                style={{ ...cellInputStyle, resize: 'none', height: '38px', minHeight: '38px' }}
                              />
                            </td>
                            <td
                              style={{
                                padding: '12px 14px',
                                borderBottom: '1px solid var(--border)',
                                fontSize: '13px',
                                whiteSpace: 'nowrap',
                                verticalAlign: 'middle',
                              }}
                            >
                              {costCodeMap.get(row.cost_code_id) ?? '—'}
                            </td>
                          </tr>
                        )
                      })}

                      {shouldVirtualizeDesktop && desktopVisibleRange.bottomSpacerHeight > 0 ? (
                        <tr aria-hidden="true">
                          <td colSpan={10} style={{ padding: 0, height: `${desktopVisibleRange.bottomSpacerHeight}px`, borderBottom: 'none' }} />
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </fieldset>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', paddingTop: '14px' }}>
              {localRows.map((row) => {
                const rowStatus = getRowStatusLabel(row.id)
                return (
                  <div
                    key={`${row.id}-mobile`}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{row.source_sku}</div>
                        <div style={{ fontSize: '11px', color: rowStatus.tone === 'danger' ? '#fca5a5' : 'var(--text-muted)' }}>
                          {rowStatus.text}
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.catalog_sku}</div>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text)' }}>{row.description_snapshot}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                      <Field label="Vendor SKU" value={row.vendor_sku} />
                      <Field label="Unit" value={row.unit} />
                      <Field label="Unit Price" value={formatMoney(row.unit_price)} />
                      <Field label="Lead Days" value={row.lead_days == null ? '—' : String(row.lead_days)} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
