type Tone = 'default' | 'active' | 'warning' | 'danger'

type Props = {
  text: string
  tone?: Tone
}

export function StatusPill({ text, tone = 'default' }: Props) {
  const color =
    tone === 'active'
      ? 'var(--blue)'
      : tone === 'warning'
        ? '#fbbf24'
        : tone === 'danger'
          ? '#fca5a5'
          : 'var(--text-muted)'

  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        color,
        border: '1px solid var(--border)',
        borderRadius: '999px',
        padding: '2px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  )
}
