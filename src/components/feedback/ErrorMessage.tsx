type Props = {
  error: string | null | undefined
  padding?: string | number
}

export function ErrorMessage({ error, padding }: Props) {
  if (!error) return null
  return (
    <div style={{ fontSize: '13px', color: 'var(--red)', ...(padding ? { padding } : {}) }}>
      {error}
    </div>
  )
}
