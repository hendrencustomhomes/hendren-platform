import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import JobTabs from './JobTabs'

const STAGES = [
  'intake',
  'takeoff',
  'estimate',
  'contract',
  'selections',
  'procurement',
  'schedule',
  'draws',
  'construction',
]

const STAGE_LABELS: Record<string, string> = {
  intake: 'Intake',
  takeoff: 'Takeoff',
  estimate: 'Estimate',
  contract: 'Contract',
  selections: 'Selections',
  procurement: 'Procurement',
  schedule: 'Schedule',
  draws: 'Draws',
  construction: 'Build',
}

const STAGE_ICONS: Record<string, string> = {
  intake: '📋',
  takeoff: '📐',
  estimate: '💲',
  contract: '✍️',
  selections: '🎨',
  procurement: '📦',
  schedule: '📅',
  draws: '💰',
  construction: '🏗️',
}

function panelStyle() {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '14px',
  }
}

function statCardStyle() {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '12px 14px',
    minWidth: 0,
  }
}

function labelStyle() {
  return {
    fontSize: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '.04em',
    marginBottom: '4px',
    fontFamily: 'ui-monospace,monospace',
  }
}

function getPmProfileValue(profiles: any) {
  if (!profiles) return null
  return Array.isArray(profiles) ? profiles[0] || null : profiles
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // ===== MAIN JOB QUERY WITH ERROR HANDLING =====
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
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

  if (jobError) {
    console.error('Job query failed:', jobError)
    throw new Error(jobError.message)
  }

  if (!job) notFound()

  // ===== PARALLEL DATA FETCH =====
  const [
    { data: checklistItems },
    { data: checklistState },
    { data: issues },
    { data: logs },
    { data: scheduleItems },
    { data: procurementItems },
    { data: pmOptions },
    { data: jobClients, error: jobClientsError },
  ] = await Promise.all([
    supabase.from('checklist_items').select('*').is('job_id', null).order('sort_order'),
    supabase.from('job_checklist_state').select('*').eq('job_id', id),
    supabase.from('issues').select('*').eq('job_id', id).order('created_at', { ascending: false }),
    supabase
      .from('job_logs')
      .select('*, profiles(full_name)')
      .eq('job_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('sub_schedule')
      .select('*')
      .eq('job_id', id)
      .order('start_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('procurement_items')
      .select('*')
      .eq('job_id', id)
      .order('order_by_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_project_manager', true)
      .order('full_name'),
    supabase
      .from('job_clients')
      .select(`
        id,
        job_id,
        name,
        client_kind,
        company_name,
        is_primary,
        notes,
        job_client_contacts (
          id,
          name,
          label,
          email,
          phone,
          is_primary,
          receives_notifications
        )
      `)
      .eq('job_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (jobClientsError) {
    console.error('Job clients query failed:', jobClientsError)
  }

  const primaryJobClient =
    (jobClients || []).find((c: any) => c.is_primary) ||
    (jobClients || [])[0] ||
    null

  const primaryContact =
    primaryJobClient?.job_client_contacts?.find((c: any) => c.is_primary) ||
    primaryJobClient?.job_client_contacts?.[0] ||
    null

  const curIdx = STAGES.indexOf(job.current_stage)

  const checkedMap: Record<string, boolean> = {}
  const stateMap: Record<string, string> = {}

  ;(checklistState || []).forEach((state: any) => {
    checkedMap[state.checklist_item_id] = state.is_checked
    stateMap[state.checklist_item_id] = state.id
  })

  const masterItems = checklistItems || []

  const getStageItems = (stage: string) =>
    masterItems
      .filter((item: any) => item.stage === stage)
      .sort((a: any, b: any) => a.sort_order - b.sort_order)

  const getStagePct = (stage: string) => {
    const items = getStageItems(stage)
    return items.length
      ? Math.round((items.filter((item: any) => checkedMap[item.id]).length / items.length) * 100)
      : 0
  }

  const openIssues = (issues || []).filter((i: any) => !i.resolved)

  const pmProfile = getPmProfileValue(job.profiles)

  return (
    <div style={{ padding: 16 }}>
      <Nav title={job.job_name} back="/jobs" jobId={id} />

      <div style={{ ...panelStyle(), marginBottom: 12 }}>
        <h1>{job.job_name}</h1>

        <div style={{ fontSize: 12, marginBottom: 10 }}>
          {job.project_address}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
          <span>
            <strong>Client:</strong>{' '}
            {primaryJobClient?.name || job.client_name || '—'}
          </span>

          <span>
            <strong>Primary Contact:</strong>{' '}
            {primaryContact?.name || '—'}
          </span>

          <span>
            <strong>Contact Info:</strong>{' '}
            {primaryContact?.email || primaryContact?.phone || '—'}
          </span>

          <span>
            <strong>PM:</strong> {pmProfile?.full_name || '—'}
          </span>

          <span>
            <strong>Open Issues:</strong> {openIssues.length}
          </span>
        </div>
      </div>

      <JobTabs
        jobId={id}
        job={job}
        stageItems={STAGES.reduce(
          (acc, stage) => ({ ...acc, [stage]: getStageItems(stage) }),
          {} as Record<string, any[]>
        )}
        checkedMap={checkedMap}
        stateMap={stateMap}
        issues={issues || []}
        logs={logs || []}
        scheduleItems={scheduleItems || []}
        procurementItems={procurementItems || []}
        stages={STAGES}
        stageLabels={STAGE_LABELS}
        stageIcons={STAGE_ICONS}
        statusColors={{}}
        userId={user.id}
        canEditInfo={true}
        pmOptions={pmOptions || []}
      />
    </div>
  )
}