'use client'

type Props = {
  label?: string
}

export default function PrintButton({ label = 'Print / Save as PDF' }: Props) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="doc-no-print"
      style={{
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)',
        borderRadius: '8px',
        padding: '6px 12px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
