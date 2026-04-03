'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const JOB_COLORS = [
  '#3B8BD4',
  '#1D9E75',
  '#EF9F27',
  '#D85A30',
  '#7F77DD',
  '#e11d48',
  '#0891b2',
  '#65a30d',
]

const REFERRAL_OPTIONS = [
  'Past Client',
  'Realtor',
  'Architect',
  'Designer',
  'Website',
  'Yard Sign',
  'Other',
]

function cardStyle() {
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
    color: 'var(--text-muted)',
    marginBottom: '6px',
    fontFamily: 'ui-monospace,monospace',
    textTransform: 'uppercase' as const,
    letterSpacing: '.04em',
  }
}

function inputStyle() {
  return {
    width: '100%',
    padding: '12px',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    fontSize: '16px',
    fontFamily: 'system-ui,-apple-system,sans-serif',
    boxSizing: 'border-box' as const,
    outline: 'none',
    color: 'var(--text)',
    background: 'var(--surface)',
  }
}

export default function NewJobPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  const [form, setForm] = useState({
    job_name: '',
    client_name: '',
    project_address: '',
    client_email: '',
    client_phone: '',
    sqft: '',
    lot_sqft: '',
    referral_source: 'Past Client',
    contract_type: 'fixed_price',
    scope_notes: '',
  })

  const inp = useMemo(() => inputStyle(), [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null)
    })
  }, [supabase])

  function setField(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.job_name.trim() || !form.client_name.trim() || !form.project_address.trim()) {
      setError('Job name, client name, and project address are required.')
      return
    }

    setLoading(true)
    setError('')

    const color = JOB_COLORS[Math.floor(Math.random() * JOB_COLORS.length)]

    const { data: job, error: insertError } = await supabase
      .from('jobs')
      .insert({
        job_name: form.job_name.trim(),
        client_name: form.client_name.trim(),
        project_address: form.project_address.trim(),
        client_email: form.client_email.trim() || null,
        client_phone: form.client_phone.trim() || null,
        sqft: form.sqft ? parseInt(form.sqft, 10) : null,
        lot_sqft: form.lot_sqft ? parseInt(form.lot_sqft, 10) : null,
        referral_source: form.referral_source || null,
        contract_type: form.contract_type,
        scope_notes: form.scope_notes.trim() || null,
        color,
        current_stage: 'intake',
        is_active: true,
        pm_id: userId,
      })
      .select('id')
      .single()

    setLoading(false)

    if (insertError) {
      setError(`Error: ${insertError.message}${insertError.code ? ` (code: ${insertError.code})` : ''}`)
      return
    }

    router.push(job?.id ? `/jobs/${job.id}` : '/')
  }

  return (
    <div
      style={{
        fontFamily: 'system-ui,-apple-system,sans-serif',
        background: 'var(--bg)',
        minHeight: '100vh',
        color: 'var(--text)',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <button
          type="button"
          onClick={() => router.push('/')}
          style={{
            fontSize: '14px',
            color: 'var(--blue)',
            textDecoration: 'none',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>

        <div style={{ fontSize: '16px', fontWeight: 700 }}>Create Job</div>
      </div>

      <div style={{ padding: '16px', maxWidth: '760px', margin: '0 auto' }}>
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }}>
            New Job
          </div>
          <div
            style={{
              fontSize: '14px',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
            Create a new job record at the intake stage. Lead and job are the same object in this system.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
          <div style={cardStyle()}>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
              Job Identity
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={labelStyle()}>Job Name</label>
                <input
                  style={inp}
                  value={form.job_name}
                  onChange={(e) => setField('job_name', e.target.value)}
                  placeholder="Lot 12 – Smith Residence"
                  required
                />
              </div>

              <div>
                <label style={labelStyle()}>Project Address</label>
                <input
                  style={inp}
                  value={form.project_address}
                  onChange={(e) => setField('project_address', e.target.value)}
                  placeholder="1234 Maple St, Carmel IN 46032"
                  required
                />
              </div>
            </div>
          </div>

          <div style={cardStyle()}>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
              Client
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={labelStyle()}>Client Name</label>
                <input
                  style={inp}
                  value={form.client_name}
                  onChange={(e) => setField('client_name', e.target.value)}
                  placeholder="Smith Family"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle()}>Client Email</label>
                  <input
                    style={inp}
                    type="email"
                    value={form.client_email}
                    onChange={(e) => setField('client_email', e.target.value)}
                    placeholder="client@example.com"
                  />
                </div>

                <div>
                  <label style={labelStyle()}>Client Phone</label>
                  <input
                    style={inp}
                    type="tel"
                    value={form.client_phone}
                    onChange={(e) => setField('client_phone', e.target.value)}
                    placeholder="(317) 555-1234"
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={cardStyle()}>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
              Project Context
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle()}>Sq Ft</label>
                  <input
                    style={inp}
                    type="number"
                    inputMode="numeric"
                    value={form.sqft}
                    onChange={(e) => setField('sqft', e.target.value)}
                    placeholder="3200"
                  />
                </div>

                <div>
                  <label style={labelStyle()}>Lot Sq Ft</label>
                  <input
                    style={inp}
                    type="number"
                    inputMode="numeric"
                    value={form.lot_sqft}
                    onChange={(e) => setField('lot_sqft', e.target.value)}
                    placeholder="14000"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle()}>Referral Source</label>
                  <select
                    style={inp}
                    value={form.referral_source}
                    onChange={(e) => setField('referral_source', e.target.value)}
                  >
                    {REFERRAL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle()}>Contract Type</label>
                  <select
                    style={inp}
                    value={form.contract_type}
                    onChange={(e) => setField('contract_type', e.target.value)}
                  >
                    <option value="fixed_price">Fixed Price</option>
                    <option value="cost_plus">Cost Plus</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle()}>Scope Notes</label>
                <textarea
                  style={{ ...inp, minHeight: '100px', resize: 'vertical' }}
                  value={form.scope_notes}
                  onChange={(e) => setField('scope_notes', e.target.value)}
                  placeholder="Custom 2-story, 4BR/3BA renovation and addition, early pricing needed..."
                />
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                ...cardStyle(),
                border: '1px solid var(--red)',
                background: 'var(--red-bg)',
                color: 'var(--red)',
                fontSize: '14px',
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
              onClick={() => router.push('/')}
              style={{
                padding: '12px 16px',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '14px',
                fontWeight: 600,
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
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}