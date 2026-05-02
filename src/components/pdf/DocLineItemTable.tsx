export type DocLineItemRow = {
  id: string
  depth: number
  description: string
  qty?: string
  unitPrice?: string
  total?: string
  isNote?: boolean
}

type Props = {
  rows: DocLineItemRow[]
  indentPerDepth?: number
}

export default function DocLineItemTable({ rows, indentPerDepth = 16 }: Props) {
  if (rows.length === 0) return null

  const colGrid = '1fr 100px 80px 90px'

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: colGrid,
          gap: '8px',
          padding: '5px 16px',
          fontSize: '10px',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span>Description</span>
        <span style={{ textAlign: 'right' }}>Qty / Unit</span>
        <span style={{ textAlign: 'right' }}>Unit Price</span>
        <span style={{ textAlign: 'right' }}>Total</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          style={{
            display: 'grid',
            gridTemplateColumns: colGrid,
            gap: '8px',
            padding: '7px 16px',
            fontSize: '12px',
            borderBottom: '1px solid var(--border)',
            alignItems: 'baseline',
            color: row.isNote ? 'var(--text-muted)' : 'var(--text)',
          }}
        >
          <span
            style={{
              paddingLeft: `${row.depth * indentPerDepth}px`,
              fontStyle: row.isNote ? 'italic' : undefined,
            }}
          >
            {row.description}
          </span>
          <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>{row.qty ?? ''}</span>
          <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>
            {row.isNote ? '' : (row.unitPrice ?? '')}
          </span>
          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {row.isNote ? '' : (row.total ?? '')}
          </span>
        </div>
      ))}
    </>
  )
}
