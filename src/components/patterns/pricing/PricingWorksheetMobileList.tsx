import type { PricingRow } from '@/lib/pricing-sources-types'
import { formatMoney } from '@/lib/shared/numbers'

type Props = {
  rows: PricingRow[]
  getRowStatusLabel: (rowId: string) => { text: string; tone: 'default' | 'active' | 'warning' | 'danger' }
}

export function PricingWorksheetMobileList({ rows, getRowStatusLabel }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {rows.map((row) => {
        const status = getRowStatusLabel(row.id)
        return (
          <div
            key={row.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '13px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ fontWeight: 700 }}>{row.source_sku}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{status.text}</div>
            </div>
            <div style={{ fontSize: '14px' }}>{row.description_snapshot}</div>
            <div style={{ color: 'var(--text-muted)' }}>{row.vendor_sku || '—'}</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '12px' }}>
              <span>{row.unit || '—'}</span>
              <span>{row.unit_price != null ? formatMoney(row.unit_price) : '—'}</span>
              <span>{row.lead_days ?? '—'} days</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
