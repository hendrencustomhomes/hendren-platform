type Props = {
  message: string
  detail?: string
  padding?: string | number
}

export function EmptyState({ message, detail, padding = '16px' }: Props) {
  return (
    <div style={{ padding, fontSize: '13px', color: 'var(--text-muted)' }}>
      <div>{message}</div>
      {detail && <div style={{ marginTop: '6px', fontSize: '12px' }}>{detail}</div>}
    </div>
  )
}
