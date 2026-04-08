'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

const STATE_ABBREV: Record<string, string> = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
  'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
  'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA',
  'Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD',
  'Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO',
  'Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ',
  'New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH',
  'Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
  'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
  'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
}

function composeAddress(street: string, city: string, state: string, zip: string): string {
  const s = street.trim(), c = city.trim(), st = state.trim(), z = zip.trim()
  const cityStateZip = [c, [st, z].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return [s, cityStateZip].filter(Boolean).join(', ')
}

function formatSuggestion(s: any): string {
  const a = s.address || {}
  const street = [a.house_number, a.road].filter(Boolean).join(' ')
  const city = a.city || a.town || a.municipality || a.village || a.suburb || a.hamlet || a.county || ''
  const state = STATE_ABBREV[a.state] || a.state || ''
  const zip = a.postcode?.split('-')[0] || ''
  return [street, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

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
    addr_street: '',
    addr_city: '',
    addr_state: '',
    addr_zip: '',
    client_email: '',
    client_phone: '',
    sqft: '',
    lot_sqft: '',
    referral_source: 'Past Client',
    contract_type: 'fixed_price',
    scope_notes: '',
  })
  const [addrSuggestions, setAddrSuggestions] = useState<any[]>([])
  const addrTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const inp = useMemo(() => inputStyle(), [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null)
    })
  }, [supabase])

  function setField(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleStreetChange(val: string) {
    setField('addr_street', val)
    if (addrTimer.current) clearTimeout(addrTimer.current)
    if (val.trim().length < 4) { setAddrSuggestions([]); return }
    addrTimer.current = setTimeout(async () => {
      try {
        // Use structured street= param when input starts with a house number.
        // Nominatim resolves partial road names far better via street= than q=.
        const startsWithNum = /^\d/.test(val.trim())
        const params = startsWithNum
          ? `street=${encodeURIComponent(val)}&state=Indiana&countrycodes=us&format=json&addressdetails=1&limit=8&viewbox=-87.41,41.72,-86.81,41.22`
          : `q=${encodeURIComponent(val)}&format=json&addressdetails=1&countrycodes=us&limit=8&viewbox=-87.41,41.72,-86.81,41.22`
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?${params}`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const data: any[] = await res.json()
        const withRoad = data.filter((s: any) => s.address?.road)
        // Sort: Porter County 463xx first, then Lake County 464xx, then any Indiana 46x, then rest
        withRoad.sort((a: any, b: any) => {
          const score = (x: any) => {
            const z: string = x.address?.postcode || ''
            if (z.startsWith('463')) return 3
            if (z.startsWith('464')) return 2
            if (z.startsWith('46')) return 1
            return 0
          }
          return score(b) - score(a)
        })
        setAddrSuggestions(withRoad.slice(0, 5))
      } catch { setAddrSuggestions([]) }
    }, 500)
  }

  function applyAddrSuggestion(s: any) {
    const a = s.address || {}
    setForm((f) => ({
      ...f,
      addr_street: [a.house_number, a.road].filter(Boolean).join(' '),
      addr_city: a.city || a.town || a.municipality || a.village || a.suburb || a.hamlet || a.county || '',
      addr_state: STATE_ABBREV[a.state] || a.state || '',
      addr_zip: a.postcode?.split('-')[0] || '',
    }))
    setAddrSuggestions([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.job_name.trim() || !form.client_name.trim() || !form.addr_street.trim()) {
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
        project_address: composeAddress(form.addr_street, form.addr_city, form.addr_state, form.addr_zip) || null,
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
                <label style={labelStyle()}>Street</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={inp}
                    value={form.addr_street}
                    onChange={(e) => handleStreetChange(e.target.value)}
                    onBlur={() => setTimeout(() => setAddrSuggestions([]), 150)}
                    placeholder="166 W Lincolnway"
                    autoComplete="address-line1"
                    required
                  />
                  {addrSuggestions.length > 0 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:50, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', marginTop:'4px', boxShadow:'0 4px 16px rgba(0,0,0,0.14)', overflow:'hidden' }}>
                      {addrSuggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onMouseDown={() => applyAddrSuggestion(s)}
                          style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 14px', background:'none', border:'none', borderBottom: i < addrSuggestions.length - 1 ? '1px solid var(--border)' : 'none', cursor:'pointer', fontSize:'13px', color:'var(--text)', fontFamily:'system-ui,-apple-system,sans-serif' }}
                        >
                          {formatSuggestion(s)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px', gap: '12px' }}>
                <div>
                  <label style={labelStyle()}>City</label>
                  <input style={inp} value={form.addr_city} onChange={(e) => setField('addr_city', e.target.value)} placeholder="Valparaiso" autoComplete="address-level2" />
                </div>
                <div>
                  <label style={labelStyle()}>State</label>
                  <input style={inp} value={form.addr_state} onChange={(e) => setField('addr_state', e.target.value)} placeholder="IN" maxLength={2} autoComplete="address-level1" />
                </div>
                <div>
                  <label style={labelStyle()}>ZIP</label>
                  <input style={inp} value={form.addr_zip} onChange={(e) => setField('addr_zip', e.target.value)} placeholder="46383" inputMode="numeric" autoComplete="postal-code" />
                </div>
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