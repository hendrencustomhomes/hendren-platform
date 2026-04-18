import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import JobTabs from './JobTabs'
import JobTrashControls from './JobTrashControls'

const STAGES = [
  'intake','takeoff','estimate','contract','selections','procurement','schedule','draws','construction'
]

const STAGE_LABELS: Record<string, string> = {
  intake: 'Intake', takeoff: 'Takeoff', estimate: 'Estimate', contract: 'Contract', selections: 'Selections', procurement: 'Procurement', schedule: 'Schedule', draws: 'Draws', construction: 'Build'
}

const STAGE_ICONS: Record<string, string> = {
  intake: '📋', takeoff: '📐', estimate: '💲', contract: '✍️', selections: '🎨', procurement: '📦', schedule: '📅', draws: '💰', construction: '🏗️'
}

function panelStyle(){return{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'12px',padding:'14px'}}
function statCardStyle(){return{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px 14px',minWidth:0}}
function labelStyle(){return{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase' as const,letterSpacing:'.04em',marginBottom:'4px',fontFamily:'ui-monospace,monospace'}}

function getPmProfileValue(profiles:any){if(!profiles)return null;return Array.isArray(profiles)?profiles[0]||null:profiles}

function normalizeRoleOptions(assignments:any[]|null,activeProfileIds:Set<string>){return(assignments||[]).map((row:any)=>{const profile=Array.isArray(row.profiles)?row.profiles[0]:row.profiles;return{id:profile?.id,full_name:profile?.full_name,profile_id:row.profile_id}}).filter((row:any)=>row.id&&row.full_name&&activeProfileIds.has(row.profile_id)).sort((a:any,b:any)=>a.full_name.localeCompare(b.full_name))}

export default async function JobDetailPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params
  const supabase=await createClient()

  const {data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')

  const {data:job,error:jobError}=await supabase.from('jobs').select(`
      id,job_name,project_address,client_name,client_email,client_phone,pm_id,estimator_profile_id,bookkeeper_profile_id,color,sqft,lot_sqft,referral_source,scope_notes,current_stage,contract_type,is_active,deleted_at,garage_code,lockbox_code,gate_code,parking_notes,neighborhood_requirements,profiles!jobs_pm_id_fkey(full_name, phone),estimator:profiles!jobs_estimator_profile_id_fkey(full_name),bookkeeper:profiles!jobs_bookkeeper_profile_id_fkey(full_name)
    `).eq('id',id).single()

  if(jobError){console.error('Job query failed:',jobError);throw new Error(jobError.message)}
  if(!job)notFound()

  if(job.deleted_at){redirect('/jobs?view=trashed')}

  const roleAssignmentSelect=`
    profile_id,
    profiles!inner (id,full_name),
    internal_roles!inner (key)
  `

  const [
    {data:checklistItems},{data:checklistState},{data:issues},{data:logs},{data:scheduleItems},{data:procurementItems},{data:selections},{data:scopeItems},{data:takeoffItems},{data:trades},{data:costCodes},{data:jobClients},{data:activeInternalUsers},{data:pmRoleAssignments},{data:estimatorRoleAssignments},{data:bookkeeperRoleAssignments},{data:tasks}
  ]=await Promise.all([
    supabase.from('checklist_items').select('*').is('job_id',null).order('sort_order'),
    supabase.from('job_checklist_state').select('*').eq('job_id',id),
    supabase.from('issues').select('*').eq('job_id',id).order('created_at',{ascending:false}),
    supabase.from('job_logs').select('*, profiles(full_name)').eq('job_id',id).order('created_at',{ascending:false}),
    supabase.from('sub_schedule').select('*').eq('job_id',id).order('start_date',{ascending:true,nullsFirst:false}),
    supabase.from('procurement_items').select('*').eq('job_id',id).order('order_by_date',{ascending:true,nullsFirst:false}),
    supabase.from('job_selections').select('*').eq('job_id',id),
    supabase.from('job_scope_items').select('*').eq('job_id',id),
    supabase.from('takeoff_items').select('*').eq('job_id',id),
    supabase.from('trades').select('*').eq('is_active',true),
    supabase.from('cost_codes').select('*').eq('is_active',true),
    supabase.from('job_clients').select('*').eq('job_id',id),
    supabase.from('internal_access').select('profile_id').eq('is_active',true),
    supabase.from('internal_role_assignments').select(roleAssignmentSelect).eq('internal_roles.key','project_manager'),
    supabase.from('internal_role_assignments').select(roleAssignmentSelect).eq('internal_roles.key','estimator'),
    supabase.from('internal_role_assignments').select(roleAssignmentSelect).eq('internal_roles.key','bookkeeper'),
    supabase.from('job_tasks').select('*').eq('job_id',id)
  ])

  const activeScheduleItems=(scheduleItems||[]).filter((item:any)=>item.status!=='cancelled')
  const openProcurementItems=(procurementItems||[]).filter((item:any)=>!['Delivered','Confirmed'].includes(item.status))

  const counts={
    schedule:activeScheduleItems.length,
    procurement:openProcurementItems.length,
    tasks:(tasks||[]).length,
    selections:(selections||[]).length,
    takeoff:(takeoffItems||[]).length,
    scope:(scopeItems||[]).length
  }

  return(
    <div style={{background:'var(--bg)',minHeight:'100vh',color:'var(--text)',fontFamily:'system-ui,-apple-system,sans-serif'}}>
      <Nav title={job.job_name||'Untitled Job'} back="/jobs" jobId={id}/>

      <div style={{padding:'14px',maxWidth:'1080px',margin:'0 auto'}}>
        <div style={{...panelStyle(),marginBottom:'12px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'14px',flexWrap:'wrap',marginBottom:'12px'}}>
            <div>
              <div style={{fontSize:'18px',fontWeight:'700'}}>{job.job_name}</div>
              <div style={{fontSize:'12px',color:'var(--text-muted)'}}>{job.project_address}</div>
            </div>

            <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
              <JobTrashControls jobId={id} counts={counts}/>
              <a href={`/schedule?job=${id}`} style={{fontSize:'12px',padding:'7px 10px',border:'1px solid var(--border)',borderRadius:'7px'}}>📅 Master Schedule</a>
            </div>
          </div>
        </div>

        <JobTabs jobId={id} job={job} stageItems={{}} checkedMap={{}} stateMap={{}} issues={issues||[]} logs={logs||[]} scheduleItems={scheduleItems||[]} procurementItems={procurementItems||[]} scopeItems={scopeItems||[]} takeoffItems={takeoffItems||[]} selections={selections||[]} trades={trades||[]} costCodes={costCodes||[]} stages={STAGES} stageLabels={STAGE_LABELS} stageIcons={STAGE_ICONS} statusColors={{}} userId={user.id} canEditInfo={true} pmOptions={[]} estimatorOptions={[]} bookkeeperOptions={[]} tasks={tasks||[]}/>
      </div>
    </div>
  )
}
