import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import JobTabs from './JobTabs'

const STAGES = ['intake','takeoff','estimate','contract','selections','procurement','schedule','draws','construction']
const STAGE_LABELS: Record<string,string> = {
  intake:'Intake',
  takeoff:'Takeoff',
  estimate:'Estimate',
  contract:'Contract',
  selections:'Selections',
  procurement:'Procurement',
  schedule:'Schedule',
  draws:'Draws',
  construction:'Build',
}
const STAGE_ICONS: Record<string,string> = {
  intake:'📋',
  takeoff:'📐',
  estimate:'💲',
  contract:'✍️',
  selections:'🎨',
  procurement:'📦',
  schedule:'📅',
  draws:'💰',
  construction:'🏗️',
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  const { data: job } = await supabase
    .from('jobs').select(`
  id,
  job_name,
  project_address,
  client_name,
  client_email,
  client_phone,
  pm_id,
  color,
  sqft,
  lot_sqft,
  referral_source,
  scope_notes,
  current_stage,
  contract_type,
  is_active,
  profiles!jobs_pm_id_fkey(full_name, phone)
`)
    .eq('id', id)
    .single()

  if (!job) notFound()

  const [
    { data: checklistItems },
    { data: checklistState },
    { data: issues },
    { data: logs },
    { data: subs },
    { data: orders },
    { data: selections },
    { data: takeoffItems },
    { data: estimates },
    { data: files },
    { data: pmOptions },
  ] = await Promise.all([
    supabase.from('checklist_items').select('*').is('job_id', null).order('sort_order'),
    supabase.from('job_checklist_state').select('*').eq('job_id', id),
    supabase.from('issues').select('*').eq('job_id', id).order('created_at', { ascending: false }),
    supabase.from('job_logs').select('*, profiles(full_name)').eq('job_id', id).order('created_at', { ascending: false }),
    supabase.from('sub_schedule').select('*').eq('job_id', id).order('start_date', { ascending: true, nullsFirst: false }),
    supabase.from('procurement_items').select('*').eq('job_id', id).order('order_by_date', { ascending: true, nullsFirst: false }),
    supabase.from('selections').select('*').eq('job_id', id).order('sort_order'),
    supabase.from('takeoff_items').select('*').eq('job_id', id).order('sort_order'),
    supabase.from('estimates').select('*, estimate_line_items(*)').eq('job_id', id).order('created_at', { ascending: false }),
    supabase.from('file_attachments').select('*').eq('job_id', id).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').eq('is_project_manager', true).order('full_name'),
  ])

  const curIdx = STAGES.indexOf(job.current_stage)
  const checkedMap: Record<string, boolean> = {}
  const stateMap: Record<string, string> = {}

  ;(checklistState || []).forEach((s: any) => {
    checkedMap[s.checklist_item_id] = s.is_checked
    stateMap[s.checklist_item_id] = s.id
  })

  const masterItems = checklistItems || []
  const stageItems = (stage: string) =>
    masterItems.filter((i: any) => i.stage === stage).sort((a: any, b: any) => a.sort_order - b.sort_order)

  const stagePct = (stage: string) => {
    const its = stageItems(stage)
    return its.length ? Math.round((its.filter((i: any) => checkedMap[i.id]).length / its.length) * 100) : 0
  }

  const STATUS_COLORS: Record<string, string> = {
    tentative:'#b45309',
    confirmed:'#16a34a',
    on_site:'#2563eb',
    complete:'#888',
    cancelled:'#dc2626',
    Pending:'#b45309',
    Ordered:'#2563eb',
    Confirmed:'#16a34a',
    Delivered:'#888',
    Issue:'#dc2626',
    not_started:'#888',
    in_progress:'#b45309',
    selected:'#2563eb',
    locked:'#16a34a',
    on_hold:'#dc2626',
  }

  const canEditInfo = true

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', color:'var(--text)', fontFamily:'system-ui,-apple-system,sans-serif' }}>
      <Nav title={job.job_name || 'Untitled Job'} back="/jobs" jobId={id} />

      <div style={{ padding:'14px', maxWidth:'960px', margin:'0 auto' }}>
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 14px', marginBottom:'12px', overflowX:'auto' }}>
          <div style={{ display:'flex', gap:'2px', minWidth:'fit-content' }}>
            {STAGES.map((stage, i) => {
              const done = i < curIdx
              const active = i === curIdx
              const pct = stagePct(stage)
              return (
                <div key={stage} style={{ flex:'0 0 auto', textAlign:'center', padding:'5px 7px', minWidth:'68px' }}>
                  <div style={{ width:'26px', height:'26px', borderRadius:'50%', margin:'0 auto 3px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'700', background:done?'var(--green)':active?'var(--blue)':'var(--bg)', color:(done||active)?'#fff':'var(--text-faint)', border:`2px solid ${done?'var(--green)':active?'var(--blue)':'var(--border)'}` }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize:'8px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'.03em', color:done?'var(--green)':active?'var(--blue)':'var(--text-faint)', lineHeight:1.3 }}>
                    {STAGE_LABELS[stage]}
                  </div>
                  {active && pct > 0 && (
                    <div style={{ height:'2px', background:'var(--border)', borderRadius:'2px', marginTop:'2px', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:'var(--blue)' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 14px', marginBottom:'12px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:'13px', fontWeight:'600' }}>
              Stage: <span style={{ color:'var(--blue)' }}>{STAGE_LABELS[job.current_stage]}</span>
            </div>
            <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px', fontFamily:'ui-monospace,monospace' }}>
              {job.job_name || 'Untitled Job'}
              {job.sqft ? ` · ${job.sqft} sqft` : ''}
              {' · '}
              {job.contract_type === 'cost_plus' ? 'Cost Plus' : 'Fixed Price'}
            </div>
          </div>

          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            <a href={`/schedule?job=${id}`} style={{ fontSize:'12px', fontWeight:'600', padding:'6px 10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', textDecoration:'none', color:'var(--text)' }}>📅 Schedule</a>
<a href={`/schedule/sub/new?jobId=${id}`} style={{ fontSize:'12px', fontWeight:'600', padding:'6px 10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', textDecoration:'none', color:'var(--text)' }}>+ Sub</a>
<a href={`/schedule/order/new?jobId=${id}`} style={{ fontSize:'12px', fontWeight:'600', padding:'6px 10px', background:'var(--text)', color:'var(--bg)', borderRadius:'6px', textDecoration:'none' }}>+ Order</a>
          </div>
        </div>

        <JobTabs
          jobId={id}
          job={job}
          stageItems={STAGES.reduce((acc, s) => ({ ...acc, [s]: stageItems(s) }), {})}
          checkedMap={checkedMap}
          stateMap={stateMap}
          issues={issues || []}
          logs={logs || []}
          subs={subs || []}
          orders={orders || []}
          selections={selections || []}
          takeoffItems={takeoffItems || []}
          estimates={estimates || []}
          files={files || []}
          stages={STAGES}
          stageLabels={STAGE_LABELS}
          stageIcons={STAGE_ICONS}
          statusColors={STATUS_COLORS}
          userId={user.id}
          canEditInfo={canEditInfo}
          pmOptions={pmOptions || []}
        />
      </div>
    </div>
  )
}
