'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import { getCurrentPricingAccess } from '@/app/actions/pricing-access-actions'
import { createClient } from '@/utils/supabase/client'
import {
  createPricingHeader,
  fetchPricingCompanies,
  fetchPricingCostCodes,
  fetchPricingTrades,
  listPricingHeaders,
} from '@/lib/pricing-sources'
import type {
  PricingCompanyOption,
  PricingCostCodeOption,
  PricingHeader,
  PricingTradeOption,
} from '@/lib/pricing-sources-types'

const inputStyle = {
  flex: 1,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: '16px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
} as const

const labelStyle = {
  fontSize: '10px',
  color: 'var(--text-muted)',
  marginBottom: '4px',
  textTransform: 'uppercase' as const,
  letterSpacing: '.04em',
  fontWeight: 700,
} as const

function pillStyle(active: boolean) {
  return {
    background: active ? 'var(--text)' : 'transparent',
    color: active ? 'var(--surface)' : 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    padding: '5px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  } as const
}

function cardStyle() {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '18px',
    overflow: 'hidden',
  } as const
}

export default function PriceSheetsPage() {
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
  const [access, setAccess] = useState<{ canView: boolean; canManage: boolean; canAssign: boolean; error?: string } | null>(null)

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
  const tradeMap = useMemo(() => new Map(trades.map((row) => [row.id, row.name])), [trades])
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

  if (!loading && access && !access.canView) {
    return (
      <>
        <Nav title="Price Sheets" back="/more" />
        <div style={{ padding: '16px' }}>
          <div style={{ ...cardStyle(), padding: '20px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
            Pricing Sources access required.
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Nav title="Price Sheets" back="/more" />

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search price sheets…"
            style={inputStyle}
          />
          {access?.canManage && (
            <button
              type="button"
              onClick={() => {
                setShowAdd((value) => !value)
                setError(null)
              }}
              style={{
                background: 'var(--text)',
                color: 'var(--surface)',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {showAdd ? 'Cancel' : 'Add'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setStatusFilter('all')} style={pillStyle(statusFilter === 'all')}>
            All
          </button>
          <button type="button" onClick={() => setStatusFilter('active')} style={pillStyle(statusFilter === 'active')}>
            Active
          </button>
          <button type="button" onClick={() => setStatusFilter('inactive')} style={pillStyle(statusFilter === 'inactive')}>
            Inactive
          </button>
        </div>

        {showAdd && access?.canManage && (
          <div style={cardStyle()}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              New Price Sheet
            </div>
            <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <div>
                <div style={labelStyle}>Company</div>
                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} style={inputStyle}>
                  <option value="">Select company</option>
                  {companies.map((row) => (
                    <option key={row.id} value={row.id}>{row.company_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={labelStyle}>Trade</div>
                <select value={tradeId} onChange={(e) => setTradeId(e.target.value)} style={inputStyle}>
                  <option value="">Select trade</option>
                  {trades.map((row) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={labelStyle}>Cost Code</div>
                <select value={costCodeId} onChange={(e) => setCostCodeId(e.target.value)} style={inputStyle}>
                  <option value="">Select cost code</option>
                  {filteredCostCodes.map((row) => (
                    <option key={row.id} value={row.id}>{row.cost_code} · {row.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={labelStyle}>Status</div>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="superseded">superseded</option>
                  <option value="archived">archived</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={labelStyle}>Title</div>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leave blank to auto-generate" style={inputStyle} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={labelStyle}>Notes</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                  style={{ ...inputStyle, minHeight: '82px', resize: 'vertical' as const }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={saving}
                  style={{
                    background: 'var(--text)',
                    color: 'var(--surface)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Creating…' : 'Create Price Sheet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && <div style={{ fontSize: '13px', color: '#fca5a5', padding: '4px 0' }}>{error}</div>}

        <div style={cardStyle()}>
          {loading ? (
            <div style={{ padding: '20px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</div>
          ) : filteredHeaders.length === 0 ? (
            <div style={{ padding: '20px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
              {search || statusFilter !== 'all' ? 'No price sheets match.' : 'No price sheets yet.'}
            </div>
          ) : (
            filteredHeaders.map((header, index) => (
              <button
                key={header.id}
                type="button"
                onClick={() => router.push(`/more/price-sheets/${header.id}`)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                  padding: '14px 16px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {header.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {companyMap.get(header.company_id) ?? 'Unknown company'} · {tradeMap.get(header.trade_id) ?? 'Unknown trade'} · {costCodeMap.get(header.cost_code_id) ?? 'Unknown cost code'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: header.is_active ? 'var(--blue)' : '#fbbf24', border: '1px solid var(--border)', borderRadius: '999px', padding: '2px 8px' }}>
                      {header.is_active ? 'active' : 'inactive'}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '999px', padding: '2px 8px' }}>
                      rev {header.revision}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '999px', padding: '2px 8px' }}>
                      {header.status}
                    </span>
                    <span style={{ fontSize: '18px', color: 'var(--text-muted)', lineHeight: 1 }}>›</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {!loading && access?.canView && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
            {filteredHeaders.length} {filteredHeaders.length === 1 ? 'price sheet' : 'price sheets'}
          </div>
        )}
      </div>
    </>
  )
}
