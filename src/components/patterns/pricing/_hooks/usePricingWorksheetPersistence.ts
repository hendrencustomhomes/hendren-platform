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
  const [creatingRevision, setCreatingRevision] = useState(false)

  const [headerTitle, setHeaderTitle] = useState('')
  const [headerStatus, setHeaderStatus] = useState('draft')
  const [headerEffectiveDate, setHeaderEffectiveDate] = useState('')
  const [headerNotes, setHeaderNotes] = useState('')
  const [headerIsActive, setHeaderIsActive] = useState(true)

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

  async function createRowFromDraft(draft: PricingRow) {
    if (!access?.canManage) {
      throw new Error('Manage access required.')
    }
    if (!header) throw new Error(`${missingLabel} is required.`)

    return createPricingRow(supabase, {
      pricing_header_id: header.id,
      catalog_sku: draft.catalog_sku,
      description_snapshot: draft.description_snapshot,
      vendor_sku: draft.vendor_sku,
      quantity: draft.quantity,
      unit: draft.unit,
      unit_price: draft.unit_price,
      lead_days: draft.lead_days,
      notes: draft.notes,
      is_active: draft.is_active,
    })
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
    saveHeader,
    createRevision,
    createRowFromDraft,
    persistRow,
    reload: loadPage,
  }
}
