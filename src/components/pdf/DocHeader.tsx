type MetaItem = {
  label?: string
  value: string
  badge?: { bg: string; color: string }
}

type Props = {
  title: string
  subtitle?: string
  meta?: MetaItem[]
  totalLabel?: string
  totalValue?: string
}

export type { MetaItem }

export default function DocHeader({ title, subtitle, meta, totalLabel, totalValue }: Props) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{subtitle}</div>
          )}
          {meta && meta.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              {meta.map((item, i) =>
                item.badge ? (
                  <span
                    key={i}
                    style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      background: item.badge.bg,
                      color: item.badge.color,
                    }}
                  >
                    {item.value}
                  </span>
                ) : (
                  <span key={i} style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {item.label ? `${item.label}: ` : ''}{item.value}
                  </span>
                )
              )}
            </div>
          )}
        </div>
        {totalValue && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {totalLabel && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>{totalLabel}</div>
            )}
            <div style={{ fontSize: '24px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{totalValue}</div>
          </div>
        )}
      </div>
    </div>
  )
}
