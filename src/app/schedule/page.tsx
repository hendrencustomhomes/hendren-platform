import Link from 'next/link'
import { redirect } from 'next/navigation'

import Nav from '@/components/Nav'
import {
  getOrderRiskLevel,
  getScheduleRiskLevel,
  type ProcurementItem,
  type JobSubSchedule,
} from '@/lib/db'
import { getResolvedScheduleGraph } from '@/lib/schedule/resolver'
import type { ScheduleNode } from '@/lib/schedule/nodes'
import { createClient } from '@/utils/supabase/server'

type JobRef = {
  id: string
  client_name: string | null
  color: string | null
}

type ScheduleRow = JobSubSchedule & {
  jobs?: JobRef | null
}

type ProcurementRow = ProcurementItem & {
  jobs?: JobRef | null
}

type AlertRow = {
  type: 'schedule' | 'procurement'
  level: 'soon' | 'overdue'
  message: string
  date: string | null
  jobName: string
}

function fmtDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
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
}

function pageCardStyle() {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
    overflowX: 'auto' as const,
  }
}

function summaryCardStyle(level: 'soon' | 'overdue') {
  return {
    flex: '1 1 220px',
    minWidth: '220px',
    borderRadius: '12px',
    padding: '14px',
    border:
      level === 'overdue'
        ? '1px solid rgba(220, 38, 38, 0.25)'
        : '1px solid rgba(217, 119, 6, 0.25)',
    background:
      level === 'overdue'
        ? 'rgba(220, 38, 38, 0.08)'
        : 'rgba(217, 119, 6, 0.08)',
  }
}

function thStyle() {
  return {
    textAlign: 'left' as const,
    fontSize: '12px',
    color: 'var(--text-muted)',
    padding: '10px 8px',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '.04em',
    fontFamily: 'ui-monospace,monospace',
  }
}

function tdStyle() {
  return {
    padding: '12px 8px',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top' as const,
    fontSize: '14px',
  }
}

function badgeStyle(color?: string, muted = false) {
  return {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 600 as const,
    whiteSpace: 'nowrap' as const,
    color: muted ? 'var(--text-muted)' : '#fff',
    background: muted ? 'var(--bg)' : color || '#666',
    border: muted ? '1px solid var(--border)' : 'none',
  }
}

function buildScheduleAlert(item: ScheduleRow): AlertRow | null {
  const level = getScheduleRiskLevel(item)
  if (level === 'none') return null

  const jobName = item.jobs?.client_name || 'Unknown Job'
  const companyName = item.sub_name || 'Unassigned company'
  const stateText = item.is_released
    ? 'released but not confirmed'
    : 'still draft and not released'

  return {
    type: 'schedule',
    level,
    message: `${jobName} — ${item.trade} (${companyName}) starts ${fmtDate(
      item.start_date
    )} and is ${stateText}.`,
    date: item.start_date,
    jobName,
  }
}

function buildProcurementAlert(item: ProcurementRow): AlertRow | null {
  const level = getOrderRiskLevel(item)
  if (level === 'none') return null

  const jobName = item.jobs?.client_name || 'Unknown Job'
  const statusText =
    level === 'overdue' ? 'is past the order-by date' : 'needs ordering soon'

  return {
    type: 'procurement',
    level,
    message: `${jobName} — ${item.description} ${statusText}.`,
    date: item.order_by_date,
    jobName,
  }
}

function getProcurementSource(item: ProcurementRow) {
  if (item.is_client_supplied) return 'Client'
  if (item.is_sub_supplied) return 'Company'
  if (item.requires_tracking === false) return 'No Tracking'
  return 'Internal'
}

