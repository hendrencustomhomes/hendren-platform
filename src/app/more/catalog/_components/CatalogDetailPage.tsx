'use client'

import Link from 'next/link'
import Nav from '@/components/Nav'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getCatalogItemBySku, updateCatalogItem } from '@/lib/pricing/catalog'
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 14,
  boxSizing: 'border-box',
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
  const [canManage, setCanManage] = useState(false)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTradeId, setEditTradeId] = useState('')
  const [editCostCodeId, setEditCostCodeId] = useState('')
  const [editDefaultUnit, setEditDefaultUnit] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)

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
        setCanManage(access.canManage)

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

  // When trade changes during editing, reset cost code to first matching option
  const editFilteredCostCodes = useMemo(
    () => costCodes.filter((row) => !editTradeId || !row.trade_id || row.trade_id === editTradeId),
    [costCodes, editTradeId]
  )

  useEffect(() => {
    if (!editing || !editTradeId || editFilteredCostCodes.length === 0) return
    if (!editFilteredCostCodes.some((row) => row.id === editCostCodeId)) {
      setEditCostCodeId(editFilteredCostCodes[0].id)
    }
  }, [editTradeId, editFilteredCostCodes, editCostCodeId, editing])

  function handleStartEdit() {
    if (!item) return
    setEditTitle(item.title)
    setEditDescription(item.description ?? '')
    setEditTradeId(item.trade_id)
    setEditCostCodeId(item.cost_code_id)
    setEditDefaultUnit(item.default_unit ?? '')
    setEditIsActive(item.is_active)
    setSaveError(null)
    setEditing(true)
  }

  function handleCancelEdit() {
    setEditing(false)
    setSaveError(null)
  }

  async function handleSave() {
    if (!item) return
    if (!editTitle.trim() || !editTradeId || !editCostCodeId) {
      setSaveError('Title, trade, and cost code are required.')
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const updated = await updateCatalogItem(supabase, item.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        trade_id: editTradeId,
        cost_code_id: editCostCodeId,
        default_unit: editDefaultUnit.trim() || null,
        is_active: editIsActive,
      })
      setItem(updated)
      setEditing(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Catalog Identity</h3>
            {canManage && !editing && (
              <button
                type="button"
                onClick={handleStartEdit}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                Edit
              </button>
            )}
          </div>

          {/* SKU is always read-only — never editable */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>SKU</div>
            <div style={{ fontSize: 14 }}>{item.catalog_sku}</div>
          </div>

          {editing ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Title</div>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Description</div>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Trade</div>
                <select
                  value={editTradeId}
                  onChange={(e) => setEditTradeId(e.target.value)}
                  style={inputStyle}
                >
                  {trades.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Cost Code</div>
                <select
                  value={editCostCodeId}
                  onChange={(e) => setEditCostCodeId(e.target.value)}
                  style={inputStyle}
                >
                  {editFilteredCostCodes.map((c) => (
                    <option key={c.id} value={c.id}>{c.cost_code} · {c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Default Unit</div>
                <input
                  value={editDefaultUnit}
                  onChange={(e) => setEditDefaultUnit(e.target.value)}
                  placeholder="e.g. sqft, each, lf"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  Active
                </label>
              </div>

              {saveError && (
                <div style={{ fontSize: 13, color: 'var(--danger)' }}>{saveError}</div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text)',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    background: 'var(--text)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--surface)',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Title</div>
                <div style={{ fontSize: 14 }}>{item.title}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Description</div>
                <div style={{ fontSize: 14 }}>{item.description || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Trade</div>
                <div style={{ fontSize: 14 }}>{tradeMap.get(item.trade_id) ?? item.trade_id}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Cost Code</div>
                <div style={{ fontSize: 14 }}>{costCodeMap.get(item.cost_code_id) ?? item.cost_code_id}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Default Unit</div>
                <div style={{ fontSize: 14 }}>{item.default_unit || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Status</div>
                <div style={{ fontSize: 14 }}>{item.is_active ? 'Active' : 'Inactive'}</div>
              </div>
            </div>
          )}
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
