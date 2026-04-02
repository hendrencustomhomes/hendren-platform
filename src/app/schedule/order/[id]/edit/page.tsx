'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const TRADES = [
  'Concrete/Foundation',
  'Framing',
  'Rough Electrical',
  'Rough Plumbing',
  'HVAC',
  'Insulation',
  'Drywall',
  'Finish Electrical',
  'Finish Plumbing',
  'Tile',
  'Flooring',
  'Cabinetry',
  'Trim/Millwork',
  'Paint',
  'Exterior/Roofing',
  'Landscaping',
  'Demo',
  'Other',
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
  trade: 'Framing',
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

export default function EditOrderPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()

  const id = Array.isArray(params.id) ? params.id[0] : params.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [form, setForm] = useState<OrderFormState>(EMPTY_FORM)
  const [scheduleOptions, setScheduleOptions] = useState<any[]>([])

  useEffect(() => {
    if (!id) return

    const load = async () => {
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
        setErrorMessage(error?.message || 'Order not found')
        setLoading(false)
        return
      }

      setForm({
        job_id: data.job_id,
        trade: data.trade || 'Framing',
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

      if (data.job_id) {
        const { data: subs } = await supabase
          .from('sub_schedule')
          .select('id, trade, sub_name, start_date')
          .eq('job_id', data.job_id)
          .order('start_date', { ascending: true, nullsFirst: false })

        setScheduleOptions(subs || [])
      }

      setLoading(false)
    }

    load()
  }, [id, supabase])

  const setField = (key: keyof OrderFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleMaterialSourceChange = (source: 'internal' | 'client' | 'company' | 'none') => {
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

    if (source === 'none') {
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
      : form.requires_tracking
        ? 'internal'
        : 'none'

  const orderByDate =
    form.required_on_site_date && form.lead_days
      ? new Date(
          new Date(form.required_on_site_date).getTime() -
            parseInt(form.lead_days || '0', 10) * 86400000
        ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (!id) {
      alert('Missing order id')
      return
    }

    if (!form.job_id || !form.description.trim()) {
      alert('Job and description are required')
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('procurement_items')
      .update({
        trade: form.trade,
        description: form.description.trim(),
        vendor: form.vendor || null,
        qty: form.qty ? parseFloat(form.qty) : null,
        unit: form.unit || null,
        unit_cost: form.unit_cost ? parseFloat(form.unit_cost) : null,
        lead_days: parseInt(form.lead_days || '0', 10) || 0,
        required_on_site_date: form.required_on_site_date || null,
        status: form.status,
        depends_on: form.depends_on,
        selection_reference: form.selection_reference || null,
        notes: form.notes || null,
        cost_code: form.cost_code || null,
        procurement_group: form.procurement_group || null,
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

    router.push(`/jobs/${form.job_id}`)
  }

  if (loading) {
    return <main style={{ padding: 20 }}>Loading order...</main>
  }

  if (errorMessage) {
    return (
      <main style={{ padding: 20, maxWidth: 860, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 16 }}>Edit Material Order</h1>
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
          }}
        >
          {errorMessage}
        </div>
      </main>
    )
  }

  const inp = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
  }

  const lbl = {
    display: 'block' as const,
    fontSize: '11px',
    fontWeight: 700,
    color: '#6b7280',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '.04em',
  }

  return (
    <main style={{ padding: 20, maxWidth: 860, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 16 }}>Edit Material Order</h1>

      <form onSubmit={handleSave}>
        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            <div>
              <label style={lbl}>Trade *</label>
              <select
                value={form.trade}
                onChange={(e) => setField('trade', e.target.value)}
                style={inp}
              >
                {TRADES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={lbl}>Status</label>
              <select
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
                style={inp}
              >
                {['Pending', 'Ordered', 'Confirmed', 'Will Call', 'Delivered', 'Issue'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Description *</label>
              <input
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Wall framing lumber package"
                required
                style={inp}
              />
            </div>

            <div>
              <label style={lbl}>Vendor / Supplier</label>
              <input
                value={form.vendor}
                onChange={(e) => setField('vendor', e.target.value)}
                placeholder="Builders FirstSource"
                style={inp}
              />
            </div>

            <div>
              <label style={lbl}>Procurement Group</label>
              <input
                value={form.procurement_group}
                onChange={(e) => setField('procurement_group', e.target.value)}
                placeholder="Wall Package / Trim Package / Rough-In"
                style={inp}
              />
            </div>

            <div>
              <label style={lbl}>Cost Code</label>
              <input
                value={form.cost_code}
                onChange={(e) => setField('cost_code', e.target.value)}
                placeholder="framing_material"
                style={inp}
              />
            </div>

            <div>
              <label style={lbl}>Linked Schedule Item</label>
              <select
                value={form.linked_schedule_id}
                onChange={(e) => setField('linked_schedule_id', e.target.value)}
                style={inp}
              >
                <option value="">None</option>
                {scheduleOptions.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.trade}
                    {sub.sub_name ? ` · ${sub.sub_name}` : ''}
                    {sub.start_date
                      ? ` · ${new Date(sub.start_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={lbl}>Unit</label>
              <input
                value={form.unit}
                onChange={(e) => setField('unit', e.target.value)}
                placeholder="BF, LS, SQFT"
                style={inp}
              />
            </div>

            <div>
              <label style={lbl}>Qty</label>
              <input
                value={form.qty}
                onChange={(e) => setField('qty', e.target.value)}
                placeholder="14200"
                style={inp}
              />
            </div>

            <div>
              <label style={lbl}>Unit Cost ($)</label>
              <input
                value={form.unit_cost}
                onChange={(e) => setField('unit_cost', e.target.value)}
                placeholder="1.10"
                style={inp}
              />
            </div>

            <div>
              <label style={lbl}>Need On Site</label>
              <input
                type="date"
                value={form.required_on_site_date}
                onChange={(e) => setField('required_on_site_date', e.target.value)}
                style={inp}
              />
            </div>

            <div>
              <label style={lbl}>Lead Days</label>
              <input
                value={form.lead_days}
                onChange={(e) => setField('lead_days', e.target.value)}
                placeholder="7"
                style={inp}
              />
            </div>

            <div>
              <label style={lbl}>Depends On</label>
              <select
                value={form.depends_on}
                onChange={(e) => setField('depends_on', e.target.value)}
                style={inp}
              >
                <option value="contract_signed">Contract Signed</option>
                <option value="selection_locked">Selection Locked</option>
                <option value="none">None</option>
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Selection Reference</label>
              <input
                value={form.selection_reference}
                onChange={(e) => setField('selection_reference', e.target.value)}
                placeholder="Cabinet selection / plumbing trim selection"
                style={inp}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Material Source / Tracking</label>
              <select
                value={materialSource}
                onChange={(e) =>
                  handleMaterialSourceChange(
                    e.target.value as 'internal' | 'client' | 'company' | 'none'
                  )
                }
                style={inp}
              >
                <option value="internal">Internal Procurement</option>
                <option value="company">Company Supplied / Track Readiness</option>
                <option value="client">Client Supplied / Track Readiness</option>
                <option value="none">No Tracking Required</option>
              </select>
            </div>

            {orderByDate && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  padding: 12,
                  borderRadius: 10,
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1d4ed8',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Order by date: {orderByDate}
              </div>
            )}

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Delivery instructions, special requirements..."
                rows={4}
                style={{ ...inp, resize: 'vertical' as const }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => router.push(form.job_id ? `/jobs/${form.job_id}` : '/schedule')}
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#111827',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: 'none',
              background: '#111827',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Order'}
          </button>
        </div>
      </form>
    </main>
  )
}