function resolvedHint(storedDate: string | null, resolvedDate: string | null) {
  const changed = storedDate !== resolvedDate
  return (
    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
      Resolved: {fmtDate(resolvedDate)}
      {changed && (
        <span
          style={{
            marginLeft: '5px',
            display: 'inline-block',
            padding: '1px 6px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 600,
            background: 'rgba(234, 88, 12, 0.1)',
            color: '#ea580c',
          }}
        >
          Shifted
        </span>
      )}
    </div>
  )
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { job: jobFilter } = await searchParams

  const scheduleQuery = supabase
    .from('sub_schedule')
    .select(
      `
      *,
      jobs(id, client_name, color)
    `
    )
    .order('start_date', { ascending: true, nullsFirst: false })

  const procurementQuery = supabase
    .from('procurement_items')
    .select(
      `
      *,
      jobs(id, client_name, color)
    `
    )
    .order('order_by_date', { ascending: true, nullsFirst: false })

  if (jobFilter) {
    scheduleQuery.eq('job_id', jobFilter)
    procurementQuery.eq('job_id', jobFilter)
  }

  const [{ data: scheduleItems }, { data: procurementItems }] = await Promise.all([
    scheduleQuery,
    procurementQuery,
  ])

  const scheduleList: ScheduleRow[] = (scheduleItems || []) as ScheduleRow[]
  const procurementList: ProcurementRow[] = (procurementItems || []) as ProcurementRow[]

  let resolvedNodes: Record<string, ScheduleNode> | null = null
  if (jobFilter) {
    try {
      const graph = await getResolvedScheduleGraph(supabase, jobFilter)
      resolvedNodes = graph.resolvedNodes
    } catch {
      // Graceful fallback — engine errors do not break the page
    }
  }

  const alerts = [
    ...scheduleList.map(buildScheduleAlert),
    ...procurementList.map(buildProcurementAlert),
  ]
    .filter((alert): alert is AlertRow => Boolean(alert))
    .sort((a, b) => {
      if (a.level !== b.level) {
        return a.level === 'overdue' ? -1 : 1
      }

      const aTime = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER
      const bTime = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER
      return aTime - bTime
    })

  const overdueCount = alerts.filter((alert) => alert.level === 'overdue').length
  const soonCount = alerts.filter((alert) => alert.level === 'soon').length

  return (
    <>
      <Nav title={jobFilter ? 'Schedule — This Job' : 'Schedule'} />
      <main
        style={{
          padding: '16px',
          maxWidth: '1400px',
          margin: '0 auto',
          background: 'var(--bg)',
          minHeight: '100vh',
          color: 'var(--text)',
        }}
      >
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '16px',
        }}
      >
        <Link
          href={`/schedule/sub/new${jobFilter ? `?jobId=${jobFilter}` : ''}`}
          style={{
            textDecoration: 'none',
            background: 'var(--text)',
            color: 'var(--bg)',
            padding: '10px 14px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          + Labor Schedule
        </Link>

        <Link
          href={`/schedule/order/new${jobFilter ? `?jobId=${jobFilter}` : ''}`}
          style={{
            textDecoration: 'none',
            background: 'var(--blue)',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          + Material Schedule
        </Link>
      </div>

      {alerts.length > 0 && (
        <section style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              marginBottom: '12px',
            }}
          >
            {overdueCount > 0 && (
              <div style={summaryCardStyle('overdue')}>
                <div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: '4px' }}>
                  Overdue Risks
                </div>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{overdueCount}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Immediate attention needed
                </div>
              </div>
            )}

            {soonCount > 0 && (
              <div style={summaryCardStyle('soon')}>
                <div style={{ fontWeight: 700, color: 'var(--amber)', marginBottom: '4px' }}>
                  Upcoming Risks
                </div>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{soonCount}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Action needed soon
                </div>
              </div>
            )}
          </div>

          <div style={pageCardStyle()}>
            <div style={{ fontWeight: 700, marginBottom: '10px', fontSize: '16px' }}>Risk List</div>

            <div style={{ display: 'grid', gap: '10px' }}>
              {alerts.map((alert, idx) => (
                <div
                  key={`${alert.type}-${idx}`}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border:
                      alert.level === 'overdue'
                        ? '1px solid rgba(220, 38, 38, 0.25)'
                        : '1px solid rgba(217, 119, 6, 0.25)',
                    background:
                      alert.level === 'overdue'
                        ? 'rgba(220, 38, 38, 0.08)'
                        : 'rgba(217, 119, 6, 0.08)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      marginBottom: '4px',
                      color: alert.level === 'overdue' ? 'var(--red)' : 'var(--amber)',
                    }}
                  >
                    {alert.level === 'overdue' ? 'CRITICAL' : 'WARNING'} ·{' '}
                    {alert.type === 'schedule' ? 'Labor Schedule' : 'Material Schedule'}
                  </div>

                  <div style={{ fontSize: '14px', lineHeight: 1.5 }}>{alert.message}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section style={pageCardStyle()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '12px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '20px' }}>Labor Schedule</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              {scheduleList.length} entries
            </div>
          </div>
        </div>

        {scheduleList.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            <div style={{ marginBottom: '6px' }}>No schedule items yet</div>
            <div>Add schedule items from a job or click + Schedule Item above</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  'Job',
                  'Trade',
                  'Company',
                  'Status',
                  'Release',
                  'Start',
                  'End',
                  'Cost Code',
                  'Notes',
                  '',
                ].map((heading) => (
                  <th key={heading} style={thStyle()}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {scheduleList.map((item) => {
                const risk = getScheduleRiskLevel(item)
                const jobColor = item.jobs?.color || '#e5e7eb'
                const resolvedNode: ScheduleNode | undefined =
                  resolvedNodes?.[`schedule:${item.id}`]

                return (
                  <tr key={item.id}>
                    <td style={tdStyle()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '999px',
                            background: jobColor,
                            display: 'inline-block',
                          }}
                        />
                        <span>{item.jobs?.client_name || '—'}</span>
                      </div>
                    </td>

                    <td style={tdStyle()}>{item.trade}</td>
                    <td style={tdStyle()}>{item.sub_name || '—'}</td>

                    <td style={tdStyle()}>
                      <span style={badgeStyle(STATUS_COLORS[item.status])}>{item.status}</span>
                    </td>

                    <td style={tdStyle()}>
                      <span style={badgeStyle(undefined, !item.is_released)}>
                        {item.is_released ? 'Released' : 'Draft'}
                      </span>
                    </td>

                    <td style={tdStyle()}>
                      {risk === 'overdue' && (
                        <span style={{ color: 'var(--red)', marginRight: '6px' }}>●</span>
                      )}
                      {risk === 'soon' && (
                        <span style={{ color: 'var(--amber)', marginRight: '6px' }}>⚠️</span>
                      )}
                      {fmtDate(item.start_date)}
                      {resolvedNode &&
                        resolvedHint(item.start_date, resolvedNode.start_date)}
                    </td>

                    <td style={tdStyle()}>
                      {fmtDate(item.end_date)}
                      {resolvedNode &&
                        resolvedHint(item.end_date, resolvedNode.end_date)}
                    </td>
                    <td style={tdStyle()}>{item.cost_code || '—'}</td>
                    <td style={tdStyle()}>{item.notes || '—'}</td>

                    <td style={tdStyle()}>
                      <Link
                        href={`/schedule/sub/${item.id}/edit`}
                        style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section style={pageCardStyle()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '12px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '20px' }}>Material Schedule</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              {procurementList.length} items
            </div>
          </div>
        </div>

        {procurementList.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            <div style={{ marginBottom: '6px' }}>No procurement items yet</div>
            <div>Add procurement items from a job or click + Procurement Item above</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  'Job',
                  'Trade',
                  'Item',
                  'Group',
                  'Company',
                  'Need By',
                  'Order By',
                  'Lead',
                  'Status',
                  'Source',
                  '',
                ].map((heading) => (
                  <th key={heading} style={thStyle()}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {procurementList.map((item) => {
                const risk = getOrderRiskLevel(item)
                const jobColor = item.jobs?.color || '#e5e7eb'
                const source = getProcurementSource(item)
                const resolvedNode: ScheduleNode | undefined =
                  resolvedNodes?.[`procurement:${item.id}`]

                return (
                  <tr key={item.id}>
                    <td style={tdStyle()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '999px',
                            background: jobColor,
                            display: 'inline-block',
                          }}
                        />
                        <span>{item.jobs?.client_name || '—'}</span>
                      </div>
                    </td>

                    <td style={tdStyle()}>{item.trade}</td>
                    <td style={tdStyle()}>{item.description}</td>
                    <td style={tdStyle()}>{item.procurement_group || '—'}</td>
                    <td style={tdStyle()}>{item.vendor || '—'}</td>
                    <td style={tdStyle()}>
                      {fmtDate(item.required_on_site_date)}
                      {resolvedNode &&
                        resolvedHint(item.required_on_site_date, resolvedNode.start_date)}
                    </td>

                    <td style={tdStyle()}>
                      {risk === 'overdue' && (
                        <span style={{ color: 'var(--red)', marginRight: '6px' }}>●</span>
                      )}
                      {risk === 'soon' && (
                        <span style={{ color: 'var(--amber)', marginRight: '6px' }}>⚠️</span>
                      )}
                      {fmtDate(item.order_by_date)}
                    </td>

                    <td style={tdStyle()}>{item.lead_days ?? 0}d</td>

                    <td style={tdStyle()}>
                      <span style={badgeStyle(STATUS_COLORS[item.status])}>{item.status}</span>
                    </td>

                    <td style={tdStyle()}>{source}</td>

                    <td style={tdStyle()}>
                      <Link
                        href={`/schedule/order/${item.id}/edit`}
                        style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
      </main>
    </>
  )
}