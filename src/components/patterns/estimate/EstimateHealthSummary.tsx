'use client'

import type { JobWorksheetRow } from './JobWorksheetTableAdapter'

type HealthCounts = {
  total: number
  linked: number
  unpriced: number
  missingQty: number
  excluded: number
}

function computeHealth(rows: JobWorksheetRow[]): HealthCounts {
  const live = rows.filter((r) => !r.id.startsWith('draft_'))
  const priceable = live.filter((r) => r.row_kind !== 'note')

  return {
    total: live.length,
    linked: live.filter((r) => r.pricing_source_row_id !== null).length,
    unpriced: priceable.filter((r) => r.pricing_type === 'unpriced').length,
    missingQty: priceable.filter((r) => {
      const q = Number(r.quantity)
      return r.quantity == null || r.quantity === '' || Number.isNaN(q) || q === 0
    }).length,
    excluded: live.filter((r) => r.scope_status === 'excluded').length,
  }
}

type Pill = { label: string; warn: boolean }

export function EstimateHealthSummary({ rows }: { rows: JobWorksheetRow[] }) {
  const h = computeHealth(rows)

  if (h.total === 0) return null

  const pills: Pill[] = [
    { label: `${h.total} rows`, warn: false },
    { label: `${h.linked} linked`, warn: false },
    ...(h.unpriced > 0 ? [{ label: `${h.unpriced} unpriced`, warn: true }] : []),
    ...(h.missingQty > 0 ? [{ label: `${h.missingQty} no qty`, warn: true }] : []),
    ...(h.excluded > 0 ? [{ label: `${h.excluded} excluded`, warn: false }] : []),
  ]

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
      {pills.map((pill) => (
        <span
          key={pill.label}
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '20px',
            background: pill.warn ? 'rgba(220,38,38,.08)' : 'var(--bg)',
            color: pill.warn ? '#b91c1c' : 'var(--text-muted)',
            border: `1px solid ${pill.warn ? 'rgba(220,38,38,.2)' : 'var(--border)'}`,
            whiteSpace: 'nowrap',
          }}
        >
          {pill.label}
        </span>
      ))}
    </div>
  )
}
