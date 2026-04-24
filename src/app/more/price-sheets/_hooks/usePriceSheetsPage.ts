'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentPricingAccess } from '@/app/actions/pricing-access-actions'
import { createClient } from '@/utils/supabase/client'
import { createPricingHeader, listPricingHeaders } from '@/lib/pricing/headers'
import { fetchPricingCompanies, fetchPricingCostCodes, fetchPricingTrades } from '@/lib/pricing/lookups'
import type {
  PricingCompanyOption,
  PricingCostCodeOption,
  PricingHeader,
  PricingTradeOption,
} from '@/lib/pricing/types'

export function usePriceSheetsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [headers, setHeaders] = useState<PricingHeader[]>([])
  const [companies, setCompanies] = useState<PricingCompanyOption[]>([])
  const [trades, setTrades] = useState<PricingTradeOption[]>([])
  const [costCodes, setCostCodes] = useState<PricingCostCodeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showAdd, setShowAdd] = useState(false)

  const [companyId, setCompanyId] = useState('')
  const [tradeId, setTradeId] = useState('')
  const [costCodeId, setCostCodeId] = useState('')
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState('draft')
  const [notes, setNotes] = useState('')

  const [access, setAccess] = useState<{
    canView: boolean
    canManage: boolean
    canAssign: boolean
    error?: string
  } | null>(null)

  async function loadPage() {
    setLoading(true)
    setError(null)

    try {
      const [headerRows, companyRows, tradeRows, costCodeRows] = await Promise.all([
        listPricingHeaders(supabase, { kind: 'price_sheet' }),
        fetchPricingCompanies(supabase),
        fetchPricingTrades(supabase),
        fetchPricingCostCodes(supabase),
      ])

      setHeaders(headerRows)
      setCompanies(companyRows)
      setTrades(tradeRows)
      setCostCodes(costCodeRows)

      if (!companyId && companyRows[0]) setCompanyId(companyRows[0].id)
      if (!tradeId && tradeRows[0]) setTradeId(tradeRows[0].id)
      if (!costCodeId && costCodeRows[0]) setCostCodeId(costCodeRows[0].id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load price sheets.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function initialize() {
      const accessResult = await getCurrentPricingAccess('pricing_sources')
      setAccess(accessResult)

      if (!accessResult.canView) {
        setLoading(false)
        setError(accessResult.error || 'Pricing Sources access required.')
        return
      }

      await loadPage()
    }

    void initialize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!tradeId) return
    const available = costCodes.filter((row) => !row.trade_id || row.trade_id === tradeId)
    if (available.length === 0) {
      setCostCodeId('')
      return
    }
    if (!available.some((row) => row.id === costCodeId)) {
      setCostCodeId(available[0].id)
    }
  }, [tradeId, costCodes, costCodeId])

  const companyMap = useMemo(
    () => new Map(companies.map((row) => [row.id, row.company_name])),
    [companies]
  )

  const tradeMap = useMemo(
    () => new Map(trades.map((row) => [row.id, row.name])),
    [trades]
  )

  const costCodeMap = useMemo(
    () => new Map(costCodes.map((row) => [row.id, `${row.cost_code} · ${row.title}`])),
    [costCodes]
  )

  const filteredCostCodes = useMemo(
    () => costCodes.filter((row) => !tradeId || !row.trade_id || row.trade_id === tradeId),
    [costCodes, tradeId]
  )

  const filteredHeaders = useMemo(() => {
    let rows = headers

    if (statusFilter === 'active') rows = rows.filter((row) => row.is_active)
    if (statusFilter === 'inactive') rows = rows.filter((row) => !row.is_active)

    const q = search.trim().toLowerCase()
    if (!q) return rows

    return rows.filter((row) => {
      const company = companyMap.get(row.company_id)?.toLowerCase() ?? ''
      const trade = tradeMap.get(row.trade_id)?.toLowerCase() ?? ''
      const costCode = costCodeMap.get(row.cost_code_id)?.toLowerCase() ?? ''

      return (
        row.title.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q) ||
        company.includes(q) ||
        trade.includes(q) ||
        costCode.includes(q)
      )
    })
  }, [headers, statusFilter, search, companyMap, tradeMap, costCodeMap])

  async function handleCreate() {
    if (!access?.canManage) {
      setError('Manage access required.')
      return
    }

    if (!companyId || !tradeId || !costCodeId) {
      setError('Company, trade, and cost code are required.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const header = await createPricingHeader(supabase, {
        kind: 'price_sheet',
        company_id: companyId,
        trade_id: tradeId,
        cost_code_id: costCodeId,
        title: title.trim() || null,
        status,
        notes: notes.trim() || null,
      })

      setShowAdd(false)
      setTitle('')
      setStatus('draft')
      setNotes('')

      await loadPage()
      router.push(`/more/price-sheets/${header.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create price sheet.')
    } finally {
      setSaving(false)
    }
  }

  return {
    headers: filteredHeaders,
    companies,
    trades,
    costCodes: filteredCostCodes,
    loading,
    saving,
    error,
    access,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    showAdd,
    setShowAdd,
    companyId,
    setCompanyId,
    tradeId,
    setTradeId,
    costCodeId,
    setCostCodeId,
    title,
    setTitle,
    status,
    setStatus,
    notes,
    setNotes,
    handleCreate,
    companyMap,
    tradeMap,
    costCodeMap,
  }
}
