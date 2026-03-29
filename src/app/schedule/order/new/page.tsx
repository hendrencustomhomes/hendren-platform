'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

const TRADES = ['Concrete/Foundation','Framing','Rough Electrical','Rough Plumbing','HVAC','Insulation','Drywall','Finish Electrical','Finish Plumbing','Tile','Flooring','Cabinetry','Trim/Millwork','Paint','Exterior/Roofing','Landscaping','Demo','Other']

export default function NewOrderPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    job_id: sp.get('job')||'', trade: 'Framing', description: '', vendor: '',
    qty: '', unit: '', unit_cost: '', lead_days: '7',
    required_on_site_date: '', status: 'Pending',
    depends_on: 'contract_signed', selection_reference: '', notes: '',
  })

  useEffect(() => {
    createClient().from('jobs').select('id,client_name,color').eq('is_active',true).order('created_at',{ascending:false}).then(({data}) => setJobs(data||[]))
  }, [])

  function set(k: string, v: any) { setForm(f => ({...f,[k]:v})) }

  // Calculate order_by_date for preview
  const orderByDate = form.required_on_site_date && form.lead_days
    ? new Date(new Date(form.required_on_site_date).getTime() - parseInt(form.lead_days)*86400000).toLocaleDateString('en-US',{month:'short',day:'numeric'})
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.job_id || !form.description) { setError('Job and description are required'); return }
    setLoading(true); setError('')
    const { error: err } = await createClient().from('procurement_items').insert({
      job_id: form.job_id, trade: form.trade, description: form.description,
      vendor: form.vendor||null, qty: form.qty?parseFloat(form.qty):null,
      unit: form.unit||null, unit_cost: form.unit_cost?parseFloat(form.unit_cost):null,
      lead_days: parseInt(form.lead_days)||0,
      required_on_site_date: form.required_on_site_date||null,
      status: form.status, depends_on: form.depends_on,
      selection_reference: form.selection_reference||null,
      notes: form.notes||null,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    router.push('/schedule')
  }

  const inp = { width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:'7px', fontSize:'13px', fontFamily:'ui-monospace,monospace', boxSizing:'border-box' as const, outline:'none', background:'var(--surface)', color:'var(--text)' }
  const lbl = { display:'block' as const, fontSize:'11px', color:'var(--text-muted)', marginBottom:'4px', fontFamily:'ui-monospace,monospace', textTransform:'uppercase' as const, letterSpacing:'.04em' }

  return (
    <div style={{fontFamily:'system-ui,-apple-system,sans-serif',background:'var(--bg)',minHeight:'100vh',color:'var(--text)'}}>
      <div style={{background:'var(--surface)',borderBottom:'1px solid var(--border)',padding:'12px 16px',display:'flex',alignItems:'center',gap:'10px',position:'sticky',top:0,zIndex:100}}>
        <a href="/schedule" style={{fontSize:'13px',color:'var(--blue)',textDecoration:'none'}}>← Schedule</a>
        <div style={{fontSize:'15px',fontWeight:'700'}}>Add Material Order</div>
      </div>
      <div style={{padding:'16px',maxWidth:'560px',margin:'0 auto'}}>
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px',padding:'20px'}}>
          <form onSubmit={handleSubmit}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
              <div style={{gridColumn:'1 / -1'}}>
                <label style={lbl}>Job *</label>
                <select style={inp} value={form.job_id} onChange={e=>set('job_id',e.target.value)} required>
                  <option value="">Select a job...</option>
                  {jobs.map(j=><option key={j.id} value={j.id}>{j.client_name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Trade *</label>
                <select style={inp} value={form.trade} onChange={e=>set('trade',e.target.value)}>
                  {TRADES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select style={inp} value={form.status} onChange={e=>set('status',e.target.value)}>
                  {['Pending','Ordered','Confirmed','Delivered','Issue'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{gridColumn:'1 / -1'}}>
                <label style={lbl}>Description *</label>
                <input style={inp} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Wall framing lumber 2x6" required />
              </div>
              <div>
                <label style={lbl}>Vendor</label>
                <input style={inp} value={form.vendor} onChange={e=>set('vendor',e.target.value)} placeholder="Builders FirstSource" />
              </div>
              <div>
                <label style={lbl}>Unit</label>
                <input style={inp} value={form.unit} onChange={e=>set('unit',e.target.value)} placeholder="BF, LS, SQFT" />
              </div>
              <div>
                <label style={lbl}>Qty</label>
                <input style={inp} type="number" value={form.qty} onChange={e=>set('qty',e.target.value)} placeholder="14200" />
              </div>
              <div>
                <label style={lbl}>Unit Cost ($)</label>
                <input style={inp} type="number" step="0.01" value={form.unit_cost} onChange={e=>set('unit_cost',e.target.value)} placeholder="1.10" />
              </div>
              <div>
                <label style={lbl}>Need On Site</label>
                <input style={inp} type="date" value={form.required_on_site_date} onChange={e=>set('required_on_site_date',e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Lead Days</label>
                <input style={inp} type="number" value={form.lead_days} onChange={e=>set('lead_days',e.target.value)} placeholder="7" />
              </div>
              {orderByDate && (
                <div style={{gridColumn:'1 / -1',background:'var(--blue-bg)',border:'1px solid var(--blue)',borderRadius:'7px',padding:'8px 12px',fontSize:'12px',color:'var(--blue)'}}>
                  📅 Order by date: <strong>{orderByDate}</strong>
                </div>
              )}
              <div>
                <label style={lbl}>Depends On</label>
                <select style={inp} value={form.depends_on} onChange={e=>set('depends_on',e.target.value)}>
                  <option value="contract_signed">Contract Signed</option>
                  <option value="selection_locked">Selection Locked</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Selection Ref</label>
                <input style={inp} value={form.selection_reference} onChange={e=>set('selection_reference',e.target.value)} placeholder="Cabinet selection" />
              </div>
              <div style={{gridColumn:'1 / -1'}}>
                <label style={lbl}>Notes</label>
                <textarea style={{...inp,minHeight:'70px',resize:'vertical'}} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Delivery instructions, special requirements..." />
              </div>
            </div>
            {error && <div style={{fontSize:'12px',color:'var(--red)',marginBottom:'12px'}}>{error}</div>}
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <a href="/schedule" style={{padding:'8px 16px',border:'1px solid var(--border)',borderRadius:'7px',fontSize:'13px',fontWeight:'600',textDecoration:'none',color:'var(--text-muted)'}}>Cancel</a>
              <button type="submit" disabled={loading} style={{padding:'8px 16px',background:loading?'var(--border)':'var(--text)',color:'var(--bg)',border:'none',borderRadius:'7px',fontSize:'13px',fontWeight:'600',cursor:loading?'not-allowed':'pointer'}}>
                {loading?'Saving...':'Add Order'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
