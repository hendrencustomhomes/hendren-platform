'use client'

import Link from 'next/link'

const MORE_ITEMS = [
  {
    href: '/more/clients',
    label: 'Clients',
    icon: '👤',
    description: 'Manage shared client records',
  },
  {
    href: '/more/companies',
    label: 'Companies',
    icon: '🏢',
    description: 'Manage companies, trades, compliance, and contacts',
  },
  {
    href: '/more/internal-users',
    label: 'Internal Users',
    icon: '👥',
    description: 'Manage internal users, admin access, and contact fields',
  },
  {
    href: '/more/trades',
    label: 'Trades',
    icon: '🛠️',
    description: 'Manage the shared trade list',
  },
  {
    href: '/more/cost-codes',
    label: 'Cost Codes',
    icon: '🏷️',
    description: 'Manage the shared cost code list',
  },
]

export default function MorePage() {
  return (
    <div
      style={{
        padding: '16px',
        display: 'grid',
        gap: '12px',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '14px',
        }}
      >
        <div
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '4px',
          }}
        >
          More
        </div>
        <div
          style={{
            fontSize: '13px',
            color: 'var(--text-muted)',
            lineHeight: 1.45,
          }}
        >
          Shared datasets and internal management tools for the Hendren Platform.
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '10px',
        }}
      >
        {MORE_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </div>

              <div
                style={{
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--text)',
                    marginBottom: '2px',
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    lineHeight: 1.4,
                  }}
                >
                  {item.description}
                </div>
              </div>

              <div
                style={{
                  fontSize: '18px',
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                }}
              >
                ›
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}