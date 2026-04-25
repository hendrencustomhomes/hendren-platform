'use client'

import Link from 'next/link'
import Nav from '@/components/Nav'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getCatalogItemBySku } from '@/lib/pricing/catalog'
import { fetchPricingCompanies, fetchPricingCostCodes, fetchPricingTrades } from '@/lib/pricing/lookups'
import { getCurrentPricingAccess } from '@/app/actions/pricing-access-actions'
import type { CatalogItem, PricingCompanyOption, PricingCostCodeOption, PricingTradeOption } from '@/lib/pricing/types'

type SourceHeader = {
  id: string
  kind: 'price_sheet' | 'bid'
  job_id: string | null
  company_id: string
  trade_id: string
  cost_code_id: string
  title: string
  status: string
  effective_date: string | null
  received_at: string | null
  is_active: boolean
}

type SourceRow = {
  id: string
  pricing_header_id: string
  source_sku: string
  pricing_type: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
  lead_days: number | null
  pricing_headers: SourceHeader | null
}

type RawSourceRow = Omit<SourceRow, 'pricing_headers'> & {
  pricing_headers: SourceHeader | SourceHeader[] | null
}

function normalizeSourceRow(row: RawSourceRow): SourceRow {
  const header = Array.isArray(row.pricing_headers)
    ? row.pricing_headers[0] ?? null
    : row.pricing_headers

  return {
    ...row,
    pricing_headers: header,
  }
}

function formatMoney(value: number | null) {
  if (value == null) return 'No price'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function formatType(value: string) {
  if (value === 'lump_sum') return 'Lump Sum'
  if (value === 'allowance') return 'Allowance'
  return 'Unit'
}

function sourceHref(source: SourceRow) {
  const header = source.pricing_headers
  if (!header) return null
  if (header.kind === 'bid' && header.job_id) return `/jobs/${header.job_id}/bids/${header.id}`
  if (header.kind === 'price_sheet') return `/more/price-sheets/${header.id}`
  return null
}

export default function CatalogDetailPage({ catalogSku }: { catalogSku: string }) {
  const supabase = createClient()

  const [item, setItem] = useState<CatalogItem | null>(null)
  const [sources, setSources] = useState<SourceRow[]>([])
  const [companies, setCompanies] = useState<PricingCompanyOption[]>([])
  const [trades, setTrades] = useState<PricingTradeOption[]>([])
  const [costCodes, setCostCodes] = useState<PricingCostCodeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      try {
        const access = await getCurrentPricingAccess('catalog')
        if (!access.canView) {
          setError(access.error || 'Catalog access required.')
          return
        }

        const [catalogItem, companiesRows, tradeRows, costCodeRows, sourceResult] = await Promise.all([
          getCatalogItemBySku(supabase, catalogSku),
          fetchPricingCompanies(supabase),
          fetchPricingTrades(supabase),
          fetchPricingCostCodes(supabase),
          supabase
            .from('pricing_rows')
            .select(`
              id,
              pricing_header_id,
              source_sku,
              pricing_type,
              quantity,
              unit,
              unit_price,
              lead_days,
              pricing_headers (
                id,
                kind,
                job_id,
                company_id,
                trade_id,
                cost_code_id,
                title,
                status,
                effective_date,
                received_at,
                is_active
              )
            `)
            .eq('catalog_sku', catalogSku),
        ])

        if (sourceResult.error) throw sourceResult.error

        setItem(catalogItem)
        setCompanies(companiesRows)
        setTrades(tradeRows)
        setCostCodes(costCodeRows)
        setSources(((sourceResult.data ?? []) as unknown as RawSourceRow[]).map(normalizeSourceRow))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load catalog item.')
      } finally {
        setLoading(false)
      }
    }

    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogSku])

  const companyMap = useMemo(() => new Map(companies.map((row) => [row.id, row.company_name])), [companies])
  const tradeMap = useMemo(() => new Map(trades.map((row) => [row.id, row.name])), [trades])
  const costCodeMap = useMemo(
    () => new Map(costCodes.map((row) => [row.id, `${row.cost_code} · ${row.title}`])),
    [costCodes]
  )

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>
  if (error) return <div style={{ padding: 16, color: 'var(--danger)' }}>{error}</div>
  if (!item) return <div style={{ padding: 16 }}>Catalog item not found.</div>

  return (
    <>
      <Nav title={item.title} back="/more/catalog" />

      <div style={{ padding: 16, display: 'grid', gap: 16 }}>
        <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Catalog Identity</h3>
          <div><strong>SKU:</strong> {item.catalog_sku}</div>
          <div><strong>Title:</strong> {item.title}</div>
          <div><strong>Description:</strong> {item.description || '—'}</div>
          <div><strong>Trade:</strong> {tradeMap.get(item.trade_id) ?? item.trade_id}</div>
          <div><strong>Cost Code:</strong> {costCodeMap.get(item.cost_code_id) ?? item.cost_code_id}</div>
          <div><strong>Default Unit:</strong> {item.default_unit || '—'}</div>
          <div><strong>Status:</strong> {item.is_active ? 'Active' : 'Inactive'}</div>
        </section>

        <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Source Pricing Options</h3>

          {sources.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No source pricing tied to this catalog item yet.</div>
          ) : (
            sources.map((source) => {
              const header = source.pricing_headers
              const href = sourceHref(source)
              const body = (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 0' }}>
                  <div style={{ fontWeight: 700 }}>{source.source_sku}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {header?.kind === 'bid' ? 'Bid' : 'Price Sheet'} · {header?.title ?? 'Unknown source'}
                  </div>
                  <div style={{ fontSize: 13 }}>
                    {companyMap.get(header?.company_id ?? '') ?? 'Unknown company'} · {formatType(source.pricing_type)} · {formatMoney(source.unit_price)}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Qty {source.quantity ?? '—'} {source.unit ?? ''} · Lead {source.lead_days ?? '—'} days · Status {header?.status ?? '—'}
                  </div>
                </div>
              )

              return href ? (
                <Link key={source.id} href={href} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {body}
                </Link>
              ) : (
                <div key={source.id}>{body}</div>
              )
            })
          )}
        </section>
      </div>
    </>
  )
}
