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

type NavProps = {
  title: string
  back?: string
  jobId?: string
}

export default function Nav({ title, back, jobId }: NavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  function isActive(item: (typeof NAV_ITEMS)[number]) {
    if (item.exact) return pathname === item.href
    return item.href !== '/' && pathname.startsWith(item.href)
  }

  const jobLinks = jobId
    ? [
        { href: `/jobs/${jobId}`, label: 'Job' },
        { href: `/schedule?job=${jobId}`, label: 'Schedule' },
      ]
    : []

  return (
    <>
      <div
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {back ? (
          <a
            href={back}
            style={{
              fontSize: '20px',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            ‹
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              marginLeft: '-4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              flexShrink: 0,
              minWidth: '36px',
              minHeight: '36px',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            aria-label="Open navigation"
          >
            <span
              style={{
                display: 'block',
                width: '20px',
                height: '2px',
                background: 'var(--text)',
                borderRadius: '2px',
              }}
            />
            <span
              style={{
                display: 'block',
                width: '20px',
                height: '2px',
                background: 'var(--text)',
                borderRadius: '2px',
              }}
            />
            <span
              style={{
                display: 'block',
                width: '20px',
                height: '2px',
                background: 'var(--text)',
                borderRadius: '2px',
              }}
            />
          </button>
        )}

        <div
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
        </div>

        {jobLinks.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            {jobLinks.map((link) => {
              const active =
                pathname === link.href ||
                (link.href.includes('/schedule') && pathname.startsWith('/schedule'))

              return (
                <a
                  key={link.href}
                  href={link.href}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '5px 10px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    background: active ? 'var(--border)' : 'transparent',
                    border: `1px solid ${active ? 'var(--border)' : 'transparent'}`,
                    color: active ? 'var(--text)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {link.label}
                </a>
              )
            })}
          </div>
        )}
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 300,
          }}
        />
      )}

      <div
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          width: '280px',
          maxWidth: '84vw',
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 400,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform .22s cubic-bezier(.4,0,.2,1)',
          overflow: 'hidden',
        }}
      >
        <div>
          <div
            style={{
              padding: '16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                Hendren Custom Homes
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontFamily: 'ui-monospace,monospace',
                  marginTop: '2px',
                }}
              >
                Field Operations Platform
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: 'var(--text-muted)',
                padding: '4px',
              }}
              aria-label="Close navigation"
            >
              ✕
            </button>
          </div>

          <div style={{ padding: '10px 8px 0 8px' }}>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item)

              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '11px 12px',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '4px',
                    background: active ? 'var(--border)' : 'transparent',
                    color: active ? 'var(--text)' : 'var(--text-muted)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '15px',
                      width: '20px',
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </a>
              )
            })}
          </div>
        </div>

        <div
          style={{
            padding: '12px 16px 24px 16px',
            borderTop: '1px solid var(--border)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            fontFamily: 'ui-monospace,monospace',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <span>Hendren · Internal</span>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontFamily: 'ui-monospace,monospace',
              padding: 0,
              whiteSpace: 'nowrap',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </>
  )
}
