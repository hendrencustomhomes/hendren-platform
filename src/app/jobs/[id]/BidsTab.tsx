'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentPricingAccess } from '@/app/actions/pricing-access-actions'
import { createClient } from '@/utils/supabase/client'
import { createPricingHeader, fetchPricingCompanies, listPricingHeaders } from '@/lib/pricing-sources'
import type { PricingCompanyOption, PricingCostCodeOption, PricingHeader, PricingTradeOption } from '@/lib/pricing-sources-types'

type Props = {
  jobId: string
  trades: PricingTradeOption[]
  costCodes: PricingCostCodeOption[]
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: '7px',
  fontSize: '16px',
  boxSizing: 'border-box' as const,
  outline: 'none',
  background: 'var(--surface)',
  color: 'var(--text)',
} as const

export default function BidsTab({ jobId, trades, costCodes }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [bids, setBids] = useState<PricingHeader[]>([])
  const [companies, setCompanies] = useState<PricingCompanyOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [companyId, setCompanyId] = useState('')
  const [tradeId, setTradeId] = useState('')
  const [costCodeId, setCostCodeId] = useState('')
  const [title, setTitle] = useState('')
  const [access, setAccess] = useState<{ canView: boolean; canManage: boolean; canAssign: boolean; error?: string } | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [bidRows, companyRows] = await Promise.all([
        listPricingHeaders(supabase, { kind: 'bid', job_id: jobId }),
        fetchPricingCompanies(supabase),
      ])
      setBids(bidRows)
      setCompanies(companyRows)
      if (!companyId && companyRows[0]) setCompanyId(companyRows[0].id)
      if (!tradeId && trades[0]) setTradeId(trades[0].id)
      if (!costCodeId && costCodes[0]) setCostCodeId(costCodes[0].id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bids.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function initialize() {
      const accessResult = await getCurrentPricingAccess('bids')
      setAccess(accessResult)

      if (!accessResult.canView) {
        setLoading(false)
        setError(accessResult.error || 'Bids access required.')
        return
      }

      await load()
    }

    void initialize()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  useEffect(() => {
    if (!tradeId) return
    const filtered = costCodes.filter((x) => !x.trade_id || x.trade_id === tradeId)
    if (filtered.length && !filtered.some((x) => x.id === costCodeId)) setCostCodeId(filtered[0].id)
  }, [tradeId, costCodes, costCodeId])

  const companyMap = useMemo(() => new Map(companies.map((x) => [x.id, x.company_name])), [companies])
  const tradeMap = useMemo(() => new Map(trades.map((x) => [x.id, x.name])), [trades])
  const costCodeMap = useMemo(() => new Map(costCodes.map((x) => [x.id, `${x.cost_code} · ${x.title}`])), [costCodes])
  const filteredCostCodes = useMemo(() => costCodes.filter((x) => !tradeId || !x.trade_id || x.trade_id === tradeId), [costCodes, tradeId])

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
      const bid = await createPricingHeader(supabase, {
        kind: 'bid',
        job_id: jobId,
        company_id: companyId,
        trade_id: tradeId,
        cost_code_id: costCodeId,
        title: title.trim() || null,
        status: 'received',
      })
      setShowAdd(false)
      setTitle('')
      await load()
      router.push(`/jobs/${jobId}/bids/${bid.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create bid.')
    } finally {
      setSaving(false)
    }
  }

  if (!loading && access && !access.canView) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
        Bids access required.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{bids.length} bids</div>
        {access?.canManage && (
          <button onClick={() => setShowAdd((v) => !v)} style={{ padding: '7px 12px', background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>{showAdd ? 'Cancel' : '+ Bid'}</button>
        )}
      </div>

      {showAdd && access?.canManage && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} style={inputStyle}>
            <option value="">Select company</option>
            {companies.map((x) => <option key={x.id} value={x.id}>{x.company_name}</option>)}
          </select>
          <select value={tradeId} onChange={(e) => setTradeId(e.target.value)} style={inputStyle}>
            <option value="">Select trade</option>
            {trades.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <select value={costCodeId} onChange={(e) => setCostCodeId(e.target.value)} style={inputStyle}>
            <option value="">Select cost code</option>
            {filteredCostCodes.map((x) => <option key={x.id} value={x.id}>{x.cost_code} · {x.title}</option>)}
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leave blank to auto-generate" style={{ ...inputStyle, gridColumn: '1 / -1' }} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleCreate} disabled={saving} style={{ padding: '8px 12px', background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Creating…' : 'Create Bid'}</button>
          </div>
        </div>
      )}

      {error && <div style={{ fontSize: '12px', color: '#fca5a5' }}>{error}</div>}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
        {loading ? (
          <div style={{ padding: '20px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>Loading…</div>
        ) : !bids.length ? (
          <div style={{ padding: '20px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>No bids yet.</div>
        ) : (
          bids.map((bid, index) => (
            <button key={bid.id} type="button" onClick={() => router.push(`/jobs/${jobId}/bids/${bid.id}`)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderTop: index === 0 ? 'none' : '1px solid var(--border)', padding: '12px 14px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bid.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{companyMap.get(bid.company_id) ?? 'Unknown company'} · {tradeMap.get(bid.trade_id) ?? 'Unknown trade'} · {costCodeMap.get(bid.cost_code_id) ?? 'Unknown cost code'}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '10px', fontWeight: '600', color: bid.is_active ? 'var(--blue)' : '#fbbf24', border: '1px solid var(--border)', borderRadius: '999px', padding: '2px 8px' }}>{bid.is_active ? 'active' : 'inactive'}</span>
                  <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '999px', padding: '2px 8px' }}>rev {bid.revision}</span>
                  <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '999px', padding: '2px 8px' }}>{bid.status}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
