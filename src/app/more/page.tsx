import Link from 'next/link'
import Nav from '@/components/Nav'

const MORE_ITEMS = [
  { href: '/more/clients', label: 'Clients', icon: '👤' },
  { href: '/more/companies', label: 'Companies', icon: '🏢' },
  { href: '/more/price-sheets', label: 'Price Sheets', icon: '💵' },
  { href: '/more/catalog', label: 'Catalog', icon: '📦' },
  { href: '/more/internal-users', label: 'Internal Users', icon: '👥' },
  { href: '/more/trades', label: 'Trades', icon: '🛠️' },
  { href: '/more/cost-codes', label: 'Cost Codes', icon: '🏷️' },
]

export default function MorePage() {
  return (
    <>
      <Nav title="More" />

      <div style={{ padding: '16px' }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '18px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '18px 18px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text)',
              }}
            >
              Data & Settings
            </div>
          </div>

          <div>
            {MORE_ITEMS.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                  borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      textAlign: 'center',
                      fontSize: '18px',
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </div>

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: '16px',
                      fontWeight: 700,
                      color: 'var(--text)',
                    }}
                  >
                    {item.label}
                  </div>

                  <div
                    style={{
                      fontSize: '20px',
                      color: 'var(--text-muted)',
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    ›
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
