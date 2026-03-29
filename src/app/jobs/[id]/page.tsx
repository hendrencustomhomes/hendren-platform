import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import JobTabs from './JobTabs'

const STAGES = ['intake','takeoff','estimate','contract','selections','procurement','schedule','draws','construction']
const STAGE_LABELS: Record<string,string> = {intake:'Intake',takeoff:'Takeoff',estimate:'Estimate',contract:'Contract',selections:'Selections',procurement:'Procurement',schedule:'Schedule',draws:'Draws',construction:'Build'}
const STAGE_ICONS: Record<string,string> = {intake:'📋',takeoff:'📐',estimate:'💲',contract:'✍️',selections:'🎨',procurement:'📦',schedule:'📅',draws:'💰',construction:'🏗️'}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: job } = await supabase.from('jobs').select(`*, profiles!jobs_pm_id_fkey(full_name)`).eq('id',id).single()
  if (!job) notFound()

  const { data: checklistItems } = await supabase.from('checklist_items').select('*').is('job_id',null).order('sort_order')
  const { data: checklistState } = await supabase.from('job_checklist_state').select('*').eq('job_id',id)
  const { data: issues } = await supabase.from('issues').select('*').eq('job_id',id).order('created_at',{ascending:false})
  const { data: logs } = await supabase.from('job_logs').select('*, profiles(full_name)').eq('job_id',id).order('created_at',{ascending:false})
  const { data: subs } = await supabase.from('sub_schedule').select('*').eq('job_id',id).order('start_date',{ascending:true,nullsFirst:false})
  const { data: orders } = await supabase.from('procurement_items').select('*').eq('job_id',id).order('order_by_date',{ascending:true,nullsFirst:false})

  const curIdx = STAGES.indexOf(job.current_stage)
  const checkedMap: Record<string,boolean> = {}
  const stateMap: Record<string,string> = {} // item_id -> state row id
  ;(checklistState||[]).forEach((s:any) => { checkedMap[s.checklist_item_id]=s.is_checked; stateMap[s.checklist_item_id]=s.id })
  const masterItems = checklistItems||[]

  const stageItems = (stage:string) => masterItems.filter((i:any)=>i.stage===stage).sort((a:any,b:any)=>a.sort_order-b.sort_order)
  const stagePct = (stage:string) => { const its=stageItems(stage); return its.length?Math.round(its.filter((i:any)=>checkedMap[i.id]).length/its.length*100):0 }

  const STATUS_COLORS: Record<string,string> = {tentative:'#b45309',confirmed:'#16a34a',on_site:'#2563eb',complete:'#888',cancelled:'#dc2626',Pending:'#b45309',Ordered:'#2563eb',Confirmed:'#16a34a',Delivered:'#888',Issue:'#dc2626'}
  const fmtDate = (d:string|null) => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh',color:'var(--text)',fontFamily:'system-ui,-apple-system,sans-serif'}}>
      <Nav title={job.client_name} back="/jobs" jobId={id} />
      <div style={{padding:'14px',maxWidth:'900px',margin:'0 auto'}}>

        {/* Pipeline strip */}
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px 14px',marginBottom:'12px',overflowX:'auto'}}>
          <div style={{display:'flex',gap:'2px',minWidth:'fit-content'}}>
            {STAGES.map((stage,i) => {
              const done=i<curIdx, active=i===curIdx
              const pct=stagePct(stage)
              return (
                <div key={stage} style={{flex:'0 0 auto',textAlign:'center',padding:'5px 7px',minWidth:'68px'}}>
                  <div style={{width:'26px',height:'26px',borderRadius:'50%',margin:'0 auto 3px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:'700',background:done?'var(--green)':active?'var(--blue)':'var(--bg)',color:(done||active)?'#fff':'var(--text-faint)',border:`2px solid ${done?'var(--green)':active?'var(--blue)':'var(--border)'}`}}>
                    {done?'✓':i+1}
                  </div>
                  <div style={{fontSize:'8px',fontWeight:'600',textTransform:'uppercase',letterSpacing:'.03em',color:done?'var(--green)':active?'var(--blue)':'var(--text-faint)',lineHeight:1.3}}>{STAGE_LABELS[stage]}</div>
                  {active&&pct>0&&<div style={{height:'2px',background:'var(--border)',borderRadius:'2px',marginTop:'2px',overflow:'hidden'}}><div style={{height:'100%',width:`${pct}%`,background:'var(--blue)'}}/></div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Job meta */}
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px 14px',marginBottom:'12px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px',flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:'13px',fontWeight:'600'}}>Stage: <span style={{color:'var(--blue)'}}>{STAGE_LABELS[job.current_stage]}</span></div>
            <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'2px',fontFamily:'ui-monospace,monospace'}}>
              {(job.profiles as any)?.full_name||'—'} · {job.sqft?job.sqft+' sqft':''} · {job.contract_type==='cost_plus'?'Cost Plus':'Fixed Price'}
            </div>
          </div>
          <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
            <a href={`/schedule?job=${id}`} style={{fontSize:'12px',fontWeight:'600',padding:'6px 12px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'6px',textDecoration:'none',color:'var(--text)'}}>📅 Schedule</a>
            <a href={`/schedule/sub/new?job=${id}`} style={{fontSize:'12px',fontWeight:'600',padding:'6px 12px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'6px',textDecoration:'none',color:'var(--text)'}}>+ Sub</a>
            <a href={`/schedule/order/new?job=${id}`} style={{fontSize:'12px',fontWeight:'600',padding:'6px 12px',background:'var(--text)',color:'var(--bg)',borderRadius:'6px',textDecoration:'none'}}>+ Order</a>
          </div>
        </div>

        {/* Tabs — client component handles interactivity */}
        <JobTabs
          jobId={id}
          job={job}
          stageItems={STAGES.reduce((acc,s)=>({...acc,[s]:stageItems(s)}),{})}
          checkedMap={checkedMap}
          stateMap={stateMap}
          issues={issues||[]}
          logs={logs||[]}
          subs={subs||[]}
          orders={orders||[]}
          stages={STAGES}
          stageLabels={STAGE_LABELS}
          stageIcons={STAGE_ICONS}
          statusColors={STATUS_COLORS}
          fmtDate={fmtDate}
          userId={user.id}
        />
      </div>
    </div>
  )
}
