import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function orderByFlag(item: any): 'overdue' | 'soon' | 'ok' | 'none' {
  if (!item.order_by_date || item.status !== 'Pending') return 'none'
  const days = daysBetween(new Date().toISOString().slice(0,10), item.order_by_date)
  if (days < 0) return 'overdue'
  if (days <= 7) return 'soon'
  return 'ok'
}

function subFlag(sub: any): 'overdue' | 'soon' | 'ok' | 'none' {
  if (!sub.start_date || sub.status === 'complete' || sub.status === 'cancelled') return 'none'
  if (sub.status === 'on_site') return 'ok'
  const days = daysBetween(new Date().toISOString().slice(0,10), sub.start_date)
  if (days < 0 && sub.status !== 'confirmed') return 'overdue'
  if (days <= 14 && sub.status === 'tentative') return 'soon'
  return 'ok'
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

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { job: jobFilter } = await searchParams
  const subsQ = supabase.from('sub_schedule').select('*, jobs(id, client_name, color)').order('start_date',{ascending:true,nullsFirst:false})
  const ordersQ = supabase.from('procurement_items').select('*, jobs(id, client_name, color)').order('order_by_date',{ascending:true,nullsFirst:false})
  if (jobFilter) { subsQ.eq('job_id',jobFilter); ordersQ.eq('job_id',jobFilter) }
  const { data: subs } = await subsQ
  const { data: orders } = await ordersQ

  const subList = subs || []
  const orderList = orders || []

  const today = new Date().toISOString().slice(0, 10)

  const overdueOrders = orderList.filter(o => orderByFlag(o) === 'overdue')
  const soonOrders = orderList.filter(o => orderByFlag(o) === 'soon')
  const unconfirmedSubs = subList.filter(s => subFlag(s) === 'soon' || subFlag(s) === 'overdue')

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>
      {/* Topbar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/" style={{ fontSize: '13px', color: 'var(--blue)', textDecoration: 'none' }}>← Dashboard</a>
        <div style={{ fontSize: '15px', fontWeight: '700', flex: 1 }}>Master Schedule{jobFilter ? ' — This Job' : ''}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href="/schedule/sub/new" style={{ fontSize: '12px', fontWeight: '600', padding: '6px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', textDecoration: 'none', color: 'var(--text)' }}>+ Sub</a>
          <a href="/schedule/order/new" style={{ fontSize: '12px', fontWeight: '600', padding: '6px 12px', background: 'var(--text)', color: 'var(--bg)', borderRadius: '6px', textDecoration: 'none' }}>+ Order</a>
        </div>
      </div>

      <div style={{ padding: '14px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* Alert row */}
        {(overdueOrders.length > 0 || soonOrders.length > 0 || unconfirmedSubs.length > 0) && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {overdueOrders.length > 0 && (
              <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: '8px', padding: '10px 14px', flex: 1, minWidth: '200px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '.05em' }}>🔴 Overdue Orders</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--red)', margin: '2px 0' }}>{overdueOrders.length}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Past order-by date, not placed</div>
              </div>
            )}
            {soonOrders.length > 0 && (
              <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber)', borderRadius: '8px', padding: '10px 14px', flex: 1, minWidth: '200px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '.05em' }}>⚠️ Order Soon</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--amber)', margin: '2px 0' }}>{soonOrders.length}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Due within 7 days</div>
              </div>
            )}
            {unconfirmedSubs.length > 0 && (
              <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber)', borderRadius: '8px', padding: '10px 14px', flex: 1, minWidth: '200px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '.05em' }}>⚠️ Unconfirmed Subs</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--amber)', margin: '2px 0' }}>{unconfirmedSubs.length}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Starting within 14 days</div>
              </div>
            )}
          </div>
        )}

        {/* Sub Schedule */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', marginBottom: '14px' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '13px', fontWeight: '700' }}>Sub Schedule</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{subList.length} entries</div>
          </div>
          {subList.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>👷</div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>No subs scheduled yet</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Add sub schedule entries from a job or click + Sub above</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['Job', 'Trade', 'Sub', 'Status', 'Start', 'End', 'Notes', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subList.map((sub: any) => {
                    const flag = subFlag(sub)
                    return (
                      <tr key={sub.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: sub.jobs?.color || '#888', flexShrink: 0, display: 'inline-block' }} />
                            <span style={{ fontSize: '12px' }}>{sub.jobs?.client_name || '—'}</span>
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: '500' }}>{sub.trade}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{sub.sub_name || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '10px', background: STATUS_COLORS[sub.status] + '22', color: STATUS_COLORS[sub.status], border: `1px solid ${STATUS_COLORS[sub.status]}44` }}>
                            {sub.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap', color: flag === 'overdue' ? 'var(--red)' : flag === 'soon' ? 'var(--amber)' : 'var(--text)' }}>
                          {flag === 'overdue' && '🔴 '}{flag === 'soon' && '⚠️ '}{fmtDate(sub.start_date)}
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{fmtDate(sub.end_date)}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.notes || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <a href={`/schedule/sub/${sub.id}/edit`} style={{ fontSize: '11px', color: 'var(--blue)', textDecoration: 'none' }}>Edit</a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Procurement Orders */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '13px', fontWeight: '700' }}>Material Orders</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{orderList.length} items</div>
          </div>
          {orderList.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📦</div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>No orders yet</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Add procurement items from a job's estimate or click + Order above</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['Job', 'Trade', 'Item', 'Vendor', 'Need By', 'Order By', 'Lead', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orderList.map((order: any) => {
                    const flag = orderByFlag(order)
                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: order.jobs?.color || '#888', flexShrink: 0, display: 'inline-block' }} />
                            <span>{order.jobs?.client_name || '—'}</span>
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: '500' }}>{order.trade}</td>
                        <td style={{ padding: '8px 12px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.description}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{order.vendor || '—'}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{fmtDate(order.required_on_site_date)}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap', color: flag === 'overdue' ? 'var(--red)' : flag === 'soon' ? 'var(--amber)' : 'var(--text)' }}>
                          {flag === 'overdue' && '🔴 '}{flag === 'soon' && '⚠️ '}{fmtDate(order.order_by_date)}
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'ui-monospace,monospace', color: 'var(--text-muted)' }}>{order.lead_days}d</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '10px', background: STATUS_COLORS[order.status] + '22', color: STATUS_COLORS[order.status], border: `1px solid ${STATUS_COLORS[order.status]}44` }}>
                            {order.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <a href={`/schedule/order/${order.id}/edit`} style={{ fontSize: '11px', color: 'var(--blue)', textDecoration: 'none' }}>Edit</a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
