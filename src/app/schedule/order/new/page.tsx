'use client'

import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { fetchActiveTrades, type TradeOption } from '@/lib/trades'
import { fetchActiveCostCodes, type CostCodeOption } from '@/lib/cost-codes'

const STATUS_OPTIONS = ['Pending', 'Ordered', 'Confirmed', 'Delivered', 'Issue']

function pageCardStyle() {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px',
  }
}

function labelStyle() {
  return {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '.04em',
    color: 'var(--text-muted)',
    marginBottom: '6px',
    fontFamily: 'ui-monospace,monospace',
  }
}

function inputStyle() {
  return {
    width: '100%',
    padding: '12px',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    fontSize: '16px',
    background: 'var(--surface)',
    color: 'var(--text)',
    boxSizing: 'border-box' as const,
    outline: 'none',
  }
}

function NewOrderForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [jobs, setJobs] = useState<any[]>([])
  const [scheduleOptions, setScheduleOptions] = useState<any[]>([])
  const [trades, setTrades] = useState<TradeOption[]>([])
  const [tradeSearch, setTradeSearch] = useState('')
  const [tradeOpen, setTradeOpen] = useState(false)
  const tradeRef = useRef<HTMLDivElement>(null)

  const [costCodes, setCostCodes] = useState<CostCodeOption[]>([])
  const [loadingCostCodes, setLoadingCostCodes] = useState(true)
  const [costCodeSearch, setCostCodeSearch] = useState('')
  const [costCodeOpen, setCostCodeOpen] = useState(false)
  const costCodeRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(false)
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [loadingTrades, setLoadingTrades] = useState(true)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    job_id: searchParams.get('jobId') || searchParams.get('job') || '',
    trade: '',
    description: '',
    vendor: '',
    qty: '',
    unit: '',
    unit_cost: '',
    lead_days: '7',
    required_on_site_date: '',
    status: 'Pending',
    selection_reference: '',
    notes: '',
    procurement_group: '',
    linked_schedule_id: '',
    is_client_supplied: false,
    is_sub_supplied: false,
    requires_tracking: true,
    cost_code: '',
  })

  const inp = useMemo(() => inputStyle(), [])

  const displayTrades = useMemo(() => {
    const q = tradeSearch.trim().toLowerCase()
    if (!q) return trades
    return trades.filter((t) => t.name.toLowerCase().includes(q))
  }, [trades, tradeSearch])

  const displayCostCodes = useMemo(() => {
    const q = costCodeSearch.trim().toLowerCase()
    if (!q) return costCodes
    return costCodes.filter(
      (c) => c.cost_code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
    )
  }, [costCodes, costCodeSearch])

  useEffect(() => {
    async function loadJobs() {
      setLoadingJobs(true)
      const { data } = await supabase
        .from('jobs')
        .select('id, client_name, job_name, project_address, color')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      setJobs(data || [])
      setLoadingJobs(false)
    }

    async function loadTrades() {
      setLoadingTrades(true)
      const data = await fetchActiveTrades(supabase)
      setTrades(data)

      if (data.length > 0) {
        setForm((prev) => (prev.trade === '' ? { ...prev, trade: data[0].name } : prev))
        setTradeSearch((prev) => prev || data[0].name)
      }

      setLoadingTrades(false)
    }

    async function loadCostCodes() {
      setLoadingCostCodes(true)
      const data = await fetchActiveCostCodes(supabase)
      setCostCodes(data)
      setLoadingCostCodes(false)
    }

    loadJobs()
    loadTrades()
    loadCostCodes()
  }, [supabase])

  useEffect(() => {
    async function loadScheduleOptions() {
      if (!form.job_id) {
        setScheduleOptions([])
        return
      }

      const { data } = await supabase
        .from('sub_schedule')
        .select('id, trade, sub_name, start_date')
        .eq('job_id', form.job_id)
        .order('start_date', { ascending: true, nullsFirst: false })

      setScheduleOptions(data || [])

      if (
        form.linked_schedule_id &&
        !(data || []).some((d) => d.id === form.linked_schedule_id)
      ) {
        setForm((current) => ({ ...current, linked_schedule_id: '' }))
      }
    }

    loadScheduleOptions()
  }, [form.job_id, form.linked_schedule_id, supabase])

  function setField(key: string, value: any) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSourceChange(source: 'internal' | 'client' | 'company' | 'no_tracking') {
    if (source === 'client') {
      setForm((current) => ({
        ...current,
        is_client_supplied: true,
        is_sub_supplied: false,
        requires_tracking: true,
      }))
      return
    }

    if (source === 'company') {
      setForm((current) => ({
        ...current,
        is_client_supplied: false,
        is_sub_supplied: true,
        requires_tracking: true,
      }))
      return
    }

    if (source === 'no_tracking') {
      setForm((current) => ({
        ...current,
        is_client_supplied: false,
        is_sub_supplied: false,
        requires_tracking: false,
      }))
      return
    }

    setForm((current) => ({
      ...current,
      is_client_supplied: false,
      is_sub_supplied: false,
      requires_tracking: true,
    }))
  }

  const sourceValue = form.is_client_supplied
    ? 'client'
    : form.is_sub_supplied
      ? 'company'
      : form.requires_tracking === false
        ? 'no_tracking'
        : 'internal'

  const orderByDate = useMemo(() => {
    if (!form.required_on_site_date || !form.lead_days) return null

    const leadDays = parseInt(form.lead_days, 10)
    if (!Number.isFinite(leadDays)) return null

    const requiredDate = new Date(form.required_on_site_date)
    requiredDate.setDate(requiredDate.getDate() - leadDays)

    return requiredDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }, [form.required_on_site_date, form.lead_days])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!form.job_id || !form.description.trim()) {
      setError('Job and description are required')
      return
    }

    setLoading(true)
    setError('')

    const leadDays = parseInt(form.lead_days, 10) || 0

    const { error: insertError } = await supabase.from('procurement_items').insert({
      job_id: form.job_id,
      trade: form.trade,
      description: form.description.trim(),
      vendor: form.vendor.trim() || null,
      qty: form.qty ? parseFloat(form.qty) : null,
      unit: form.unit.trim() || null,
      unit_cost: form.unit_cost ? parseFloat(form.unit_cost) : null,
      lead_days: leadDays,
      required_on_site_date: form.required_on_site_date || null,
      status: form.status,
      selection_reference: form.selection_reference.trim() || null,
      notes: form.notes.trim() || null,
      procurement_group: form.procurement_group.trim() || null,
      linked_schedule_id: form.linked_schedule_id || null,
      is_client_supplied: form.is_client_supplied,
      is_sub_supplied: form.is_sub_supplied,
      requires_tracking: form.requires_tracking,
      cost_code: form.cost_code.trim() || null,
    })

    setLoading(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    router.push(form.job_id ? `/jobs/${form.job_id}?tab=orders` : '/schedule')
  }

  return (
    <main
      style={{
        padding: '16px',
        maxWidth: '760px',
        margin: '0 auto',
        background: 'var(--bg)',
        minHeight: '100vh',
        color: 'var(--text)',
      }}
    >
      <div style={{ marginBottom: '14px' }}>
        <button
          type="button"
          onClick={() => router.push(form.job_id ? `/jobs/${form.job_id}?tab=orders` : '/schedule')}
          style={{
            border: 'none',
            background: 'none',
            padding: 0,
            color: 'var(--blue)',
            fontSize: '14px',
            cursor: 'pointer',
            marginBottom: '8px',
          }}
        >
          ← Back
        </button>

        <h1 style={{ margin: 0, fontSize: '28px' }}>Create Material Schedule</h1>
        <div
          style={{
            marginTop: '4px',
            fontSize: '14px',
            color: 'var(--text-muted)',
          }}
        >
          Add a material schedule with timing, source, and coordination details
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
        <div style={pageCardStyle()}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
            Material Details
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={labelStyle()}>Job</label>
              <select
                style={{ ...inp, opacity: loadingJobs ? 0.7 : 1 }}
                value={form.job_id}
                onChange={(e) => setField('job_id', e.target.value)}
                required
                disabled={loadingJobs}
              >
                <option value="">{loadingJobs ? 'Loading jobs...' : 'Select a job...'}</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.job_name || job.client_name || 'Unnamed Job'}
                    {job.project_address ? ` — ${job.project_address}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle()}>Trade</label>
                <div ref={tradeRef} style={{ position: 'relative' }}>
                  <input
                    value={tradeSearch}
                    onChange={(e) => {
                      setTradeSearch(e.target.value)
                      setTradeOpen(true)
                    }}
                    onFocus={() => setTradeOpen(true)}
                    onBlur={() => {
                      setTimeout(() => {
                        setTradeOpen(false)
                        setTradeSearch(form.trade)
                      }, 150)
                    }}
                    placeholder={loadingTrades ? 'Loading trades...' : 'Search trades...'}
                    disabled={loadingTrades}
                    autoComplete="off"
                    style={{ ...inp, opacity: loadingTrades ? 0.7 : 1 }}
                  />
                  {tradeOpen && displayTrades.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        marginTop: '4px',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                      }}
                    >
                      {displayTrades.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setField('trade', t.name)
                            setTradeSearch(t.name)
                            setTradeOpen(false)
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            textAlign: 'left',
                            border: 'none',
                            borderBottom: '1px solid var(--border)',
                            background: form.trade === t.name ? 'var(--blue-bg)' : 'transparent',
                            color: form.trade === t.name ? 'var(--blue)' : 'var(--text)',
                            cursor: 'pointer',
                            fontSize: '15px',
                          }}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={labelStyle()}>Status</label>
                <select
                  style={inp}
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value)}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle()}>Description</label>
              <input
                style={inp}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Wall framing lumber, appliance package, tile material..."
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle()}>Company</label>
                <input
                  style={inp}
                  value={form.vendor}
                  onChange={(e) => setField('vendor', e.target.value)}
                  placeholder="Builders FirstSource"
                />
              </div>

              <div>
                <label style={labelStyle()}>Procurement Group</label>
                <input
                  style={inp}
                  value={form.procurement_group}
                  onChange={(e) => setField('procurement_group', e.target.value)}
                  placeholder="Floor package, cabinet package..."
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle()}>Qty</label>
                <input
                  style={inp}
                  type="number"
                  value={form.qty}
                  onChange={(e) => setField('qty', e.target.value)}
                  placeholder="14200"
                />
              </div>

              <div>
                <label style={labelStyle()}>Unit</label>
                <input
                  style={inp}
                  value={form.unit}
                  onChange={(e) => setField('unit', e.target.value)}
                  placeholder="BF, LS, SQFT"
                />
              </div>

              <div>
                <label style={labelStyle()}>Unit Cost</label>
                <input
                  style={inp}
                  type="number"
                  step="0.01"
                  value={form.unit_cost}
                  onChange={(e) => setField('unit_cost', e.target.value)}
                  placeholder="1.10"
                />
              </div>
            </div>

            <div>
              <label style={labelStyle()}>Cost Code</label>
              <div ref={costCodeRef} style={{ position: 'relative' }}>
                <input
                  value={costCodeSearch}
                  onChange={(e) => {
                    setCostCodeSearch(e.target.value)
                    setCostCodeOpen(true)
                  }}
                  onFocus={() => setCostCodeOpen(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      setCostCodeOpen(false)
                      const selected = costCodes.find((c) => c.cost_code === form.cost_code)
                      setCostCodeSearch(
                        selected
                          ? selected.title
                            ? `${selected.cost_code} — ${selected.title}`
                            : selected.cost_code
                          : form.cost_code || ''
                      )
                    }, 150)
                  }}
                  placeholder={loadingCostCodes ? 'Loading cost codes...' : 'Search cost codes...'}
                  disabled={loadingCostCodes}
                  autoComplete="off"
                  style={{ ...inp, opacity: loadingCostCodes ? 0.7 : 1 }}
                />
                {costCodeOpen && displayCostCodes.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      marginTop: '4px',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    }}
                  >
                    {displayCostCodes.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setField('cost_code', c.cost_code)
                          setCostCodeSearch(c.title ? `${c.cost_code} — ${c.title}` : c.cost_code)
                          setCostCodeOpen(false)
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          textAlign: 'left',
                          border: 'none',
                          borderBottom: '1px solid var(--border)',
                          background:
                            form.cost_code === c.cost_code ? 'var(--blue-bg)' : 'transparent',
                          color: form.cost_code === c.cost_code ? 'var(--blue)' : 'var(--text)',
                          cursor: 'pointer',
                          fontSize: '15px',
                        }}
                      >
                        {c.title ? `${c.cost_code} — ${c.title}` : c.cost_code}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={pageCardStyle()}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
            Timing and Coordination
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle()}>Need On Site</label>
                <input
                  style={inp}
                  type="date"
                  value={form.required_on_site_date}
                  onChange={(e) => setField('required_on_site_date', e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle()}>Lead Days</label>
                <input
                  style={inp}
                  type="number"
                  inputMode="numeric"
                  value={form.lead_days}
                  onChange={(e) => setField('lead_days', e.target.value)}
                  placeholder="7"
                />
              </div>
            </div>

            {orderByDate && (
              <div
                style={{
                  borderRadius: '10px',
                  padding: '12px',
                  background: 'var(--blue-bg)',
                  border: '1px solid var(--blue)',
                  color: 'var(--blue)',
                  fontSize: '14px',
                }}
              >
                Order by date: <strong>{orderByDate}</strong>
              </div>
            )}

            <div>
              <label style={labelStyle()}>Selection Reference</label>
              <input
                style={inp}
                value={form.selection_reference}
                onChange={(e) => setField('selection_reference', e.target.value)}
                placeholder="Cabinet selection, appliance package..."
              />
            </div>

            <div>
              <label style={labelStyle()}>Linked Labor Schedule</label>
              <select
                style={inp}
                value={form.linked_schedule_id}
                onChange={(e) => setField('linked_schedule_id', e.target.value)}
                disabled={!form.job_id}
              >
                <option value="">{form.job_id ? 'None' : 'Select a job first'}</option>
                {scheduleOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.trade}
                    {item.sub_name ? ` · ${item.sub_name}` : ''}
                    {item.start_date
                      ? ` · ${new Date(item.start_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}`
                      : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div style={pageCardStyle()}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
            Material Responsibility
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={labelStyle()}>Source</label>
              <select
                style={inp}
                value={sourceValue}
                onChange={(e) =>
                  handleSourceChange(
                    e.target.value as 'internal' | 'client' | 'company' | 'no_tracking'
                  )
                }
              >
                <option value="internal">Internal Procurement</option>
                <option value="company">Company Supplied</option>
                <option value="client">Client Supplied</option>
                <option value="no_tracking">No Tracking Required</option>
              </select>
            </div>
          </div>
        </div>

        <div style={pageCardStyle()}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
            Notes
          </div>

          <div>
            <label style={labelStyle()}>Notes</label>
            <textarea
              style={{ ...inp, minHeight: '110px', resize: 'vertical' }}
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Delivery instructions, special requirements, field coordination notes..."
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              ...pageCardStyle(),
              border: '1px solid rgba(220, 38, 38, 0.35)',
              background: 'rgba(220, 38, 38, 0.08)',
              color: 'var(--red)',
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => router.push(form.job_id ? `/jobs/${form.job_id}?tab=orders` : '/schedule')}
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 16px',
              background: loading ? 'var(--border)' : 'var(--text)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Saving...' : 'Create Material Schedule'}
          </button>
        </div>
      </form>
    </main>
  )
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={null}>
      <NewOrderForm />
    </Suspense>
  )
}