'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { fetchActiveTrades, type TradeOption } from '@/lib/trades'

const STATUS_OPTIONS = ['Pending', 'Ordered', 'Confirmed', 'Will Call', 'Delivered', 'Issue']
const DEPENDENCY_OPTIONS = [
  { value: 'contract_signed', label: 'Contract Signed' },
  { value: 'selection_locked', label: 'Selection Locked' },
  { value: 'none', label: 'None' },
]

type OrderFormState = {
  job_id: string | null
  trade: string
  description: string
  vendor: string
  qty: string
  unit: string
  unit_cost: string
  lead_days: string
  required_on_site_date: string
  status: string
  depends_on: string
  selection_reference: string
  notes: string
  cost_code: string
  procurement_group: string
  linked_schedule_id: string
  is_client_supplied: boolean
  is_sub_supplied: boolean
  requires_tracking: boolean
}

const EMPTY_FORM: OrderFormState = {
  job_id: null,
  trade: '',
  description: '',
  vendor: '',
  qty: '',
  unit: '',
  unit_cost: '',
  lead_days: '7',
  required_on_site_date: '',
  status: 'Pending',
  depends_on: 'contract_signed',
  selection_reference: '',
  notes: '',
  cost_code: '',
  procurement_group: '',
  linked_schedule_id: '',
  is_client_supplied: false,
  is_sub_supplied: false,
  requires_tracking: true,
}

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

