'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentPricingAccess } from '@/app/actions/pricing-access-actions'
import { ErrorMessage } from '@/components/feedback/ErrorMessage'
import { EmptyState } from '@/components/feedback/EmptyState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageShell } from '@/components/layout/PageShell'
import { Card } from '@/components/ui/Card'
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
import { PricingWorksheetGrid } from './PricingWorksheetGrid'
import { PricingWorksheetHeader } from './PricingWorksheetHeader'
import { PricingWorksheetMetaBar } from './PricingWorksheetMetaBar'
import { PricingWorksheetMobileList } from './PricingWorksheetMobileList'
import { PricingWorksheetNewRowBar } from './PricingWorksheetNewRowBar'

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

type Props = {
  headerId: string
  backHref: string
  detailBasePath: string
  navFallbackTitle: string
  missingLabel: string
  permissionRowKey: 'pricing_sources' | 'bids'
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
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
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

  function handleCheckboxKeyDown(event: ReactKeyboardEvent<HTMLInputElement>, rowId: string) {
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
    if (!newDescription.trim()) {
      setError('Description is required.')
      return null
    }

    setCreatingRow(true)
    setError(null)

    try {
      const created = await createPricingRow(supabase, {
        pricing_header_id: header.id,
        catalog_sku: newCatalogSku || null,
        description_snapshot: newDescription,
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
    event: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>,
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
      <PageShell title={navFallbackTitle} back={backHref}>
        <LoadingState />
      </PageShell>
    )
  }

  if (!loading && access && !access.canView) {
    return (
      <PageShell title={navFallbackTitle} back={backHref}>
        <EmptyState message={`${missingLabel} access required.`} />
      </PageShell>
    )
  }

  if (error && !header) {
    return (
      <PageShell title={navFallbackTitle} back={backHref}>
        <ErrorMessage error={error} />
      </PageShell>
    )
  }

  if (!header) {
    return (
      <PageShell title={navFallbackTitle} back={backHref}>
        <EmptyState message={`${missingLabel} not found.`} />
      </PageShell>
    )
  }

  return (
    <PageShell title={header.title} back={backHref}>
      <ErrorMessage error={error} />

      <PricingWorksheetHeader
        header={header}
        missingLabel={missingLabel}
        companyName={companyMap.get(header.company_id)}
        tradeName={tradeMap.get(header.trade_id)}
        costCodeLabel={costCodeMap.get(header.cost_code_id)}
        canManage={Boolean(access?.canManage)}
        savingHeader={savingHeader}
        creatingRevision={creatingRevision}
        title={headerTitle}
        status={headerStatus}
        effectiveDate={headerEffectiveDate}
        notes={headerNotes}
        isActive={headerIsActive}
        onTitleChange={setHeaderTitle}
        onStatusChange={setHeaderStatus}
        onEffectiveDateChange={setHeaderEffectiveDate}
        onNotesChange={setHeaderNotes}
        onIsActiveChange={setHeaderIsActive}
        onSaveHeader={handleSaveHeader}
        onCreateRevision={handleCreateRevision}
      />

      <Card>
        <PricingWorksheetMetaBar
          rowCount={localRows.length}
          hasActiveCell={Boolean(activeCell)}
          isVirtualized={shouldVirtualizeDesktop}
          saveCounts={saveCounts}
        />

        <PricingWorksheetNewRowBar
          canManage={Boolean(access?.canManage)}
          catalogItems={catalogItems}
          newCatalogSku={newCatalogSku}
          newDescription={newDescription}
          newVendorSku={newVendorSku}
          newUnit={newUnit}
          newUnitPrice={newUnitPrice}
          newLeadDays={newLeadDays}
          newNotes={newNotes}
          creatingRow={creatingRow}
          onCatalogSkuChange={applyCatalogDefaults}
          onDescriptionChange={setNewDescription}
          onVendorSkuChange={setNewVendorSku}
          onUnitChange={setNewUnit}
          onUnitPriceChange={setNewUnitPrice}
          onLeadDaysChange={setNewLeadDays}
          onNotesChange={setNewNotes}
          onKeyDown={handleNewRowKeyDown}
          onCreateRow={handleCreateRow}
        />

        {localRows.length === 0 ? (
          <EmptyState message="No pricing rows yet." />
        ) : !isMobileViewport ? (
          <PricingWorksheetGrid
            canManage={Boolean(access?.canManage)}
            shouldVirtualize={shouldVirtualizeDesktop}
            tableScrollContainerRef={tableScrollContainerRef}
            desktopVisibleRange={desktopVisibleRange}
            costCodeMap={costCodeMap}
            activeCell={activeCell}
            activeDraft={activeDraft}
            cellRefs={cellRefs}
            onTableScrollTopChange={setTableScrollTop}
            onTextCellFocus={handleTextCellFocus}
            onTextCellBlur={handleTextCellBlur}
            onTextCellKeyDown={handleTextCellKeyDown}
            onTextCellDraftChange={(value) => {
              setActiveDraft(value)
              activeDraftRef.current = value
            }}
            onCheckboxFocus={handleCheckboxFocus}
            onCheckboxBlur={handleCheckboxBlur}
            onCheckboxKeyDown={handleCheckboxKeyDown}
            onCheckboxCommit={(rowId, nextValue) => {
              setActiveCell({ rowId, field: 'is_active' })
              setActiveDraft(nextValue)
              activeCellRef.current = { rowId, field: 'is_active' }
              activeDraftRef.current = nextValue
              commitCellValue(rowId, 'is_active', nextValue)
            }}
            getRenderedCellValue={getRenderedCellValue}
            getRowStatusLabel={getRowStatusLabel}
          />
        ) : (
          <div style={{ padding: '12px', paddingTop: '14px' }}>
            <PricingWorksheetMobileList rows={localRows} getRowStatusLabel={getRowStatusLabel} />
          </div>
        )}
      </Card>
    </PageShell>
  )
}
