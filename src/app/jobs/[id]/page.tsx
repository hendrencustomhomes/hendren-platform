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

  const { data: job } = await supabase
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

  if (!job) notFound()

  const [
    { data: checklistItems },
    { data: checklistState },
    { data: issues },
    { data: logs },
    { data: scheduleItems },
    { data: procurementItems },
    { data: pmOptions },
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
    masterItems
      .filter((i: any) => i.stage === stage)
      .sort((a: any, b: any) => a.sort_order - b.sort_order)

  const stagePct = (stage: string) => {
    const items = stageItems(stage)
    return items.length
      ? Math.round((items.filter((i: any) => checkedMap[i.id]).length / items.length) * 100)
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
  const activeScheduleItems = (scheduleItems || []).filter((s: any) => s.status !== 'cancelled')
  const releasedScheduleItems = activeScheduleItems.filter((s: any) => s.is_released)
  const openProcurementItems = (procurementItems || []).filter(
    (o: any) => !['Delivered', 'Confirmed'].includes(o.status)
  )

  const nextStage = STAGES[curIdx + 1] || null
  const canEditInfo = true

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
            {STAGES.map((stage, i) => {
              const done = i < curIdx
              const active = i === curIdx
              const pct = stagePct(stage)

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
                    {done ? '✓' : i + 1}
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
              <strong style={{ color: 'var(--text)' }}>Client:</strong> {job.client_name || '—'}
            </span>
            <span>
              <strong style={{ color: 'var(--text)' }}>PM:</strong>{' '}
              {(job.profiles as any)?.full_name || 'Unassigned'}
            </span>
            <span>
              <strong style={{ color: 'var(--text)' }}>Open Issues:</strong> {openIssues.length}
            </span>
            <span>
              <strong style={{ color: 'var(--text)' }}>Released Schedule:</strong>{' '}
              {releasedScheduleItems.length}
            </span>
          </div>
        </div>

        <JobTabs
          jobId={id}
          job={job}
          stageItems={STAGES.reduce(
            (acc, stage) => ({ ...acc, [stage]: stageItems(stage) }),
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
          pmOptions={pmOptions || []}
        />
      </div>
    </div>
  )
}