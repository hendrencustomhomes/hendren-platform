'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

const JOB_COLORS = ['#3B8BD4','#1D9E75','#EF9F27','#D85A30','#7F77DD','#e11d48','#0891b2','#65a30d']

export default function NewJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [form, setForm] = useState({
  client_name: '',
  project_address: '',
  sqft: '',
  lot_sqft: '',
  referral_source: 'Referral',
  scope_notes: '',
})

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id || null))
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_name || !form.project_address) {
      setError('Client name and project address are required.')

      setError('Client name and project_address are required.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const color = JOB_COLORS[Math.floor(Math.random() * JOB_COLORS.length)]
    const { data: job, error: err } = await supabase
      .from('jobs')
      .insert({
        client_name: form.client_name.trim(),
        project_address: form.project_address.trim(),

        project_project_project_project_address: form.project_address.trim(),
        sqft: form.sqft ? parseInt(form.sqft) : null,
        lot_sqft: form.lot_sqft ? parseInt(form.lot_sqft) : null,
        referral_source: form.referral_source,
        scope_notes: form.scope_notes.trim() || null,
        color,
        current_stage: 'intake',
        is_active: true,
        pm_id: userId,
      })
      .select()
      .single()
    setLoading(false)
    if (err) {
      setError('Error: ' + err.message + ' (code: ' + err.code + ')')
      return
    }
    router.push('/')
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px', border: '1px solid #ccc',
    borderRadius: '7px', fontSize: '13px', fontFamily: 'ui-monospace, monospace',
    boxSizing: 'border-box' as const, outline: 'none',
    color: '#1a1a18', backgroundColor: '#fff'
  }
  const labelStyle = {
    display: 'block' as const, fontSize: '11px', color: '#777',
    marginBottom: '4px', fontFamily: 'ui-monospace, monospace',
    textTransform: 'uppercase' as const, letterSpacing: '0.04em'
  }

  return (
    <div style={{ fontFamily: 'system-ui', background: '#f7f6f3', minHeight: '100vh' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e2dfd8', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/" style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none' }}>Back</a>
        <div style={{ fontSize: '15px', fontWeight: '700' }}>New Job</div>
      </div>
      <div style={{ padding: '16px', maxWidth: '560px', margin: '0 auto' }}>
        <div style={{ background: '#fff', border: '1px solid #e2dfd8', borderRadius: '10px', padding: '20px' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Client Name</label>
                <input style={inputStyle} value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="Smith Family" required />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Project Address</label>

                <label style={labelStyle}>Project Project Project Address</label>
                <input style={inputStyle} value={form.project_address} onChange={e => set('project_address', e.target.value)} placeholder="1234 Maple St, Carmel IN 46032" required />
              </div>
              <div>
                <label style={labelStyle}>Sq Ft</label>
                <input style={inputStyle} type="number" value={form.sqft} onChange={e => set('sqft', e.target.value)} placeholder="3200" />
              </div>
              <div>
                <label style={labelStyle}>Lot Sqft</label>
                <input style={inputStyle} type="number" value={form.lot_sqft} onChange={e => set('lot_sqft', e.target.value)} placeholder="14000" />
              </div>
              <div>
                <label style={labelStyle}>Referral</label>
                <select style={inputStyle} value={form.referral_source} onChange={e => set('referral_source', e.target.value)}>
                  {['Referral','Website','Houzz','Social','Other'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Scope Notes</label>
                <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={form.scope_notes} onChange={e => set('scope_notes', e.target.value)} placeholder="Custom 2-story, 4BR/3BA..." />
              </div>
            </div>
            {error && <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '12px' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <a href="/" style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: '7px', fontSize: '13px', fontWeight: '600', textDecoration: 'none', color: '#666' }}>Cancel</a>
              <button type="submit" disabled={loading} style={{ padding: '8px 16px', background: loading ? '#ccc' : '#1a1a18', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Creating...' : 'Create Job'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
