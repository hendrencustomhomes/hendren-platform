type Props = {
  children: React.ReactNode
}

export function Card({ children }: Props) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '18px',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}
