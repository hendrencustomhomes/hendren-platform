export type DocTotalsRow = {
  label: string
  value: string
  bold?: boolean
}

type Props = {
  rows: DocTotalsRow[]
}

export default function DocTotalsBlock({ rows }: Props) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '10px 16px',
            borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : undefined,
            fontWeight: row.bold ? 700 : 400,
            fontSize: row.bold ? '14px' : '13px',
          }}
        >
          <span>{row.label}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
        </div>
      ))}
    </div>
  )
}
