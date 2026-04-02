import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import { getOrderRiskLevel, getScheduleRiskLevel } from '@/lib/db'

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

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

type DashboardRisk = {
  id: string
  kind: 'schedule' | 'procurement'
  level: 'soon' | 'overdue'
  jobId: string
  jobName: string
  date: string | null
  message: string
}

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: jobs }, { data: subs }, { data: orders }] = await Promise.all([
    supabase
      .from('jobs')
      .select(
        `
        id,
        job_name,
        project_address,
        color,
        current_stage,
        created_at,
        is_active,
        profiles!jobs_pm_id_fkey(full_name),
        issues(id, severity, resolved)
      `
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false }),

    supabase
      .from('sub_schedule')
      .select(
        `
        id,
        job_id,
        trade,
        sub_name,
        start_date,
        end_date,
        status,
        is_released,
        release_date,
        notification_window_days,
        jobs(id, job_name)
      `
      )
      .order('start_date', { ascending: true, nullsFirst: false }),

    supabase
      .from('procurement_items')
      .select(
        `
        id,
        job_id,
        trade,
        description,
        vendor,
        status,
        order_by_date,
        required_on_site_date,
        lead_days,
        procurement_group,
        is_client_supplied,
        is_sub_supplied,
        requires_tracking,
        jobs(id, job_name)
      `
      )
      .order('order_by_date', { ascending: true, nullsFirst: false }),
  ])

  const jobList = jobs || []
  const subList = subs || []
  const orderList = orders || []

  const criticalJobs = jobList.filter((j: any) =>
    (j.issues || []).some((i: any) => i.severity === 'Critical' && !i.resolved)
  )

  const scheduleRisks: DashboardRisk[] = subList
    .map((sub: any) => {
      const level = getScheduleRiskLevel(sub)
      if (level === 'none') return null

      const jobName = sub.jobs?.job_name || 'Untitled Job'
      const companyName = sub.sub_name || 'Unassigned company'
      const stateText = sub.is_released ? 'released but not confirmed' : 'still draft / not released'

      return {
        id: `schedule-${sub.id}`,
        kind: 'schedule',
        level,
        jobId: sub.job_id,
        jobName,
        date: sub.start_date,
        message: `${sub.trade} (${companyName}) starts ${fmtDate(sub.start_date)} and is ${stateText}.`,
      } satisfies DashboardRisk
    })
    .filter(Boolean) as DashboardRisk[]

  const procurementRisks: DashboardRisk[] = orderList
    .map((order: any) => {
      const level = getOrderRiskLevel(order)
      if (level === 'none') return null

      const jobName = order.jobs?.job_name || 'Untitled Job'
      const suffix =
        level === 'overdue' ? 'is past the order-by date.' : 'needs ordering soon.'

      return {
        id: `procurement-${order.id}`,
        kind: 'procurement',
        level,
        jobId: order.job_id,
        jobName,
        date: order.order_by_date,
        message: `${order.description} ${suffix}`,
      } satisfies DashboardRisk
    })
    .filter(Boolean) as DashboardRisk[]

  const risks = [...scheduleRisks, ...procurementRisks].sort((a, b) => {
    if (a.level !== b.level) return a.level === 'overdue' ? -1 : 1
    const aTime = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER
    const bTime = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER
    return aTime - bTime
  })

  const overdueRisks = risks.filter((r) => r.level === 'overdue').length
  const soonRisks = risks.filter((r) => r.level === 'soon').length

  return (
    <div
      style={{
        background: 'var(--bg)',
        minHeight: '100vh',
        color: 'var(--text)',
        fontFamily: 'system-ui,-apple-system,sans-serif',
      }}
    >
      <Nav title="Dashboard" />

      <div style={{ padding: '14px', maxWidth: '900px', margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: '10px',
            marginBottom: '14px',
          }}
        >
          {[
            { label: 'Active Jobs', value: jobList.length, color: 'var(--text)' },
            { label: 'Critical Jobs', value: criticalJobs.length, color: 'var(--red)' },
            {
              label: 'Overdue Risks',
              value: overdueRisks,
              color: overdueRisks ? 'var(--red)' : 'var(--text)',
            },
            {
              label: 'Upcoming Risks',
              value: soonRisks,
              color: soonRisks ? 'var(--amber)' : 'var(--text)',
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '13px 14px',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  fontFamily: 'ui-monospace,monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '.04em',
                  marginBottom: '4px',
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            marginBottom: '14px',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: '700' }}>Risk List</div>
            <a
              href="/schedule"
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--blue)',
                textDecoration: 'none',
              }}
            >
              Open Master Schedule →
            </a>
          </div>

          {risks.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                No active risks
              </div>
              <div style={{ fontSize: '12px' }}>Schedule and procurement look clean right now.</div>
            </div>
          ) : (
            risks.map((risk) => (
              <a
                key={risk.id}
                href={`/jobs/${risk.jobId}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '.04em',
                      marginBottom: '4px',
                      color: risk.level === 'overdue' ? 'var(--red)' : 'var(--amber)',
                    }}
                  >
                    {risk.level === 'overdue' ? 'Critical' : 'Warning'} ·{' '}
                    {risk.kind === 'schedule' ? 'Schedule' : 'Procurement'}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '2px' }}>
                    {risk.jobName}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                    {risk.message}
                  </div>
                </div>

                <div
                  style={{
                    flexShrink: 0,
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    fontFamily: 'ui-monospace,monospace',
                    marginTop: '2px',
                  }}
                >
                  {fmtDate(risk.date)}
                </div>
              </a>
            ))
          )}
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: '700' }}>Jobs</div>
            <a
              href="/jobs/new"
              style={{
                fontSize: '12px',
                fontWeight: '600',
                background: 'var(--text)',
                color: 'var(--bg)',
                padding: '6px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
              }}
            >
              + New Job
            </a>
          </div>

          {jobList.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏠</div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--text)',
                  marginBottom: '4px',
                }}
              >
                No jobs yet
              </div>
              <div style={{ fontSize: '12px' }}>Click &quot;+ New Job&quot; to get started</div>
            </div>
          ) : (
            jobList.map((job: any) => {
              const openIssues = (job.issues || []).filter((i: any) => !i.resolved)
              const hasCritical = openIssues.some((i: any) => i.severity === 'Critical')

              const jobRiskCount = risks.filter((r) => r.jobId === job.id).length
              const hasOverdueRisk = risks.some((r) => r.jobId === job.id && r.level === 'overdue')

              return (
                <a
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '11px 16px',
                    borderBottom: '1px solid var(--border)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div
                    style={{
                      width: '3px',
                      height: '36px',
                      borderRadius: '2px',
                      background: job.color || '#3B8BD4',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>{job.job_name}</div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        fontFamily: 'ui-monospace,monospace',
                        marginTop: '1px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {job.project_address}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        background: 'var(--blue-bg)',
                        color: 'var(--blue)',
                        border: '1px solid var(--blue)',
                        fontFamily: 'ui-monospace,monospace',
                      }}
                    >
                      {STAGE_LABELS[job.current_stage] || job.current_stage}
                    </span>

                    {hasCritical && (
                      <div
                        style={{
                          fontSize: '10px',
                          color: 'var(--red)',
                          marginTop: '2px',
                          fontWeight: '600',
                        }}
                      >
                        ⚠ Critical
                      </div>
                    )}

                    {!hasCritical && jobRiskCount > 0 && (
                      <div
                        style={{
                          fontSize: '10px',
                          color: hasOverdueRisk ? 'var(--red)' : 'var(--amber)',
                          marginTop: '2px',
                          fontWeight: '600',
                        }}
                      >
                        {hasOverdueRisk ? '⚠' : '•'} {jobRiskCount} risk{jobRiskCount > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </a>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
