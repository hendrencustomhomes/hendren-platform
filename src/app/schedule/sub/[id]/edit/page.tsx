'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

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

export default function EditSubSchedulePage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()

  const id = Array.isArray(params.id) ? params.id[0] : params.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [form, setForm] = useState<ScheduleFormState>(EMPTY_FORM)

  useEffect(() => {
    if (!id) return

    const load = async () => {
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

      setLoading(false)
    }

    load()
  }, [id, supabase])

  const handleChange = (key: keyof ScheduleFormState, value: string | number | boolean | null) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!id) {
      alert('Missing schedule item id')
      return
    }

    if (!form.job_id) {
      alert('Missing job id')
      return
    }

    setSaving(true)

    const normalizedStatus = form.status
    const confirmedDate =
      normalizedStatus === 'confirmed' ? new Date().toISOString() : null

    const { error } = await supabase
      .from('sub_schedule')
      .update({
        trade: form.trade,
        sub_name: form.sub_name || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
        is_released: form.is_released,
        release_date: form.release_date || null,
        notification_window_days: form.notification_window_days,
        cost_code: form.cost_code || null,
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

    router.push(`/jobs/${form.job_id}`)
  }

  const handleReleaseNow = () => {
    const today = new Date().toISOString().slice(0, 10)
    handleChange('is_released', true)
    if (!form.release_date) handleChange('release_date', today)
  }

  const handleMarkConfirmed = () => {
    if (!form.is_released) {
      const releaseAnyway = window.confirm(
        'This item is not marked released. Mark it released and confirmed?'
      )
      if (!releaseAnyway) return
      handleReleaseNow()
    }
    handleChange('status', 'confirmed')
  }

  if (loading) {
    return <main style={{ padding: 20 }}>Loading schedule item...</main>
  }

  if (errorMessage) {
    return (
      <main style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 16 }}>Edit Schedule Item</h1>
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

  return (
    <main style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0 }}>Edit Schedule Item</h1>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!form.is_released && (
            <button
              type="button"
              onClick={handleReleaseNow}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #2563eb',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 600,
                cursor: 'pointer',
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
                borderRadius: 10,
                border: '1px solid #16a34a',
                background: '#f0fdf4',
                color: '#166534',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Mark Confirmed
            </button>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSave}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <input
          placeholder="Trade (Plumbing, Framing, etc.)"
          value={form.trade}
          onChange={(e) => handleChange('trade', e.target.value)}
          required
          style={{ padding: 10 }}
        />

        <input
          placeholder="Company Name"
          value={form.sub_name}
          onChange={(e) => handleChange('sub_name', e.target.value)}
          style={{ padding: 10 }}
        />

        <input
          type="date"
          value={form.start_date}
          onChange={(e) => handleChange('start_date', e.target.value)}
          style={{ padding: 10 }}
        />

        <input
          type="date"
          value={form.end_date}
          onChange={(e) => handleChange('end_date', e.target.value)}
          style={{ padding: 10 }}
        />

        <textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={4}
          style={{ padding: 10 }}
        />

        <input
          placeholder="Cost Code (ex: plumbing_labor)"
          value={form.cost_code}
          onChange={(e) => handleChange('cost_code', e.target.value)}
          style={{ padding: 10 }}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={form.is_released}
            onChange={(e) => handleChange('is_released', e.target.checked)}
          />
          Released to Company
        </label>

        <input
          type="date"
          value={form.release_date}
          onChange={(e) => handleChange('release_date', e.target.value)}
          style={{ padding: 10 }}
        />

        <input
          type="number"
          placeholder="Notification Window (days)"
          value={form.notification_window_days}
          onChange={(e) =>
            handleChange('notification_window_days', Number(e.target.value))
          }
          style={{ padding: 10 }}
        />

        <select
          value={form.status}
          onChange={(e) => handleChange('status', e.target.value)}
          style={{ padding: 10 }}
        >
          <option value="tentative">Tentative</option>
          <option value="scheduled">Scheduled</option>
          <option value="confirmed">Confirmed</option>
          <option value="on_site">On Site</option>
          <option value="complete">Complete</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
            {saving ? 'Saving...' : 'Save Schedule Item'}
          </button>

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
        </div>
      </form>
    </main>
  )
}
