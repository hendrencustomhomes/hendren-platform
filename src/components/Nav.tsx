'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '📊', exact: true },
  { href: '/schedule', label: 'Schedule', icon: '📅', exact: false },
  { href: '/jobs', label: 'Jobs', icon: '🏠', exact: false },
  { href: '/more', label: 'More', icon: '⋯', exact: false },
]

export default function Nav({ title, back, jobId }: any) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  function isActive(item: any) {
    if (item.exact) return pathname === item.href
    return item.href !== '/' && pathname.startsWith(item.href)
  }

  return (
    <>
      <div style={{ padding: 12, borderBottom: '1px solid #333', display: 'flex' }}>
        {!back && (
          <button onClick={() => setOpen(true)} style={{ marginRight: 10 }}>☰</button>
        )}
        <div>{title}</div>
      </div>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      )}

      <div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          height: '100vh',
          width: 260,
          background: '#111',
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: '0.2s',
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} style={{ display: 'block', padding: 12 }}>
              {item.label}
            </a>
          ))}
        </div>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            padding: 12,
            borderTop: '1px solid #333',
            background: '#111',
          }}
        >
          <button onClick={handleLogout}>Sign out</button>
        </div>
      </div>
    </>
  )
}
