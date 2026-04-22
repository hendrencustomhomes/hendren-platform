import type { PricingRow } from '@/lib/pricing-sources-types'

type Props = {
  rows: PricingRow[]
}

export function PricingWorksheetMobileList({ rows }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
      {rows.map((row) => (
        <div
          key={row.id}
          style={{
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '10px',
            fontSize: '13px',
          }}
        >
          <div style={{ fontWeight: 600 }}>{row.label}</div>
          <div style={{ color: 'var(--text-muted)' }}>
            {row.qty} {row.unit} × {row.unit_cost}
          </div>
        </div>
      ))}
    </div>
  )
}
