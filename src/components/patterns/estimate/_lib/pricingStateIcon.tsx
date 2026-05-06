import type { JobWorksheetRow } from '../JobWorksheetTableAdapter'

export function fmt(v: number | null): string {
  return v != null ? `$${v.toFixed(2)}` : '—'
}

export function LinkIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }} aria-hidden="true">
      <path d="M6.5 9.5a3.5 3.5 0 0 0 4.95.5l2-2a3.5 3.5 0 0 0-4.95-4.95l-1 1" />
      <path d="M9.5 6.5a3.5 3.5 0 0 0-4.95-.5l-2 2a3.5 3.5 0 0 0 4.95 4.95l1-1" />
    </svg>
  )
}

export function PencilIcon() {
  return (
    <svg width={10} height={10} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }} aria-hidden="true">
      <path d="M11.5 2.5a1.5 1.5 0 0 1 2.12 2.12L5 13.25 3 13.5l.25-2L11.5 2.5z" />
    </svg>
  )
}

export function StaleSourceDot() {
  return (
    <svg width={6} height={6} viewBox="0 0 6 6" style={{ marginLeft: '1px', flexShrink: 0 }} aria-hidden="true">
      <circle cx="3" cy="3" r="3" fill="#ea580c" />
    </svg>
  )
}

export function PricingStateIcon({ row, isStale }: { row: JobWorksheetRow; isStale: boolean }) {
  const isLinked = row.pricing_source_row_id !== null
  const isOverridden = row.unit_cost_is_overridden

  if (!isLinked && !isOverridden) return null

  const sku = row.source_sku ?? row.catalog_sku ?? ''
  const skuPart = sku ? ` · ${sku}` : ''
  const staleSuffix = isStale ? ' · source price updated' : ''

  const title = isOverridden
    ? `Override active · source ${fmt(row.unit_cost_source)} → ${fmt(row.unit_cost_override)}${skuPart}${staleSuffix}`
    : `Linked · source ${fmt(row.unit_cost_source)}${skuPart}${staleSuffix}`

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        color: isOverridden ? '#d97706' : '#2563eb',
        cursor: 'default',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <LinkIcon />
      {isOverridden && <PencilIcon />}
      {isStale && <StaleSourceDot />}
    </span>
  )
}
