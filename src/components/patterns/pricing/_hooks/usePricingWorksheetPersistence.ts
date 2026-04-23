'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentPricingAccess } from '@/app/actions/pricing-access-actions'
import { createClient } from '@/utils/supabase/client'
import { listCatalogItems } from '@/lib/pricing/catalog'
import { getPricingHeader, updatePricingHeader } from '@/lib/pricing/headers'
import { fetchPricingCompanies, fetchPricingCostCodes, fetchPricingTrades } from '@/lib/pricing/lookups'
import { createPricingHeaderRevision } from '@/lib/pricing/revisions'
import { createPricingRow, listPricingRowsForHeader, updatePricingRow } from '@/lib/pricing/rows'
import type {
  CatalogItem,
  PricingCompanyOption,
  PricingCostCodeOption,
  PricingHeader,
  PricingRow,
  PricingTradeOption,
  UpdatePricingRowPatch,
} from '@/lib/pricing/types'

function parseNullableNumber(value: string) {
  const trimmed = value.trim().replace(/[$,]/g, '')
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

type Props = {
  headerId: string
  detailBasePath: string
  missingLabel: string
  permissionRowKey: 'pricing_sources' | 'bids'
}

export function usePricingWorksheetPersistence({
  headerId,
  detailBasePath,
  missingLabel,
  permissionRowKey,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [access, setAccess] = useState<{
    canView: boolean
    canManage: boolean
    canAssign: boolean
    error?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [header, setHeader] = useState<PricingHeader | null>(null)
  const [loadedRows, setLoadedRows] = useState<PricingRow[]>([])
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [companies, setCompanies] = useState<PricingCompanyOption[]>([])
  const [trades, setTrades] = useState<PricingTradeOption[]>([])
  const [costCodes, setCostCodes] = useState<PricingCostCodeOption[]>([])

  const [savingHeader, setSavingHeader] = useState(false)
  const [creatingRow, setCreatingRow] = useState(false)
  const [creatingRevision, setCreatingRevision] = useState(false)

  const [headerTitle, setHeaderTitle] = useState('')
  const [headerStatus, setHeaderStatus] = useState('draft')
  const [headerEffectiveDate, setHeaderEffectiveDate] = useState('')
  const [headerNotes, setHeaderNotes] = useState('')
  const [headerIsActive, setHeaderIsActive] = useState(true)

  const [newDescription, setNewDescription] = useState('')
  const [newVendorSku, setNewVendorSku] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newUnitPrice, setNewUnitPrice] = useState('')
  const [newLeadDays, setNewLeadDays] = useState('')
  const [newNotes, setNewNotes] = useState('')

  async function loadPage() {
    if (!headerId) return

    setLoading(true)
    setError(null)

    try {
      const [headerRow, rowRows, companyRows, tradeRows, costCodeRows] = await Promise.all([
        getPricingHeader(supabase, headerId),
        listPricingRowsForHeader(supabase, headerId),
        fetchPricingCompanies(supabase),
        fetchPricingTrades(supabase),
        fetchPricingCostCodes(supabase),
      ])

      setHeader(headerRow)
      setLoadedRows(rowRows)
      setCompanies(companyRows)
      setTrades(tradeRows)
      setCostCodes(costCodeRows)

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
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : `Failed to load ${missingLabel.toLowerCase()}.`)
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

  async function persistRow(rowId: string, patch: UpdatePricingRowPatch) {
    return updatePricingRow(supabase, rowId, patch)
  }

  async function saveHeader() {
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
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to save header.')
    } finally {
      setSavingHeader(false)
    }
  }

  async function createRevision() {
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
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to create new revision.')
    } finally {
      setCreatingRevision(false)
    }
  }

  async function createRowRecord() {
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
        catalog_sku: null,
        description_snapshot: newDescription,
        vendor_sku: newVendorSku || null,
        unit: newUnit || null,
        unit_price: parseNullableNumber(newUnitPrice),
        lead_days: parseNullableNumber(newLeadDays),
        notes: newNotes || null,
      })

      setNewDescription('')
      setNewVendorSku('')
      setNewUnit('')
      setNewUnitPrice('')
      setNewLeadDays('')
      setNewNotes('')

      return created
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to add row.')
      return null
    } finally {
      setCreatingRow(false)
    }
  }

  return {
    access,
    loading,
    error,
    setError,
    header,
    loadedRows,
    catalogItems,
    companies,
    trades,
    costCodes,
    savingHeader,
    creatingRow,
    creatingRevision,
    headerTitle,
    headerStatus,
    headerEffectiveDate,
    headerNotes,
    headerIsActive,
    setHeaderTitle,
    setHeaderStatus,
    setHeaderEffectiveDate,
    setHeaderNotes,
    setHeaderIsActive,
    newDescription,
    newVendorSku,
    newUnit,
    newUnitPrice,
    newLeadDays,
    newNotes,
    setNewDescription,
    setNewVendorSku,
    setNewUnit,
    setNewUnitPrice,
    setNewLeadDays,
    setNewNotes,
    saveHeader,
    createRevision,
    createRowRecord,
    persistRow,
    reload: loadPage,
  }
}
