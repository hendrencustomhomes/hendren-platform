'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const STATUS_OPTIONS = [
  { value: 'tentative', label: 'Tentative' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'confirmed', label: 'Confirmed' },
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

export default function NewSubSchedulePage() {
  const supabase = createClient()
  const router = useRouter()

  const [jobId, setJobId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
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
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setJobId(params.get('jobId'))
  }, [])

  const inp = useMemo(() => inputStyle(), [])

  function handleChange(key: string, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }))
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!jobId) {
      alert('Missing jobId in URL')
      return
    }

    if (!form.trade.trim()) {
      alert('Trade is required')
      return
    }

    setLoading(true)

    const payload = {
      job_id: jobId,
      trade: form.trade.trim(),
      sub_name: form.sub_name.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      notes: form.notes.trim() || null,
      is_released: form.is_released,
      release_date: form.is_released ? form.release_date || null : null,
      notification_window_days: Number.isFinite(form.notification_window_days)
        ? form.notification_window_days
        : 14,
      cost_code: form.cost_code.trim() || null,
      status: form.status,
      confirmed_date:
        form.status === 'confirmed' ? new Date().toISOString() : null,
    }

    const { error } = await supabase.from('sub_schedule').insert([payload])

    setLoading(false)

    if (error) {
      console.error('SUB SCHEDULE INSERT ERROR:', error)
      alert(error.message)
      return
    }

    router.push(`/jobs/${jobId}`)
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
          onClick={() => {
            if (jobId) router.push(`/jobs/${jobId}`)
            else router.push('/schedule')
          }}
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

        <h1 style={{ margin: 0, fontSize: '28px' }}>Create Schedule Item</h1>
        <div
          style={{
            marginTop: '4px',
            fontSize: '14px',
            color: 'var(--text-muted)',
          }}
        >
          Add a planned work item for a trade and assigned company
        </div>
      </div>

      {!jobId && (
        <div
          style={{
            ...pageCardStyle(),
            marginBottom: '12px',
            border: '1px solid rgba(217, 119, 6, 0.35)',
            background: 'rgba(217, 119, 6, 0.08)',
            color: 'var(--amber)',
          }}
        >
          Missing <code>jobId</code> in URL. Open this page from a job or from the
          schedule page with a selected job.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
        <div style={pageCardStyle()}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
            Work Details
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={labelStyle()}>Trade</label>
              <input
                placeholder="Plumbing, Framing, Electrical..."
                value={form.trade}
                onChange={(e) => handleChange('trade', e.target.value)}
                required
                style={inp}
              />
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
              Release controls whether this item is considered ready for company-facing
              coordination. Draft items can exist internally before they are released.
            </div>
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
            onClick={() => {
              if (jobId) router.push(`/jobs/${jobId}`)
              else router.push('/schedule')
            }}
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
            disabled={loading || !jobId}
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--text)',
              color: 'var(--bg)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: loading || !jobId ? 'not-allowed' : 'pointer',
              opacity: loading || !jobId ? 0.6 : 1,
            }}
          >
            {loading ? 'Saving...' : 'Create Schedule Item'}
          </button>
        </div>
      </form>
    </main>
  )
}
