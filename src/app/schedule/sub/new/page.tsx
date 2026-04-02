'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

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

    // NEW FIELDS
    is_released: false,
    release_date: '',
    notification_window_days: 14,
    cost_code: '',

    status: 'tentative',
  })

  const handleChange = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.from('sub_schedule').insert([
      {
        job_id: jobId,
        ...form,
        confirmed_date: form.status === 'confirmed' ? new Date().toISOString() : null,
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
    <div style={{ padding: 20 }}>
      <h1>Create Schedule Item</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        <input
          placeholder="Trade (Plumbing, Framing, etc)"
          value={form.trade}
          onChange={e => handleChange('trade', e.target.value)}
          required
        />

        <input
          placeholder="Company Name"
          value={form.sub_name}
          onChange={e => handleChange('sub_name', e.target.value)}
        />

        <input
          type="date"
          value={form.start_date}
          onChange={e => handleChange('start_date', e.target.value)}
        />

        <input
          type="date"
          value={form.end_date}
          onChange={e => handleChange('end_date', e.target.value)}
        />

        <textarea
          placeholder="Notes"
          value={form.notes}
          onChange={e => handleChange('notes', e.target.value)}
        />

        {/* COST CODE */}
        <input
          placeholder="Cost Code (ex: plumbing_labor)"
          value={form.cost_code}
          onChange={e => handleChange('cost_code', e.target.value)}
        />

        {/* RELEASE CONTROL */}
        <label>
          <input
            type="checkbox"
            checked={form.is_released}
            onChange={e => handleChange('is_released', e.target.checked)}
          />
          Released to Sub
        </label>

        <input
          type="date"
          value={form.release_date}
          onChange={e => handleChange('release_date', e.target.value)}
        />

        <input
          type="number"
          placeholder="Notification Window (days)"
          value={form.notification_window_days}
          onChange={e => handleChange('notification_window_days', Number(e.target.value))}
        />

        {/* STATUS */}
        <select
          value={form.status}
          onChange={e => handleChange('status', e.target.value)}
        >
          <option value="tentative">Tentative</option>
          <option value="scheduled">Scheduled</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
        </select>

        <button disabled={loading}>
          {loading ? 'Saving...' : 'Create Schedule Item'}
        </button>

      </form>
    </div>
  )
}