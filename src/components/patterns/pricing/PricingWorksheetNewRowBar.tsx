type Props = {
  canManage: boolean
  onCreateRow: () => void
}

const fieldsetResetStyle = {
  border: 'none',
  padding: 0,
  margin: 0,
  minWidth: 0,
} as const

export function PricingWorksheetNewRowBar({ canManage, onCreateRow }: Props) {
  return (
    <fieldset disabled={!canManage} style={fieldsetResetStyle}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={onCreateRow}
          style={{
            background: 'transparent',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderBottom: 'none',
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Create Row
        </button>
      </div>
    </fieldset>
  )
}
