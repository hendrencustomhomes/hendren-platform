import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'

const STAGE_LABELS: Record<string,string> = {intake:'Intake',takeoff:'Takeoff',estimate:'Estimate',contract:'Contract',selections:'Selections',procurement:'Procurement',schedule:'Schedule',draws:'Draws',construction:'Build'}
const STAGES = ['intake','takeoff','estimate','contract','selections','procurement','schedule','draws','construction']

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: jobs } = await supabase
    .from('jobs').select(`id,client_name,address,color,current_stage,created_at,sqft,contract_type,profiles!jobs_pm_id_fkey(full_name),issues(id,severity,resolved),sub_schedule(id,status),procurement_items(id,status,order_by_date)`)
    .eq('is_active',true).order('created_at',{ascending:false})

  const jobList = jobs || []

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh',color:'var(--text)',fontFamily:'system-ui,-apple-system,sans-serif'}}>
      <Nav title="All Jobs" />
      <div style={{padding:'14px',maxWidth:'900px',margin:'0 auto'}}>
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px'}}>
          <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontSize:'13px',fontWeight:'700'}}>{jobList.length} Active Jobs</div>
            <a href="/jobs/new" style={{fontSize:'12px',fontWeight:'600',background:'var(--text)',color:'var(--bg)',padding:'6px 12px',borderRadius:'6px',textDecoration:'none'}}>+ New Job</a>
          </div>
          {jobList.map((job:any) => {
            const openIssues = (job.issues||[]).filter((i:any)=>!i.resolved)
            const critIssues = openIssues.filter((i:any)=>i.severity==='Critical')
            const curIdx = STAGES.indexOf(job.current_stage)
            const pct = Math.round((curIdx/8)*100)
            const unconfirmedSubs = (job.sub_schedule||[]).filter((s:any)=>s.status==='tentative').length
            const pendingOrders = (job.procurement_items||[]).filter((p:any)=>p.status==='Pending').length
            return (
              <a key={job.id} href={`/jobs/${job.id}`} style={{display:'block',padding:'12px 16px',borderBottom:'1px solid var(--border)',textDecoration:'none',color:'inherit'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:'10px'}}>
                  <div style={{width:'3px',height:'44px',borderRadius:'2px',background:job.color||'#3B8BD4',flexShrink:0,marginTop:'2px'}} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px'}}>
                      <div style={{fontSize:'13px',fontWeight:'700'}}>{job.client_name}</div>
                      <span style={{fontSize:'10px',fontWeight:'600',padding:'1px 6px',borderRadius:'8px',background:'var(--blue-bg)',color:'var(--blue)',border:'1px solid var(--blue)',fontFamily:'ui-monospace,monospace'}}>{STAGE_LABELS[job.current_stage]}</span>
                      {critIssues.length>0 && <span style={{fontSize:'10px',fontWeight:'600',color:'var(--red)'}}>⚠ {critIssues.length} critical</span>}
                    </div>
                    <div style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'ui-monospace,monospace',marginBottom:'6px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{job.address}{job.sqft ? ` · ${job.sqft} sqft` : ''}</div>
                    <div style={{height:'3px',background:'var(--border)',borderRadius:'2px',overflow:'hidden',marginBottom:'5px'}}>
                      <div style={{height:'100%',width:`${pct}%`,background:job.color||'var(--blue)',borderRadius:'2px'}} />
                    </div>
                    <div style={{display:'flex',gap:'10px'}}>
                      {unconfirmedSubs>0 && <span style={{fontSize:'10px',color:'var(--amber)'}}>👷 {unconfirmedSubs} tentative sub{unconfirmedSubs>1?'s':''}</span>}
                      {pendingOrders>0 && <span style={{fontSize:'10px',color:'var(--text-muted)'}}>📦 {pendingOrders} pending order{pendingOrders>1?'s':''}</span>}
                      <span style={{fontSize:'10px',color:'var(--text-muted)',marginLeft:'auto'}}>{(job.profiles as any)?.full_name||'—'}</span>
                    </div>
                  </div>
                </div>
              </a>
            )
          })}
          {jobList.length===0 && <div style={{padding:'40px',textAlign:'center',color:'var(--text-muted)'}}>No active jobs</div>}
        </div>
      </div>
    </div>
  )
}
