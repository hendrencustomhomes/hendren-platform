import Link from 'next/link'

const MORE_ITEMS = [
  {
    href: '/more/clients',
    title: 'Clients',
    description: 'Manage the shared client list used across the platform.',
    icon: '👤',
  },
  {
    href: '/more/companies',
    title: 'Companies',
    description:
      'Manage company records, trades, compliance, and contact information.',
    icon: '🏢',
  },
  {
    href: '/more/internal-users',
    title: 'Internal Users',
    description:
      'Mirror and manage internal users, admin access, position, and contact details.',
    icon: '🧑‍💼',
  },
  {
    href: '/more/trades',
    title: 'Trades',
    description: 'Manage the shared trade list used across the platform.',
    icon: '🛠️',
  },
  {
    href: '/more/cost-codes',
    title: 'Cost Codes',
    description: 'Manage the centralized cost code list used across the platform.',
    icon: '🏷️',
  },
]

export default function MorePage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">More</h1>
        <p className="text-sm text-muted-foreground">
          Shared datasets and internal management tools for the Hendren Platform.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MORE_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl leading-none">{item.icon}</div>
              <div className="min-w-0 space-y-1">
                <div className="text-base font-medium text-foreground">
                  {item.title}
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}