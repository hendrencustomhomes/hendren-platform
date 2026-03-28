import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'

const STAGES = ['intake','takeoff','estimate','contract','selections','procurement','schedule','draws','construction']
const STAGE_LABELS: Record<string,string> = {intake:'Intake',takeoff:'Takeoff',estimate:'Estimate',contract:'Contract',selections:'Selections',procurement:'Procurement',schedule:'Schedule',draws:'Draws',construction:'Build'}
const STAGE_ICONS: Record<string,string> = {intake:'📋',takeoff:'📐',estimate:'💲',contract:'✍️',selections:'🎨',procurement:'📦',schedule:'📅',draws:'💰',construction:'🏗️'}

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: job } = await supabase
    .from('jobs')
    .select(`*, profiles!jobs_pm_id_fkey(full_name)`)
    .eq('id', params.id)
    .single()

  if (!job) notFound()

  const { data: checklistItems } = await supabase
    .from('checklist_items')
    .select('*')
    .is('job_id', null)
    .order('sort_order')

  const { data: checklistState } = await supabase
    .from('job_checklist_state')
    .select('*, checklist_items(id, stage, label, is_required, sort_order)')
    .eq('job_id', params.id)

  const { data: issues } = await supabase
    .from('issues')
    .select('*')
    .eq('job_id', params.id)
    .order('created_at', { ascending: false })

  const { data: logs } = await supabase
    .from('job_logs')
    .select('*, profiles(full_name)')
    .eq('job_id', params.id)
    .order('created_at', { ascending: false })

  const curIdx = STAGES.indexOf(job.current_stage)
  const openIssues = (issues || []).filter((i: any) => !i.resolved)
  const checkedMap: Record<string,boolean> = {}
  ;(checklistState || []).forEach((s: any) => {
    if (s.checklist_items) checkedMap[s.checklist_items.id] = s.is_checked
  })

  const masterItems = checklistItems || []

  function stageItems(stage: string) {
    return masterItems.filter((i: any) => i.stage === stage).sort((a: any,b: any) => a.sort_order - b.sort_order)
  }

  function stagePct(stage: string) {
    const items = stageItems(stage)
    if (!items.length) return 0
    const done = items.filter((i: any) => checkedMap[i.id]).length
    return Math.round(done / items.length * 100)
  }

  const s = { fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f7f6f3', minHeight: '100vh' }

  return (
    <div style={s}>
      {/* Topbar */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e2dfd8', padding:'12px 16px', display:'flex', alignItems:'center', gap:'10px', position:'sticky', top:0, zIndex:100 }}>
        <a href="/" style={{ fontSize:'13px', color:'#2563eb', textDecoration:'none' }}>← Dashboard</a>
        <div style={{ fontSize:'15px', fontWeight:'700', flex:1 }}>{job.client_name}</div>
        <span style={{ fontSize:'11px', color:'#777', fontFamily:'ui-monospace,monospace' }}>{job.address}</span>
      </div>

      <div style={{ padding:'14px', maxWidth:'900px', margin:'0 auto' }}>

        {/* Pipeline */}
        <div style={{ background:'#fff', border:'1px solid #e2dfd8', borderRadius:'10px', padding:'14px', marginBottom:'12px', overflowX:'auto' }}>
          <div style={{ display:'flex', gap:'4px', minWidth:'fit-content' }}>
            {STAGES.map((stage, i) => {
              const done = i < curIdx
              const active = i === curIdx
              const pct = stagePct(stage)
              return (
                <div key={stage} style={{ flex:'0 0 auto', textAlign:'center', padding:'6px 8px', minWidth:'72px' }}>
                  <div style={{
                    width:'28px', height:'28px', borderRadius:'50%', margin:'0 auto 4px',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:'11px', fontWeight:'700',
                    background: done ? '#16a34a' : active ? '#2563eb' : '#f1f0ec',
                    color: (done || active) ? '#fff' : '#bbb',
                    border: `2px solid ${done ? '#16a34a' : active ? '#2563eb' : '#e2dfd8'}`
                  }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize:'8px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'.03em', color: done ? '#16a34a' : active ? '#2563eb' : '#bbb', lineHeight:1.3 }}>
                    {STAGE_LABELS[stage]}
                  </div>
                  {active && pct > 0 && (
                    <div style={{ height:'3px', background:'#e2dfd8', borderRadius:'2px', marginTop:'3px', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:'#2563eb', borderRadius:'2px' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Job info + actions */}
        <div style={{ background:'#fff', border:'1px solid #e2dfd8', borderRadius:'10px', padding:'14px', marginBottom:'12px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:'13px', fontWeight:'600' }}>
              Stage: <span style={{ color:'#2563eb' }}>{STAGE_LABELS[job.current_stage]}</span>
            </div>
            <div style={{ fontSize:'11px', color:'#777', marginTop:'2px', fontFamily:'ui-monospace,monospace' }}>
              PM: {(job.profiles as any)?.full_name || 'Unassigned'} · {job.sqft ? job.sqft + ' sqft' : ''} · {job.contract_type === 'cost_plus' ? 'Cost Plus' : 'Fixed Price'}
            </div>
            {openIssues.length > 0 && (
              <div style={{ fontSize:'11px', color:'#dc2626', marginTop:'3px' }}>⚠️ {openIssues.length} open issue{openIssues.length > 1 ? 's' : ''}</div>
            )}
          </div>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {curIdx < STAGES.length - 1 && (
              <form action={`/api/jobs/${job.id}/advance`} method="POST">
                <button type="submit" style={{ padding:'7px 14px', background:'#1a1a18', color:'#fff', border:'none', borderRadius:'7px', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>
                  → {STAGE_LABELS[STAGES[curIdx + 1]]}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Scope notes */}
        {job.scope_notes && (
          <div style={{ background:'#fff', border:'1px solid #e2dfd8', borderRadius:'10px', padding:'14px', marginBottom:'12px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.05em', color:'#777', marginBottom:'6px' }}>Scope</div>
            <div style={{ fontSize:'13px', color:'#333', lineHeight:'1.6' }}>{job.scope_notes}</div>
          </div>
        )}

        {/* Checklist */}
        <div style={{ background:'#fff', border:'1px solid #e2dfd8', borderRadius:'10px', padding:'14px', marginBottom:'12px' }}>
          <div style={{ fontSize:'13px', fontWeight:'700', marginBottom:'12px' }}>Checklist</div>
          {STAGES.map(stage => {
            const items = stageItems(stage)
            if (!items.length) return null
            const i = STAGES.indexOf(stage)
            const done = i < curIdx
            const active = i === curIdx
            const pct = stagePct(stage)
            const checkedCount = items.filter((it: any) => checkedMap[it.id]).length
            return (
              <div key={stage} style={{ marginBottom:'12px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                  <span style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.05em', color: done ? '#16a34a' : active ? '#2563eb' : '#bbb' }}>
                    {STAGE_ICONS[stage]} {STAGE_LABELS[stage]}
                  </span>
                  <span style={{ fontSize:'10px', color:'#777', fontFamily:'ui-monospace,monospace' }}>{checkedCount}/{items.length}</span>
                </div>
                <div style={{ height:'3px', background:'#f1f0ec', borderRadius:'2px', marginBottom:'6px', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background: done ? '#16a34a' : active ? '#2563eb' : '#ccc', borderRadius:'2px' }} />
                </div>
                {items.map((item: any) => (
                  <div key={item.id} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'4px 6px', borderRadius:'5px' }}>
                    <input
                      type="checkbox"
                      defaultChecked={!!checkedMap[item.id]}
                      style={{ width:'14px', height:'14px', flexShrink:0, marginTop:'2px', accentColor:'#2563eb', cursor:'pointer' }}
                    />
                    <label style={{ fontSize:'12px', flex:1, lineHeight:'1.4', color: checkedMap[item.id] ? '#bbb' : '#1a1a18', textDecoration: checkedMap[item.id] ? 'line-through' : 'none' }}>
                      {item.label}
                    </label>
                    {item.is_required && <span style={{ fontSize:'9px', color:'#dc2626', fontFamily:'ui-monospace,monospace', flexShrink:0, marginTop:'2px' }}>req</span>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Issues */}
        <div style={{ background:'#fff', border:'1px solid #e2dfd8', borderRadius:'10px', padding:'14px', marginBottom:'12px' }}>
          <div style={{ fontSize:'13px', fontWeight:'700', marginBottom:'10px', display:'flex', justifyContent:'space-between' }}>
            Issues
            {openIssues.length > 0 && <span style={{ fontSize:'11px', fontWeight:'600', padding:'2px 8px', borderRadius:'10px', background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}>{openIssues.length} open</span>}
          </div>
          {!(issues || []).length ? (
            <div style={{ fontSize:'12px', color:'#bbb', textAlign:'center', padding:'16px 0' }}>No issues logged ✓</div>
          ) : (issues || []).map((iss: any) => (
            <div key={iss.id} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'8px 0', borderBottom:'1px solid #f0ede8' }}>
              <span style={{ fontSize:'10px', fontWeight:'600', padding:'2px 6px', borderRadius:'3px', flexShrink:0,
                background: iss.severity === 'Critical' ? '#fef2f2' : iss.severity === 'Warning' ? '#fffbeb' : '#eff6ff',
                color: iss.severity === 'Critical' ? '#dc2626' : iss.severity === 'Warning' ? '#b45309' : '#2563eb',
                border: `1px solid ${iss.severity === 'Critical' ? '#fecaca' : iss.severity === 'Warning' ? '#fde68a' : '#bfdbfe'}`
              }}>{iss.severity}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'12px', fontWeight:'600', textDecoration: iss.resolved ? 'line-through' : 'none', color: iss.resolved ? '#bbb' : '#1a1a18' }}>{iss.title}</div>
                {iss.detail && <div style={{ fontSize:'11px', color:'#777', marginTop:'2px' }}>{iss.detail}</div>}
              </div>
              {iss.resolved ? <span style={{ fontSize:'10px', color:'#16a34a', flexShrink:0 }}>✓ Resolved</span> : null}
            </div>
          ))}
        </div>

        {/* Log */}
        <div style={{ background:'#fff', border:'1px solid #e2dfd8', borderRadius:'10px', padding:'14px' }}>
          <div style={{ fontSize:'13px', fontWeight:'700', marginBottom:'10px' }}>Job Log</div>
          {!(logs || []).length ? (
            <div style={{ fontSize:'12px', color:'#bbb', textAlign:'center', padding:'16px 0' }}>No log entries yet</div>
          ) : (logs || []).map((log: any) => (
            <div key={log.id} style={{ padding:'8px 0', borderBottom:'1px solid #f0ede8' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                <span style={{ fontSize:'11px', fontWeight:'600' }}>{log.profiles?.full_name || 'Unknown'}</span>
                <span style={{ fontSize:'10px', color:'#777', fontFamily:'ui-monospace,monospace' }}>
                  {new Date(log.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                </span>
              </div>
              <div style={{ fontSize:'12px', color:'#333', lineHeight:'1.5' }}>{log.body}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
