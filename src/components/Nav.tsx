'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/schedule', label: 'Schedule', icon: '📅' },
  { href: '/jobs/new', label: 'New Job', icon: '➕' },
]

export default function Nav({ title, back }: { title: string; back?: string }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* Topbar */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '11px 16px', display: 'flex', alignItems: 'center',
        gap: '10px', position: 'sticky', top: 0, zIndex: 100,
      }}>
        {back ? (
          <a href={back} style={{ fontSize: '13px', color: 'var(--blue)', textDecoration: 'none', flexShrink: 0 }}>←</a>
        ) : (
          <button onClick={() => setOpen(true)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px', display: 'flex', flexDirection: 'column',
            gap: '4px', flexShrink: 0,
          }}>
            <span style={{ display: 'block', width: '18px', height: '2px', background: 'var(--text)', borderRadius: '2px' }} />
            <span style={{ display: 'block', width: '18px', height: '2px', background: 'var(--text)', borderRadius: '2px' }} />
            <span style={{ display: 'block', width: '18px', height: '2px', background: 'var(--text)', borderRadius: '2px' }} />
          </button>
        )}
        <div style={{ fontSize: '15px', fontWeight: '700', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
      </div>

      {/* Overlay */}
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300,
        }} />
      )}

      {/* Sidebar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, height: '100vh', width: '260px',
        background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', zIndex: 400,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform .22s cubic-bezier(.4,0,.2,1)',
        overflowY: 'auto',
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700' }}>Hendren Custom Homes</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', marginTop: '2px' }}>Field Operations</div>
          </div>
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-muted)', padding: '4px' }}>✕</button>
        </div>

        <div style={{ padding: '8px 6px', flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px', borderRadius: '7px', textDecoration: 'none',
              fontSize: '13px', fontWeight: '500', marginBottom: '2px',
              background: pathname === item.href ? 'var(--border)' : 'transparent',
              color: pathname === item.href ? 'var(--text)' : 'var(--text-muted)',
            }}>
              <span style={{ fontSize: '14px', width: '18px', textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>
          Tim · PM
        </div>
      </div>
    </>
  )
}
