'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

const TRADES = ['Concrete/Foundation','Framing','Rough Electrical','Rough Plumbing','HVAC','Insulation','Drywall','Finish Electrical','Finish Plumbing','Tile','Flooring','Cabinetry','Trim/Millwork','Paint','Exterior/Roofing','Landscaping','Demo','Other']

export default function NewSubPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    job_id: '', trade: 'Framing', sub_name: '', trade_contact: '',
    status: 'tentative', start_date: '', end_date: '', notes: '',
    depends_on: 'contract_signed', is_critical_path: false,
  })

  useEffect(() => {
    createClient().from('jobs').select('id,client_name,color').eq('is_active',true).order('created_at',{ascending:false}).then(({data}) => setJobs(data||[]))
  }, [])

  function set(k: string, v: any) { setForm(f => ({...f,[k]:v})) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.job_id || !form.trade) { setError('Job and trade are required'); return }
    setLoading(true); setError('')
    const { error: err } = await createClient().from('sub_schedule').insert({
      job_id: form.job_id, trade: form.trade, sub_name: form.sub_name||null,
      trade_contact: form.trade_contact||null, status: form.status,
      start_date: form.start_date||null, end_date: form.end_date||null,
      notes: form.notes||null, depends_on: form.depends_on,
      is_critical_path: form.is_critical_path,
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
        <div style={{fontSize:'15px',fontWeight:'700'}}>Add Sub Schedule Entry</div>
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
                  {['tentative','confirmed','on_site','complete','cancelled'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Sub / Company</label>
                <input style={inp} value={form.sub_name} onChange={e=>set('sub_name',e.target.value)} placeholder="ABC Framing Co" />
              </div>
              <div>
                <label style={lbl}>Contact</label>
                <input style={inp} value={form.trade_contact} onChange={e=>set('trade_contact',e.target.value)} placeholder="John Smith" />
              </div>
              <div>
                <label style={lbl}>Start Date</label>
                <input style={inp} type="date" value={form.start_date} onChange={e=>set('start_date',e.target.value)} />
              </div>
              <div>
                <label style={lbl}>End Date</label>
                <input style={inp} type="date" value={form.end_date} onChange={e=>set('end_date',e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Depends On</label>
                <select style={inp} value={form.depends_on} onChange={e=>set('depends_on',e.target.value)}>
                  <option value="contract_signed">Contract Signed</option>
                  <option value="selection_locked">Selection Locked</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'8px',paddingTop:'20px'}}>
                <input type="checkbox" id="crit" checked={form.is_critical_path} onChange={e=>set('is_critical_path',e.target.checked)} style={{width:'15px',height:'15px',accentColor:'var(--blue)'}} />
                <label htmlFor="crit" style={{fontSize:'12px',cursor:'pointer'}}>Critical Path</label>
              </div>
              <div style={{gridColumn:'1 / -1'}}>
                <label style={lbl}>Notes</label>
                <textarea style={{...inp,minHeight:'70px',resize:'vertical'}} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Access requirements, special conditions..." />
              </div>
            </div>
            {error && <div style={{fontSize:'12px',color:'var(--red)',marginBottom:'12px'}}>{error}</div>}
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <a href="/schedule" style={{padding:'8px 16px',border:'1px solid var(--border)',borderRadius:'7px',fontSize:'13px',fontWeight:'600',textDecoration:'none',color:'var(--text-muted)'}}>Cancel</a>
              <button type="submit" disabled={loading} style={{padding:'8px 16px',background:loading?'var(--border)':'var(--text)',color:'var(--bg)',border:'none',borderRadius:'7px',fontSize:'13px',fontWeight:'600',cursor:loading?'not-allowed':'pointer'}}>
                {loading?'Saving...':'Add Sub Entry'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
