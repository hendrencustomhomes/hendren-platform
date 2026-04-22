type Props = {
  message?: string
  padding?: string | number
}

export function LoadingState({ message = 'Loading…', padding = '16px' }: Props) {
  return (
    <div style={{ padding, fontSize: '13px', color: 'var(--text-muted)' }}>
      {message}
    </div>
  )
}
