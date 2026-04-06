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

function normalizeRoleOptions(
  assignments: any[] | null,
  activeProfileIds: Set<string>
): { id: string; full_name: string }[] {
  return (assignments || [])
    .map((row: any) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      return {
        id: profile?.id,
        full_name: profile?.full_name,
        profile_id: row.profile_id,
      }
    })
    .filter((row: any) => row.id && row.full_name && activeProfileIds.has(row.profile_id))
    .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name))
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
      estimator_profile_id,
      bookkeeper_profile_id,
      color,
      sqft,
      lot_sqft,
      referral_source,
      scope_notes,
      current_stage,
      contract_type,
      is_active,
      garage_code,
      lockbox_code,
      gate_code,
      parking_notes,
      neighborhood_requirements,
      profiles!jobs_pm_id_fkey(full_name, phone),
      estimator:profiles!jobs_estimator_profile_id_fkey(full_name),
      bookkeeper:profiles!jobs_bookkeeper_profile_id_fkey(full_name)
    `)
    .eq('id', id)
    .single()

  if (jobError) {
    console.error('Job query failed:', jobError)
    throw new Error(jobError.message)
  }

  if (!job) notFound()

  const roleAssignmentSelect = `
    profile_id,
    profiles!inner (
      id,
      full_name
    ),
    internal_roles!inner (
      key
    )
  `

  const [
    { data: checklistItems, error: checklistItemsError },
    { data: checklistState, error: checklistStateError },
    { data: issues, error: issuesError },
    { data: logs, error: logsError },
    { data: scheduleItems, error: scheduleItemsError },
    { data: procurementItems, error: procurementItemsError },
    { data: jobClients, error: jobClientsError },
    { data: activeInternalUsers, error: activeInternalUsersError },
    { data: pmRoleAssignments, error: pmRoleAssignmentsError },
    { data: estimatorRoleAssignments, error: estimatorRoleAssignmentsError },
    { data: bookkeeperRoleAssignments, error: bookkeeperRoleAssignmentsError },
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
    supabase
      .from('internal_access')
      .select('profile_id')
      .eq('is_active', true),
    supabase
      .from('internal_role_assignments')
      .select(roleAssignmentSelect)
      .eq('internal_roles.key', 'project_manager'),
    supabase
      .from('internal_role_assignments')
      .select(roleAssignmentSelect)
      .eq('internal_roles.key', 'estimator'),
    supabase
      .from('internal_role_assignments')
      .select(roleAssignmentSelect)
      .eq('internal_roles.key', 'bookkeeper'),
  ])

  if (checklistItemsError) console.error('Checklist items query failed:', checklistItemsError)
  if (checklistStateError) console.error('Checklist state query failed:', checklistStateError)
  if (issuesError) console.error('Issues query failed:', issuesError)
  if (logsError) console.error('Logs query failed:', logsError)
  if (scheduleItemsError) console.error('Schedule items query failed:', scheduleItemsError)
  if (procurementItemsError) console.error('Procurement items query failed:', procurementItemsError)
  if (jobClientsError) console.error('Job clients query failed:', jobClientsError)
  if (activeInternalUsersError) console.error('Active internal users query failed:', activeInternalUsersError)
  if (pmRoleAssignmentsError) console.error('PM role assignments query failed:', pmRoleAssignmentsError)
  if (estimatorRoleAssignmentsError) console.error('Estimator role assignments query failed:', estimatorRoleAssignmentsError)
  if (bookkeeperRoleAssignmentsError) console.error('Bookkeeper role assignments query failed:', bookkeeperRoleAssignmentsError)

  const activeProfileIds = new Set(
    (activeInternalUsers || []).map((row: any) => row.profile_id)
  )

  const pmOptions = normalizeRoleOptions(pmRoleAssignments, activeProfileIds)
  const estimatorOptions = normalizeRoleOptions(estimatorRoleAssignments, activeProfileIds)
  const bookkeeperOptions = normalizeRoleOptions(bookkeeperRoleAssignments, activeProfileIds)

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

  const STATUS_COLORS: Record<string, string> = {
    tentative: '#b45309',
    scheduled: '#2563eb',
    confirmed: '#16a34a',
    on_site: '#2563eb',
    complete: '#888',
    cancelled: '#dc2626',
    Pending: '#b45309',
    Ordered: '#2563eb',
    Confirmed: '#16a34a',
    Delivered: '#888',
    'Will Call': '#7c3aed',
    Issue: '#dc2626',
    Critical: '#dc2626',
    Warning: '#b45309',
    Info: '#2563eb',
    not_started: '#888',
    in_progress: '#b45309',
    selected: '#2563eb',
    locked: '#16a34a',
    on_hold: '#dc2626',
  }

  const openIssues = (issues || []).filter((i: any) => !i.resolved)
  const activeScheduleItems = (scheduleItems || []).filter((item: any) => item.status !== 'cancelled')
  const releasedScheduleItems = activeScheduleItems.filter((item: any) => item.is_released)
  const confirmedScheduleItems = activeScheduleItems.filter(
    (item: any) => item.status === 'confirmed'
  )
  const openProcurementItems = (procurementItems || []).filter(
    (item: any) => !['Delivered', 'Confirmed'].includes(item.status)
  )

  const nextStage = STAGES[curIdx + 1] || null
  const canEditInfo = true
  const pmProfile = getPmProfileValue(job.profiles)

  const estimatorProfile = job.estimator
    ? (Array.isArray(job.estimator) ? job.estimator[0] : job.estimator)
    : null
  const bookkeeperProfile = job.bookkeeper
    ? (Array.isArray(job.bookkeeper) ? job.bookkeeper[0] : job.bookkeeper)
    : null

  return (
    <div
      style={{
        background: 'var(--bg)',
        minHeight: '100vh',
        color: 'var(--text)',
        fontFamily: 'system-ui,-apple-system,sans-serif',
      }}
    >
      <Nav title={job.job_name || 'Untitled Job'} back="/jobs" jobId={id} />

      <div style={{ padding: '14px', maxWidth: '1080px', margin: '0 auto' }}>
        <div
          style={{
            ...panelStyle(),
            marginBottom: '12px',
            overflowX: 'auto',
          }}
        >
          <div style={{ display: 'flex', gap: '2px', minWidth: 'fit-content' }}>
            {STAGES.map((stage, index) => {
              const done = index < curIdx
              const active = index === curIdx
              const pct = getStagePct(stage)

              return (
                <div
                  key={stage}
                  style={{
                    flex: '0 0 auto',
                    textAlign: 'center',
                    padding: '5px 7px',
                    minWidth: '72px',
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      margin: '0 auto 4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: '700',
                      background: done ? 'var(--green)' : active ? 'var(--blue)' : 'var(--bg)',
                      color: done || active ? '#fff' : 'var(--text-faint)',
                      border: `2px solid ${done ? 'var(--green)' : active ? 'var(--blue)' : 'var(--border)'}`,
                    }}
                  >
                    {done ? '✓' : index + 1}
                  </div>

                  <div
                    style={{
                      fontSize: '8px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '.04em',
                      color: done ? 'var(--green)' : active ? 'var(--blue)' : 'var(--text-faint)',
                      lineHeight: 1.3,
                    }}
                  >
                    {STAGE_LABELS[stage]}
                  </div>

                  {active && pct > 0 && (
                    <div
                      style={{
                        height: '3px',
                        background: 'var(--border)',
                        borderRadius: '999px',
                        marginTop: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: 'var(--blue)',
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div
          style={{
            ...panelStyle(),
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '14px',
              flexWrap: 'wrap',
              marginBottom: '12px',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>
                {job.job_name || 'Untitled Job'}
              </div>

              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  fontFamily: 'ui-monospace,monospace',
                  lineHeight: 1.6,
                }}
              >
                {job.project_address || 'No project address'}
                {job.sqft ? ` · ${job.sqft} sqft` : ''}
                {' · '}
                {job.contract_type === 'cost_plus' ? 'Cost Plus' : 'Fixed Price'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <a
                href={`/schedule?job=${id}`}
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  padding: '7px 10px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '7px',
                  textDecoration: 'none',
                  color: 'var(--text)',
                }}
              >
                📅 Master Schedule
              </a>

              <a
                href={`/schedule/sub/new?jobId=${id}`}
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  padding: '7px 10px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '7px',
                  textDecoration: 'none',
                  color: 'var(--text)',
                }}
              >
                + Schedule Item
              </a>

              <a
                href={`/schedule/order/new?jobId=${id}`}
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  padding: '7px 10px',
                  background: 'var(--text)',
                  color: 'var(--bg)',
                  borderRadius: '7px',
                  textDecoration: 'none',
                }}
              >
                + Procurement Item
              </a>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '8px',
              marginBottom: '10px',
            }}
          >
            <div style={statCardStyle()}>
              <div style={labelStyle()}>Current Stage</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--blue)' }}>
                {STAGE_LABELS[job.current_stage] || job.current_stage || '—'}
              </div>
            </div>

            <div style={statCardStyle()}>
              <div style={labelStyle()}>Next Stage</div>
              <div style={{ fontSize: '14px', fontWeight: '700' }}>
                {nextStage ? STAGE_LABELS[nextStage] : 'Complete'}
              </div>
            </div>

            <div style={statCardStyle()}>
              <div style={labelStyle()}>Schedule</div>
              <div style={{ fontSize: '14px', fontWeight: '700' }}>
                {activeScheduleItems.length} active items
              </div>
            </div>

            <div style={statCardStyle()}>
              <div style={labelStyle()}>Procurement</div>
              <div style={{ fontSize: '14px', fontWeight: '700' }}>
                {openProcurementItems.length} open items
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '14px',
              flexWrap: 'wrap',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            <span>
              <strong style={{ color: 'var(--text)' }}>Client:</strong>{' '}
              {primaryJobClient?.name ?? job.client_name ?? '—'}
            </span>
            <span>
              <strong style={{ color: 'var(--text)' }}>Primary Contact:</strong>{' '}
              {primaryContact?.name || '—'}
            </span>
            <span>
              <strong style={{ color: 'var(--text)' }}>Contact Info:</strong>{' '}
              {primaryContact?.email || primaryContact?.phone || '—'}
            </span>
            <span>
              <strong style={{ color: 'var(--text)' }}>PM:</strong>{' '}
              {pmProfile?.full_name || 'Unassigned'}
            </span>
            <span>
              <strong style={{ color: 'var(--text)' }}>Estimator:</strong>{' '}
              {estimatorProfile?.full_name || 'Unassigned'}
            </span>
            <span>
              <strong style={{ color: 'var(--text)' }}>Bookkeeper:</strong>{' '}
              {bookkeeperProfile?.full_name || 'Unassigned'}
            </span>
            <span>
              <strong style={{ color: 'var(--text)' }}>Open Issues:</strong> {openIssues.length}
            </span>
            <span>
              <strong style={{ color: 'var(--text)' }}>Released Schedule:</strong>{' '}
              {releasedScheduleItems.length}
            </span>
            <span>
              <strong style={{ color: 'var(--text)' }}>Confirmed Schedule:</strong>{' '}
              {confirmedScheduleItems.length}
            </span>
            {job.garage_code && (
              <span>
                <strong style={{ color: 'var(--text)' }}>Garage:</strong> {job.garage_code}
              </span>
            )}
            {job.lockbox_code && (
              <span>
                <strong style={{ color: 'var(--text)' }}>Lockbox:</strong> {job.lockbox_code}
              </span>
            )}
            {job.gate_code && (
              <span>
                <strong style={{ color: 'var(--text)' }}>Gate:</strong> {job.gate_code}
              </span>
            )}
            {job.parking_notes && (
              <span>
                <strong style={{ color: 'var(--text)' }}>Parking:</strong> {job.parking_notes}
              </span>
            )}
            {job.neighborhood_requirements && (
              <span>
                <strong style={{ color: 'var(--text)' }}>Neighborhood:</strong>{' '}
                {job.neighborhood_requirements}
              </span>
            )}
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
          statusColors={STATUS_COLORS}
          userId={user.id}
          canEditInfo={canEditInfo}
          pmOptions={pmOptions}
          estimatorOptions={estimatorOptions}
          bookkeeperOptions={bookkeeperOptions}
        />
      </div>
    </div>
  )
}
