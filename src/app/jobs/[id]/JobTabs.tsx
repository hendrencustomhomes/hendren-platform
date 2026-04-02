'use client'

import { useState } from 'react'

function getScheduleBadge(sub: any) {
  if (sub.status === 'confirmed') return { label: 'Confirmed', color: 'var(--green)' }
  if (sub.is_released) return { label: 'Released', color: 'var(--blue)' }
  return { label: 'Draft', color: 'var(--text-muted)' }
}

function getOrderSourceBadge(order: any) {
  if (order.is_client_supplied) return { label: 'Client', color: 'var(--amber)' }
  if (order.is_sub_supplied) return { label: 'Company', color: 'var(--blue)' }
  if (order.requires_tracking === false) return { label: 'No Track', color: 'var(--text-muted)' }
  return { label: 'Internal', color: 'var(--green)' }
}

export default function JobTabs({
  jobId,
  subs,
  orders,
}: any) {
  const [tab, setTab] = useState<'schedule' | 'orders'>('schedule')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {[
          { key: 'schedule', label: 'Schedule' },
          { key: 'orders', label: 'Orders' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: tab === t.key ? 'var(--text)' : 'var(--surface)',
              color: tab === t.key ? 'var(--bg)' : 'var(--text)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===================== SCHEDULE ===================== */}
      {tab === 'schedule' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
          {subs?.length === 0 ? (
            <div style={{ padding: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
              No schedule items yet
            </div>
          ) : (
            subs.map((sub: any) => {
              const badge = getScheduleBadge(sub)

              return (
                <a
                  key={sub.id}
                  href={`/schedule/sub/${sub.id}/edit`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>
                      {sub.trade}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {sub.sub_name || 'Unassigned'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        border: `1px solid ${badge.color}`,
                        color: badge.color,
                      }}
                    >
                      {badge.label}
                    </span>

                    {sub.start_date && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {new Date(sub.start_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </a>
              )
            })
          )}
        </div>
      )}

      {/* ===================== ORDERS ===================== */}
      {tab === 'orders' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
          {orders?.length === 0 ? (
            <div style={{ padding: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
              No orders yet
            </div>
          ) : (
            orders.map((order: any) => {
              const source = getOrderSourceBadge(order)

              return (
                <a
                  key={order.id}
                  href={`/schedule/order/${order.id}/edit`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>
                      {order.description}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {order.vendor || order.trade}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        border: `1px solid ${source.color}`,
                        color: source.color,
                      }}
                    >
                      {source.label}
                    </span>

                    {order.order_by_date && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {new Date(order.order_by_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </a>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
