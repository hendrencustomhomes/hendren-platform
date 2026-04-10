'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { fetchActiveTrades, type TradeOption } from '@/lib/trades'

type ScheduleFormState = {
  job_id: string | null
  trade: string
  sub_name: string
  start_date: string
  end_date: string
  notes: string
  is_released: boolean
  release_date: string
  notification_window_days: number
  cost_code: string
  status: string
}

const EMPTY_FORM: ScheduleFormState = {
  job_id: null,
  trade: '',
  sub_name: '',
  start_date: '',
  end_date: '',
  notes: '',
  is_released: false,
  release_date: '',
  notification_window_days: 14,
  cost_code: '',
  status: 'tentative',
}

const STATUS_OPTIONS = [
  { value: 'tentative', label: 'Tentative' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'on_site', label: 'On Site' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' },
]

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

export default function EditSubSchedulePage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()

  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const jobParam = searchParams.get('job')
  const returnTo = jobParam ? `/jobs/${jobParam}?tab=subs` : '/schedule'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [form, setForm] = useState<ScheduleFormState>(EMPTY_FORM)
  const [trades, setTrades] = useState<TradeOption[]>([])
  const [loadingTrades, setLoadingTrades] = useState(true)
  const [tradeSearch, setTradeSearch] = useState('')
  const [tradeOpen, setTradeOpen] = useState(false)
  const tradeRef = useRef<HTMLDivElement>(null)

  const inp = useMemo(() => inputStyle(), [])

  const displayTrades = useMemo(() => {
    let base = [...trades]
    // In edit mode, include existing trade if it's not in the active list
    if (form.trade && !base.some((t) => t.name === form.trade)) {
      base = [{ id: '__existing__', name: form.trade, sort_order: -1 }, ...base]
    }
    const q = tradeSearch.trim().toLowerCase()
    if (!q) return base
    return base.filter((t) => t.name.toLowerCase().includes(q))
  }, [trades, form.trade, tradeSearch])

  useEffect(() => {
    if (!id) return

    async function load() {
      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('sub_schedule')
        .select(
          `
          id,
          job_id,
          trade,
          sub_name,
          start_date,
          end_date,
          notes,
          is_released,
          release_date,
          notification_window_days,
          cost_code,
          status
        `
        )
        .eq('id', id)
        .single()

      if (error || !data) {
        setErrorMessage(error?.message || 'Schedule item not found')
        setLoading(false)
        return
      }

      setForm({
        job_id: data.job_id,
        trade: data.trade || '',
        sub_name: data.sub_name || '',
        start_date: data.start_date || '',
        end_date: data.end_date || '',
        notes: data.notes || '',
        is_released: data.is_released ?? false,
        release_date: data.release_date || '',
        notification_window_days: data.notification_window_days ?? 14,
        cost_code: data.cost_code || '',
        status: data.status || 'tentative',
      })
      setTradeSearch(data.trade || '')

      setLoading(false)
    }

    load()
  }, [id, supabase])

  useEffect(() => {
    async function loadTrades() {
      setLoadingTrades(true)
      const data = await fetchActiveTrades(supabase)
      setTrades(data)
      setLoadingTrades(false)
    }
    loadTrades()
  }, [supabase])

  function handleChange(
    key: keyof ScheduleFormState,
    value: string | number | boolean | null
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  function handleReleaseToggle(checked: boolean) {
    setForm((prev) => ({
      ...prev,
      is_released: checked,
      release_date:
        checked && !prev.release_date
          ? new Date().toISOString().slice(0, 10)
          : checked
            ? prev.release_date
            : '',
      status:
        checked && prev.status === 'tentative'
          ? 'scheduled'
          : prev.status,
    }))
  }

  function handleReleaseNow() {
    setForm((prev) => ({
      ...prev,
      is_released: true,
      release_date: prev.release_date || new Date().toISOString().slice(0, 10),
      status: prev.status === 'tentative' ? 'scheduled' : prev.status,
    }))
  }

  function handleMarkConfirmed() {
    setForm((prev) => ({
      ...prev,
      is_released: true,
      release_date: prev.release_date || new Date().toISOString().slice(0, 10),
      status: 'confirmed',
    }))
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()

    if (!id) {
      alert('Missing schedule item id')
      return
    }

    if (!form.job_id) {
      alert('Missing job id')
      return
    }

    if (!form.trade.trim()) {
      alert('Trade is required')
      return
    }

    setSaving(true)

    const normalizedStatus = form.status
    const confirmedDate =
      normalizedStatus === 'confirmed' ? new Date().toISOString() : null

    const { error } = await supabase
      .from('sub_schedule')
      .update({
        trade: form.trade.trim(),
        sub_name: form.sub_name.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes.trim() || null,
        is_released: form.is_released,
        release_date: form.is_released ? form.release_date || null : null,
        notification_window_days: form.notification_window_days,
        cost_code: form.cost_code.trim() || null,
        status: normalizedStatus,
        confirmed_date: confirmedDate,
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
          maxWidth: '760px',
          margin: '0 auto',
          background: 'var(--bg)',
          minHeight: '100vh',
          color: 'var(--text)',
        }}
      >
        Loading schedule item...
      </main>
    )
  }

  if (errorMessage) {
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
        <h1 style={{ marginBottom: '16px', fontSize: '28px' }}>Edit Schedule Item</h1>
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
        maxWidth: '760px',
        margin: '0 auto',
        background: 'var(--bg)',
        minHeight: '100vh',
        color: 'var(--text)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '14px',
        }}
      >
        <div>
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

          <h1 style={{ margin: 0, fontSize: '28px' }}>Edit Schedule Item</h1>
          <div
            style={{
              marginTop: '4px',
              fontSize: '14px',
              color: 'var(--text-muted)',
            }}
          >
            Update trade, assigned company, release state, and coordination details
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!form.is_released && (
            <button
              type="button"
              onClick={handleReleaseNow}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--blue)',
                background: 'var(--blue-bg)',
                color: 'var(--blue)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Release Now
            </button>
          )}

          {form.status !== 'confirmed' && form.status !== 'complete' && (
            <button
              type="button"
              onClick={handleMarkConfirmed}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--green)',
                background: 'var(--green-bg)',
                color: 'var(--green)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Mark Confirmed
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'grid', gap: '12px' }}>
        <div style={pageCardStyle()}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
            Work Details
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
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
                          handleChange('trade', t.name)
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
              <label style={labelStyle()}>Assigned Company</label>
              <input
                placeholder="Company name"
                value={form.sub_name}
                onChange={(e) => handleChange('sub_name', e.target.value)}
                style={inp}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle()}>Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                  style={inp}
                />
              </div>

              <div>
                <label style={labelStyle()}>End Date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => handleChange('end_date', e.target.value)}
                  style={inp}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle()}>Status</label>
              <select
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
                style={inp}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle()}>Notes</label>
              <textarea
                placeholder="Scope notes, coordination notes, access constraints..."
                value={form.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={4}
                style={{ ...inp, minHeight: '110px', resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={labelStyle()}>Cost Code</label>
              <input
                placeholder="ex: plumbing_labor"
                value={form.cost_code}
                onChange={(e) => handleChange('cost_code', e.target.value)}
                style={inp}
              />
            </div>
          </div>
        </div>

        <div style={pageCardStyle()}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
            Release Settings
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '15px',
                color: 'var(--text)',
              }}
            >
              <input
                type="checkbox"
                checked={form.is_released}
                onChange={(e) => handleReleaseToggle(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              Released to company
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle()}>Release Date</label>
                <input
                  type="date"
                  value={form.release_date}
                  onChange={(e) => handleChange('release_date', e.target.value)}
                  disabled={!form.is_released}
                  style={{
                    ...inp,
                    opacity: form.is_released ? 1 : 0.6,
                  }}
                />
              </div>

              <div>
                <label style={labelStyle()}>Notification Window (Days)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.notification_window_days}
                  onChange={(e) =>
                    handleChange(
                      'notification_window_days',
                      Number(e.target.value || 0)
                    )
                  }
                  style={inp}
                />
              </div>
            </div>

            <div
              style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}
            >
              Release controls whether this item is ready for company-facing coordination.
              Draft items can stay internal until planning is ready.
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
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
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              fontSize: '14px',
            }}
          >
            {saving ? 'Saving...' : 'Save Schedule Item'}
          </button>
        </div>
      </form>
    </main>
  )
}