export default function EditOrderPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()

  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const jobParam = searchParams.get('job')
  const returnTo = jobParam ? `/jobs/${jobParam}?tab=orders` : '/schedule'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [form, setForm] = useState<OrderFormState>(EMPTY_FORM)
  const [scheduleOptions, setScheduleOptions] = useState<any[]>([])
  const [trades, setTrades] = useState<TradeOption[]>([])
  const [loadingTrades, setLoadingTrades] = useState(true)
  const [tradeSearch, setTradeSearch] = useState('')
  const [tradeOpen, setTradeOpen] = useState(false)
  const tradeRef = useRef<HTMLDivElement>(null)

  const displayTrades = useMemo(() => {
    let base = [...trades]
    if (form.trade && !base.some((t) => t.name === form.trade)) {
      base = [{ id: '__existing__', name: form.trade, sort_order: -1 }, ...base]
    }
    const q = tradeSearch.trim().toLowerCase()
    if (!q) return base
    return base.filter((t) => t.name.toLowerCase().includes(q))
  }, [trades, form.trade, tradeSearch])

  const inp = useMemo(() => inputStyle(), [])

  useEffect(() => {
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
    loadTrades()
  }, [supabase])

  useEffect(() => {
    if (!id) return

    async function load() {
      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('procurement_items')
        .select(`
          id,
          job_id,
          trade,
          description,
          vendor,
          qty,
          unit,
          unit_cost,
          lead_days,
          required_on_site_date,
          status,
          depends_on,
          selection_reference,
          notes,
          cost_code,
          procurement_group,
          linked_schedule_id,
          is_client_supplied,
          is_sub_supplied,
          requires_tracking
        `)
        .eq('id', id)
        .single()

      if (error || !data) {
        setErrorMessage(error?.message || 'Procurement item not found')
        setLoading(false)
        return
      }

      setForm({
        job_id: data.job_id,
        trade: data.trade || '',
        description: data.description || '',
        vendor: data.vendor || '',
        qty: data.qty?.toString() || '',
        unit: data.unit || '',
        unit_cost: data.unit_cost?.toString() || '',
        lead_days: data.lead_days?.toString() || '0',
        required_on_site_date: data.required_on_site_date || '',
        status: data.status || 'Pending',
        depends_on: data.depends_on || 'contract_signed',
        selection_reference: data.selection_reference || '',
        notes: data.notes || '',
        cost_code: data.cost_code || '',
        procurement_group: data.procurement_group || '',
        linked_schedule_id: data.linked_schedule_id || '',
        is_client_supplied: data.is_client_supplied ?? false,
        is_sub_supplied: data.is_sub_supplied ?? false,
        requires_tracking: data.requires_tracking ?? true,
      })
      setTradeSearch(data.trade || '')

      if (data.job_id) {
        const { data: scheduleItems } = await supabase
          .from('sub_schedule')
          .select('id, trade, sub_name, start_date')
          .eq('job_id', data.job_id)
          .order('start_date', { ascending: true, nullsFirst: false })

        setScheduleOptions(scheduleItems || [])
      }

      setLoading(false)
    }

    load()
  }, [id, supabase])

  function setField(key: keyof OrderFormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleMaterialSourceChange(source: 'internal' | 'client' | 'company' | 'no_tracking') {
    if (source === 'client') {
      setForm((prev) => ({
        ...prev,
        is_client_supplied: true,
        is_sub_supplied: false,
        requires_tracking: true,
      }))
      return
    }

    if (source === 'company') {
      setForm((prev) => ({
        ...prev,
        is_client_supplied: false,
        is_sub_supplied: true,
        requires_tracking: true,
      }))
      return
    }

    if (source === 'no_tracking') {
      setForm((prev) => ({
        ...prev,
        is_client_supplied: false,
        is_sub_supplied: false,
        requires_tracking: false,
      }))
      return
    }

    setForm((prev) => ({
      ...prev,
      is_client_supplied: false,
      is_sub_supplied: false,
      requires_tracking: true,
    }))
  }

  const materialSource = form.is_client_supplied
    ? 'client'
    : form.is_sub_supplied
      ? 'company'
      : form.requires_tracking === false
        ? 'no_tracking'
        : 'internal'

  const orderByDate = useMemo(() => {
    if (!form.required_on_site_date || !form.lead_days) return null

    const leadDays = parseInt(form.lead_days || '0', 10)
    if (!Number.isFinite(leadDays)) return null

    const requiredDate = new Date(form.required_on_site_date)
    requiredDate.setDate(requiredDate.getDate() - leadDays)

    return requiredDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }, [form.required_on_site_date, form.lead_days])

  async function handleSave(e: FormEvent) {
    e.preventDefault()

    if (!id) {
      alert('Missing procurement item id')
      return
    }

    if (!form.job_id || !form.description.trim()) {
      alert('Job and description are required')
      return
    }

    setSaving(true)

    const leadDays = parseInt(form.lead_days || '0', 10) || 0
    let orderByDateValue: string | null = null

    if (form.required_on_site_date) {
      const requiredDate = new Date(form.required_on_site_date)
      requiredDate.setDate(requiredDate.getDate() - leadDays)
      orderByDateValue = requiredDate.toISOString().slice(0, 10)
    }

    const { error } = await supabase
      .from('procurement_items')
      .update({
        trade: form.trade,
        description: form.description.trim(),
        vendor: form.vendor.trim() || null,
        qty: form.qty ? parseFloat(form.qty) : null,
        unit: form.unit.trim() || null,
        unit_cost: form.unit_cost ? parseFloat(form.unit_cost) : null,
        lead_days: leadDays,
        required_on_site_date: form.required_on_site_date || null,
        order_by_date: orderByDateValue,
        status: form.status,
        depends_on: form.depends_on,
        selection_reference: form.selection_reference.trim() || null,
        notes: form.notes.trim() || null,
        cost_code: form.cost_code.trim() || null,
        procurement_group: form.procurement_group.trim() || null,
        linked_schedule_id: form.linked_schedule_id || null,
        is_client_supplied: form.is_client_supplied,
        is_sub_supplied: form.is_sub_supplied,
        requires_tracking: form.requires_tracking,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    setSaving(false)

    if (error) {
      alert(error.message)
      return
    }

    router.push(returnTo)
  }

  if (loading) {
    return (
      <main
        style={{
          padding: '16px',
          maxWidth: '860px',
          margin: '0 auto',
          background: 'var(--bg)',
          minHeight: '100vh',
          color: 'var(--text)',
        }}
      >
        Loading procurement item...
      </main>
    )
  }

  if (errorMessage) {
    return (
      <main
        style={{
          padding: '16px',
          maxWidth: '860px',
          margin: '0 auto',
          background: 'var(--bg)',
          minHeight: '100vh',
          color: 'var(--text)',
        }}
      >
        <h1 style={{ marginBottom: '16px', fontSize: '28px' }}>Edit Procurement Item</h1>
        <div
          style={{
            ...pageCardStyle(),
            border: '1px solid rgba(220, 38, 38, 0.35)',
            background: 'rgba(220, 38, 38, 0.08)',
            color: 'var(--red)',
          }}
        >
          {errorMessage}
        </div>
      </main>
    )
  }

  return (
    <main
      style={{
        padding: '16px',
        maxWidth: '860px',
        margin: '0 auto',
        background: 'var(--bg)',
        minHeight: '100vh',
        color: 'var(--text)',
      }}
    >
      <div style={{ marginBottom: '14px' }}>
        <button
          type="button"
          onClick={() => router.push(returnTo)}
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

        <h1 style={{ margin: 0, fontSize: '28px' }}>Edit Procurement Item</h1>
        <div
          style={{
            marginTop: '4px',
            fontSize: '14px',
            color: 'var(--text-muted)',
          }}
        >
          Update material timing, source, grouping, and company coordination details
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'grid', gap: '12px' }}>
        <div style={pageCardStyle()}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
            Procurement Details
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
            }}
          >
            <div>
              <label style={labelStyle()}>Trade</label>
              <div ref={tradeRef} style={{ position: 'relative' }}>
                <input
                  value={tradeSearch}
                  onChange={(e) => { setTradeSearch(e.target.value); setTradeOpen(true) }}
                  onFocus={() => setTradeOpen(true)}
                  onBlur={() => { setTimeout(() => { setTradeOpen(false); setTradeSearch(form.trade) }, 150) }}
                  placeholder={loadingTrades ? 'Loading trades...' : 'Search trades...'}
                  disabled={loadingTrades}
                  autoComplete="off"
                  style={{ ...inp, opacity: loadingTrades ? 0.7 : 1 }}
                />
                {tradeOpen && displayTrades.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', marginTop: '4px', maxHeight: '220px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
                    {displayTrades.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setField('trade', t.name); setTradeSearch(t.name); setTradeOpen(false) }}
                        style={{ width: '100%', padding: '10px 12px', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: form.trade === t.name ? 'var(--blue-bg)' : 'transparent', color: form.trade === t.name ? 'var(--blue)' : 'var(--text)', cursor: 'pointer', fontSize: '15px' }}
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
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
                style={inp}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle()}>Description</label>
              <input
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Wall framing lumber package"
                required
                style={inp}
              />
            </div>

            <div>
              <label style={labelStyle()}>Company</label>
              <input
                value={form.vendor}
                onChange={(e) => setField('vendor', e.target.value)}
                placeholder="Builders FirstSource"
                style={inp}
              />
            </div>

            <div>
              <label style={labelStyle()}>Procurement Group</label>
              <input
                value={form.procurement_group}
                onChange={(e) => setField('procurement_group', e.target.value)}
                placeholder="Wall package / trim package / rough-in"
                style={inp}
              />
            </div>

            <div>
              <label style={labelStyle()}>Cost Code</label>
              <input
                value={form.cost_code}
                onChange={(e) => setField('cost_code', e.target.value)}
                placeholder="framing_material"
                style={inp}
              />
            </div>

            <div>
              <label style={labelStyle()}>Linked Schedule Item</label>
              <select
                value={form.linked_schedule_id}
                onChange={(e) => setField('linked_schedule_id', e.target.value)}
                style={inp}
              >
                <option value="">None</option>
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

            <div>
              <label style={labelStyle()}>Unit</label>
              <input
                value={form.unit}
                onChange={(e) => setField('unit', e.target.value)}
                placeholder="BF, LS, SQFT"
                style={inp}
              />
            </div>

            <div>
              <label style={labelStyle()}>Qty</label>
              <input
                value={form.qty}
                onChange={(e) => setField('qty', e.target.value)}
                placeholder="14200"
                style={inp}
              />
            </div>

            <div>
              <label style={labelStyle()}>Unit Cost</label>
              <input
                value={form.unit_cost}
                onChange={(e) => setField('unit_cost', e.target.value)}
                placeholder="1.10"
                style={inp}
              />
            </div>
          </div>
        </div>

        <div style={pageCardStyle()}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
            Timing and Coordination
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
            }}
          >
            <div>
              <label style={labelStyle()}>Need On Site</label>
              <input
                type="date"
                value={form.required_on_site_date}
                onChange={(e) => setField('required_on_site_date', e.target.value)}
                style={inp}
              />
            </div>

            <div>
              <label style={labelStyle()}>Lead Days</label>
              <input
                value={form.lead_days}
                onChange={(e) => setField('lead_days', e.target.value)}
                placeholder="7"
                style={inp}
              />
            </div>

            <div>
              <label style={labelStyle()}>Depends On</label>
              <select
                value={form.depends_on}
                onChange={(e) => setField('depends_on', e.target.value)}
                style={inp}
              >
                {DEPENDENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle()}>Selection Reference</label>
              <input
                value={form.selection_reference}
                onChange={(e) => setField('selection_reference', e.target.value)}
                placeholder="Cabinet selection / plumbing trim selection"
                style={inp}
              />
            </div>

            {orderByDate && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'var(--blue-bg)',
                  border: '1px solid var(--blue)',
                  color: 'var(--blue)',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Order by date: {orderByDate}
              </div>
            )}
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
                value={materialSource}
                onChange={(e) =>
                  handleMaterialSourceChange(
                    e.target.value as 'internal' | 'client' | 'company' | 'no_tracking'
                  )
                }
                style={inp}
              >
                <option value="internal">Internal Procurement</option>
                <option value="company">Company Supplied</option>
                <option value="client">Client Supplied</option>
                <option value="no_tracking">No Tracking Required</option>
              </select>
            </div>

            <div
              style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}
            >
              Use internal procurement when Hendren is ordering. Use company supplied
              when the assigned company is bringing materials. Use client supplied when
              the owner is responsible. Use no tracking only when material timing does
              not need active coordination.
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
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Delivery instructions, special requirements, coordination notes..."
              rows={4}
              style={{ ...inp, minHeight: '110px', resize: 'vertical' }}
            />
          </div>
        </div>

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
            onClick={() => router.push(returnTo)}
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--text)',
              color: 'var(--bg)',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: saving ? 0.6 : 1,
              fontSize: '14px',
            }}
          >
            {saving ? 'Saving...' : 'Save Procurement Item'}
          </button>
        </div>
      </form>
    </main>
  )
}