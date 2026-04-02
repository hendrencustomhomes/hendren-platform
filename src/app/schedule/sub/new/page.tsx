'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function NewSubSchedulePage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()

  const jobId = params.get('jobId')

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

  const handleChange = (key: string, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!jobId) {
      alert('Missing jobId in URL')
      return
    }

    setLoading(true)

    const { error } = await supabase.from('sub_schedule').insert([
      {
        job_id: jobId,
        trade: form.trade,
        sub_name: form.sub_name || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
        is_released: form.is_released,
        release_date: form.release_date || null,
        notification_window_days: form.notification_window_days,
        cost_code: form.cost_code || null,
        status: form.status,
        confirmed_date:
          form.status === 'confirmed' ? new Date().toISOString() : null,
      },
    ])

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    router.push(`/jobs/${jobId}`)
  }

  return (
    <main style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 16 }}>Create Schedule Item</h1>

      <form
        onSubmit={handleSubmit}
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
          <option value="complete">Complete</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            border: 'none',
            background: '#111827',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {loading ? 'Saving...' : 'Create Schedule Item'}
        </button>
      </form>
    </main>
  )
}