import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  getOrderRiskLevel,
  getScheduleRiskLevel,
  type ProcurementItem,
  type JobSubSchedule,
} from '@/lib/db'
import { createClient } from '@/utils/supabase/server'

type JobRef = {
  id: string
  client_name: string | null
  color: string | null
}

type ScheduleRow = JobSubSchedule & {
  jobs?: JobRef | null
}

type OrderRow = ProcurementItem & {
  jobs?: JobRef | null
}

type AlertRow = {
  type: 'schedule' | 'procurement'
  level: 'soon' | 'overdue'
  message: string
  date: string | null
  jobName: string
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

const STATUS_COLORS: Record<string, string> = {
  tentative: '#b45309',
  confirmed: '#16a34a',
  on_site: '#2563eb',
  complete: '#888',
  cancelled: '#dc2626',
  Pending: '#b45309',
  Ordered: '#2563eb',
  Confirmed: '#16a34a',
  Delivered: '#888',
  Issue: '#dc2626',
}

function badgeStyle(color?: string) {
  return {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600 as const,
    color: '#fff',
    background: color || '#666',
    whiteSpace: 'nowrap' as const,
  }
}

function cardStyle() {
  return {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    overflowX: 'auto' as const,
  }
}

function thStyle() {
  return {
    textAlign: 'left' as const,
    fontSize: 12,
    color: '#666',
    padding: '10px 8px',
    borderBottom: '1px solid #eee',
    whiteSpace: 'nowrap' as const,
  }
}

function tdStyle() {
  return {
    padding: '12px 8px',
    borderBottom: '1px solid #f3f4f6',
    verticalAlign: 'top' as const,
  }
}

function alertCardStyle(level: 'soon' | 'overdue') {
  return {
    flex: '1 1 220px',
    minWidth: 220,
    borderRadius: 12,
    padding: 14,
    border: `1px solid ${level === 'overdue' ? '#fecaca' : '#fde68a'}`,
    background: level === 'overdue' ? '#fef2f2' : '#fffbeb',
  }
}

function buildScheduleAlert(sub: ScheduleRow): AlertRow | null {
  const level = getScheduleRiskLevel(sub)
  if (level === 'none') return null

  const jobName = sub.jobs?.client_name || 'Unknown Job'
  const companyName = sub.sub_name || 'Unassigned company'
  const stateText = sub.is_released ? 'released but not confirmed' : 'still draft / not released'

  return {
    type: 'schedule',
    level,
    message: `${jobName} — ${sub.trade} (${companyName}) starts ${fmtDate(
      sub.start_date
    )} and is ${stateText}.`,
    date: sub.start_date,
    jobName,
  }
}

function buildOrderAlert(order: OrderRow): AlertRow | null {
  const level = getOrderRiskLevel(order)
  if (level === 'none') return null

  const jobName = order.jobs?.client_name || 'Unknown Job'
  const statusText =
    level === 'overdue' ? 'is past the order-by date' : 'needs ordering soon'

  return {
    type: 'procurement',
    level,
    message: `${jobName} — ${order.description} ${statusText}.`,
    date: order.order_by_date,
    jobName,
  }
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

  const subsQ = supabase
    .from('sub_schedule')
    .select(
      `
      *,
      jobs(id, client_name, color)
    `
    )
    .order('start_date', { ascending: true, nullsFirst: false })

  const ordersQ = supabase
    .from('procurement_items')
    .select(
      `
      *,
      jobs(id, client_name, color)
    `
    )
    .order('order_by_date', { ascending: true, nullsFirst: false })

  if (jobFilter) {
    subsQ.eq('job_id', jobFilter)
    ordersQ.eq('job_id', jobFilter)
  }

  const [{ data: subs }, { data: orders }] = await Promise.all([subsQ, ordersQ])

  const subList: ScheduleRow[] = (subs || []) as ScheduleRow[]
  const orderList: OrderRow[] = (orders || []) as OrderRow[]

  const alerts = [
    ...subList.map(buildScheduleAlert),
    ...orderList.map(buildOrderAlert),
  ]
    .filter((a): a is AlertRow => Boolean(a))
    .sort((a, b) => {
      if (a.level !== b.level) {
        return a.level === 'overdue' ? -1 : 1
      }

      const aTime = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER
      const bTime = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER
      return aTime - bTime
    })

  const overdueCount = alerts.filter((a) => a.level === 'overdue').length
  const soonCount = alerts.filter((a) => a.level === 'soon').length

  return (
    <main style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div>
          <Link
            href="/"
            style={{
              color: '#2563eb',
              textDecoration: 'none',
              fontSize: 14,
              display: 'inline-block',
              marginBottom: 6,
            }}
          >
            ← Dashboard
          </Link>
          <h1 style={{ margin: 0, fontSize: 28 }}>
            Master Schedule{jobFilter ? ' — This Job' : ''}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Link
            href="/schedule/sub/new"
            style={{
              textDecoration: 'none',
              background: '#111827',
              color: '#fff',
              padding: '10px 14px',
              borderRadius: 10,
              fontWeight: 600,
            }}
          >
            + Sub
          </Link>
          <Link
            href="/schedule/order/new"
            style={{
              textDecoration: 'none',
              background: '#2563eb',
              color: '#fff',
              padding: '10px 14px',
              borderRadius: 10,
              fontWeight: 600,
            }}
          >
            + Order
          </Link>
        </div>
      </div>

      {alerts.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 12,
            }}
          >
            {overdueCount > 0 && (
              <div style={alertCardStyle('overdue')}>
                <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
                  Overdue Risks
                </div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{overdueCount}</div>
                <div style={{ fontSize: 13, color: '#7f1d1d' }}>
                  Immediate attention needed
                </div>
              </div>
            )}

            {soonCount > 0 && (
              <div style={alertCardStyle('soon')}>
                <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                  Upcoming Risks
                </div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{soonCount}</div>
                <div style={{ fontSize: 13, color: '#92400e' }}>
                  Action needed soon
                </div>
              </div>
            )}
          </div>

          <div style={cardStyle()}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Risk List</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {alerts.map((alert, idx) => (
                <div
                  key={`${alert.type}-${idx}`}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border:
                      alert.level === 'overdue'
                        ? '1px solid #fecaca'
                        : '1px solid #fde68a',
                    background:
                      alert.level === 'overdue' ? '#fef2f2' : '#fffbeb',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: 4,
                      color:
                        alert.level === 'overdue' ? '#991b1b' : '#92400e',
                    }}
                  >
                    {alert.level === 'overdue' ? 'CRITICAL' : 'WARNING'} ·{' '}
                    {alert.type === 'schedule' ? 'Schedule' : 'Procurement'}
                  </div>
                  <div style={{ fontSize: 14 }}>{alert.message}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section style={cardStyle()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>Sub Schedule</h2>
            <div style={{ color: '#666', fontSize: 14 }}>{subList.length} entries</div>
          </div>
        </div>

        {subList.length === 0 ? (
          <div style={{ color: '#666' }}>
            <div style={{ marginBottom: 6 }}>No subs scheduled yet</div>
            <div>Add sub schedule entries from a job or click + Sub above</div>
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
                  'Released',
                  'Start',
                  'End',
                  'Cost Code',
                  'Notes',
                  '',
                ].map((h) => (
                  <th key={h} style={thStyle()}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subList.map((sub) => {
                const risk = getScheduleRiskLevel(sub)
                const jobColor = sub.jobs?.color || '#e5e7eb'

                return (
                  <tr key={sub.id}>
                    <td style={tdStyle()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: jobColor,
                            display: 'inline-block',
                          }}
                        />
                        <span>{sub.jobs?.client_name || '—'}</span>
                      </div>
                    </td>
                    <td style={tdStyle()}>{sub.trade}</td>
                    <td style={tdStyle()}>{sub.sub_name || '—'}</td>
                    <td style={tdStyle()}>
                      <span style={badgeStyle(STATUS_COLORS[sub.status])}>
                        {sub.status}
                      </span>
                    </td>
                    <td style={tdStyle()}>
                      <span
                        style={badgeStyle(sub.is_released ? '#2563eb' : '#6b7280')}
                      >
                        {sub.is_released ? 'Released' : 'Draft'}
                      </span>
                    </td>
                    <td style={tdStyle()}>
                      {risk === 'overdue' && (
                        <span style={{ color: '#dc2626', marginRight: 6 }}>●</span>
                      )}
                      {risk === 'soon' && (
                        <span style={{ color: '#d97706', marginRight: 6 }}>⚠️</span>
                      )}
                      {fmtDate(sub.start_date)}
                    </td>
                    <td style={tdStyle()}>{fmtDate(sub.end_date)}</td>
                    <td style={tdStyle()}>{sub.cost_code || '—'}</td>
                    <td style={tdStyle()}>{sub.notes || '—'}</td>
                    <td style={tdStyle()}>
                      <Link
                        href={`/schedule/sub/${sub.id}/edit`}
                        style={{ color: '#2563eb', textDecoration: 'none' }}
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

      <section style={cardStyle()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>Material Orders</h2>
            <div style={{ color: '#666', fontSize: 14 }}>{orderList.length} items</div>
          </div>
        </div>

        {orderList.length === 0 ? (
          <div style={{ color: '#666' }}>
            <div style={{ marginBottom: 6 }}>No orders yet</div>
            <div>Add procurement items from a job&apos;s estimate or click + Order above</div>
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
                  'Vendor',
                  'Need By',
                  'Order By',
                  'Lead',
                  'Status',
                  'Source',
                  '',
                ].map((h) => (
                  <th key={h} style={thStyle()}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orderList.map((order) => {
                const risk = getOrderRiskLevel(order)
                const jobColor = order.jobs?.color || '#e5e7eb'

                let source = 'Internal'
                if (order.is_client_supplied) source = 'Client'
                else if (order.is_sub_supplied) source = 'Company'
                else if (order.requires_tracking === false) source = 'No Tracking'

                return (
                  <tr key={order.id}>
                    <td style={tdStyle()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: jobColor,
                            display: 'inline-block',
                          }}
                        />
                        <span>{order.jobs?.client_name || '—'}</span>
                      </div>
                    </td>
                    <td style={tdStyle()}>{order.trade}</td>
                    <td style={tdStyle()}>{order.description}</td>
                    <td style={tdStyle()}>{order.procurement_group || '—'}</td>
                    <td style={tdStyle()}>{order.vendor || '—'}</td>
                    <td style={tdStyle()}>{fmtDate(order.required_on_site_date)}</td>
                    <td style={tdStyle()}>
                      {risk === 'overdue' && (
                        <span style={{ color: '#dc2626', marginRight: 6 }}>●</span>
                      )}
                      {risk === 'soon' && (
                        <span style={{ color: '#d97706', marginRight: 6 }}>⚠️</span>
                      )}
                      {fmtDate(order.order_by_date)}
                    </td>
                    <td style={tdStyle()}>{order.lead_days ?? 0}d</td>
                    <td style={tdStyle()}>
                      <span style={badgeStyle(STATUS_COLORS[order.status])}>
                        {order.status}
                      </span>
                    </td>
                    <td style={tdStyle()}>{source}</td>
                    <td style={tdStyle()}>
                      <Link
                        href={`/schedule/order/${order.id}/edit`}
                        style={{ color: '#2563eb', textDecoration: 'none' }}
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
  )
}