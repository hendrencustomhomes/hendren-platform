type Props = {
  generatedAt: string
  note?: string
}

export default function DocFooter({ generatedAt, note }: Props) {
  return (
    <div
      style={{
        fontSize: '11px',
        color: 'var(--text-muted)',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '4px',
        paddingLeft: '2px',
      }}
    >
      <span>Generated {generatedAt}</span>
      {note && <span>{note}</span>}
    </div>
  )
}
