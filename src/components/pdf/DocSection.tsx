import type { ReactNode } from 'react'

type Props = {
  title: string
  subtotal?: string
  children?: ReactNode
}

export default function DocSection({ title, subtotal, children }: Props) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '12px',
          padding: '12px 16px',
          background: 'var(--surface-alt, var(--surface))',
          borderBottom: children ? '1px solid var(--border)' : undefined,
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {title}
        </span>
        {subtotal && (
          <span style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {subtotal}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
