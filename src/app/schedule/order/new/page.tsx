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
        .select('id, client_name, job_name, project_address')
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

      // preserve existing value if valid, otherwise clear
      if (
        form.linked_schedule_id &&
        !(data || []).some((d) => d.id === form.linked_schedule_id)
      ) {
        setForm((current) => ({ ...current, linked_schedule_id: '' }))
      }
    }

    loadScheduleOptions()
  }, [form.job_id, supabase])

  function setField(key: string, value: any) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSourceChange(source: 'internal' | 'client' | 'company' | 'no_tracking') {
    if (source === 'client') {
      setForm((c) => ({ ...c, is_client_supplied: true, is_sub_supplied: false, requires_tracking: true }))
      return
    }
    if (source === 'company') {
      setForm((c) => ({ ...c, is_client_supplied: false, is_sub_supplied: true, requires_tracking: true }))
      return
    }
    if (source === 'no_tracking') {
      setForm((c) => ({ ...c, is_client_supplied: false, is_sub_supplied: false, requires_tracking: false }))
      return
    }
    setForm((c) => ({ ...c, is_client_supplied: false, is_sub_supplied: false, requires_tracking: true }))
  }

  const sourceValue =
    form.is_client_supplied
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
    const d = new Date(form.required_on_site_date)
    d.setDate(d.getDate() - leadDays)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

    const { error } = await supabase.from('procurement_items').insert({
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

    if (error) {
      setError(error.message)
      return
    }

    router.push(form.job_id ? `/jobs/${form.job_id}?tab=orders` : '/schedule')
  }

  return (
    <main style={{ padding: '16px', maxWidth: '760px', margin: '0 auto' }}>
      <h1>Create Material Schedule</h1>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
        <div style={pageCardStyle()}>
          <div style={{ fontWeight: 700, marginBottom: '12px' }}>Material Details</div>

          <label style={labelStyle()}>Job</label>
          <select value={form.job_id} onChange={(e) => setField('job_id', e.target.value)} style={inp}>
            <option value="">Select job</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.job_name || j.client_name}
              </option>
            ))}
          </select>

          <label style={labelStyle()}>Trade</label>
          <input
            value={tradeSearch}
            onChange={(e) => {
              setTradeSearch(e.target.value)
              setTradeOpen(true)
            }}
            style={inp}
          />

          <label style={labelStyle()}>Linked Labor Schedule</label>
          <select
            value={form.linked_schedule_id}
            onChange={(e) => setField('linked_schedule_id', e.target.value)}
            style={inp}
            disabled={!form.job_id}
          >
            <option value="">None</option>
            {scheduleOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.trade}
                {s.sub_name ? ` · ${s.sub_name}` : ''}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Create Material Schedule'}
        </button>
      </form>
    </main>
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewOrderForm />
    </Suspense>
  )
}