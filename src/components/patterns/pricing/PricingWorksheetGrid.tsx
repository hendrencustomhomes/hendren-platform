import type { PricingRow } from '@/lib/pricing-sources-types'

type Props = {
  rows: PricingRow[]
}

export function PricingWorksheetGrid({ rows }: Props) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '8px' }}>Label</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>Qty</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>Unit</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px' }}>{row.label}</td>
              <td style={{ padding: '8px' }}>{row.qty}</td>
              <td style={{ padding: '8px' }}>{row.unit}</td>
              <td style={{ padding: '8px' }}>{row.unit_cost}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
