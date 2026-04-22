type Props = {
  title: string
  right?: React.ReactNode
}

export function SectionHeader({ title, right }: Props) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
      }}
    >
      <span
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--text)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </span>
      {right && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {right}
        </div>
      )}
    </div>
  )
}
