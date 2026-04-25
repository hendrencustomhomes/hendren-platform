'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { listCatalogItems, createCatalogItem } from '@/lib/pricing/catalog'
import { fetchPricingCostCodes, fetchPricingTrades } from '@/lib/pricing/lookups'
import { getCurrentPricingAccess } from '@/app/actions/pricing-access-actions'
import type { CatalogItem, PricingCostCodeOption, PricingTradeOption } from '@/lib/pricing/types'

type CatalogItemWithSourceCount = CatalogItem & { source_count: number }

export function useCatalogPage() {
  const supabase = createClient()

  const [items, setItems] = useState<CatalogItemWithSourceCount[]>([])
  const [trades, setTrades] = useState<PricingTradeOption[]>([])
  const [costCodes, setCostCodes] = useState<PricingCostCodeOption[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [tradeId, setTradeId] = useState('')
  const [costCodeId, setCostCodeId] = useState('')
  const [defaultUnit, setDefaultUnit] = useState('')
  const [access, setAccess] = useState<{
    canView: boolean
    canManage: boolean
    canAssign: boolean
    error?: string
  } | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [rows, tradeRows, costCodeRows, sourceRowsResult] = await Promise.all([
        listCatalogItems(supabase),
        fetchPricingTrades(supabase),
        fetchPricingCostCodes(supabase),
        supabase.from('pricing_rows').select('catalog_sku').not('catalog_sku', 'is', null),
      ])

      if (sourceRowsResult.error) throw sourceRowsResult.error

      const sourceCounts = new Map<string, number>()
      for (const sourceRow of sourceRowsResult.data ?? []) {
        const sku = String(sourceRow.catalog_sku ?? '')
        if (!sku) continue
        sourceCounts.set(sku, (sourceCounts.get(sku) ?? 0) + 1)
      }

      setItems(rows.map((row) => ({ ...row, source_count: sourceCounts.get(row.catalog_sku) ?? 0 })))
      setTrades(tradeRows)
      setCostCodes(costCodeRows)
      if (!tradeId && tradeRows[0]) setTradeId(tradeRows[0].id)
      if (!costCodeId && costCodeRows[0]) setCostCodeId(costCodeRows[0].id)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function init() {
      const accessResult = await getCurrentPricingAccess('catalog')
      setAccess(accessResult)
      if (!accessResult.canView) {
        setError(accessResult.error || 'Catalog access required.')
        setLoading(false)
        return
      }
      try {
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load catalog.')
        setLoading(false)
      }
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredCostCodes = useMemo(
    () => costCodes.filter((row) => !tradeId || !row.trade_id || row.trade_id === tradeId),
    [costCodes, tradeId]
  )

  useEffect(() => {
    if (!tradeId || filteredCostCodes.length === 0) return
    if (!filteredCostCodes.some((row) => row.id === costCodeId)) {
      setCostCodeId(filteredCostCodes[0].id)
    }
  }, [tradeId, filteredCostCodes, costCodeId])

  async function handleCreate() {
    if (!access?.canManage) {
      setError('Manage access required.')
      return
    }
    if (!title.trim() || !tradeId || !costCodeId) {
      setError('Title, trade, and cost code are required.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await createCatalogItem(supabase, {
        title,
        trade_id: tradeId,
        cost_code_id: costCodeId,
        default_unit: defaultUnit.trim() || null,
      })
      setTitle('')
      setDefaultUnit('')
      setShowAdd(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create catalog item.')
    } finally {
      setSaving(false)
    }
  }

  const tradeMap = useMemo(() => new Map(trades.map((row) => [row.id, row.name])), [trades])
  const costCodeMap = useMemo(
    () => new Map(costCodes.map((row) => [row.id, `${row.cost_code} · ${row.title}`])),
    [costCodes]
  )

  const filtered = items.filter((i) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      i.catalog_sku.toLowerCase().includes(q) ||
      i.title.toLowerCase().includes(q) ||
      (i.description ?? '').toLowerCase().includes(q) ||
      (tradeMap.get(i.trade_id) ?? '').toLowerCase().includes(q) ||
      (costCodeMap.get(i.cost_code_id) ?? '').toLowerCase().includes(q)
    )
  })

  return {
    items: filtered,
    trades,
    costCodes: filteredCostCodes,
    tradeMap,
    costCodeMap,
    search,
    setSearch,
    loading,
    saving,
    error,
    showAdd,
    setShowAdd,
    title,
    setTitle,
    tradeId,
    setTradeId,
    costCodeId,
    setCostCodeId,
    defaultUnit,
    setDefaultUnit,
    handleCreate,
    access,
  }
}
