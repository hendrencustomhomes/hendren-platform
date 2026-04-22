type Props = {
  newRow: {
    label: string
    qty: string
    unit: string
    unit_cost: string
  }
  onChange: (field: string, value: string) => void
  onAdd: () => void
}

const inputStyle = {
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '6px 8px',
  fontSize: '13px',
} as const

export function PricingWorksheetNewRowBar({ newRow, onChange, onAdd }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
      }}
    >
      <input
        placeholder="Label"
        value={newRow.label}
        onChange={(e) => onChange('label', e.target.value)}
        style={{ ...inputStyle, flex: '2 1 200px' }}
      />
      <input
        placeholder="Qty"
        value={newRow.qty}
        onChange={(e) => onChange('qty', e.target.value)}
        style={{ ...inputStyle, width: '80px' }}
      />
      <input
        placeholder="Unit"
        value={newRow.unit}
        onChange={(e) => onChange('unit', e.target.value)}
        style={{ ...inputStyle, width: '80px' }}
      />
      <input
        placeholder="Cost"
        value={newRow.unit_cost}
        onChange={(e) => onChange('unit_cost', e.target.value)}
        style={{ ...inputStyle, width: '100px' }}
      />
      <button
        onClick={onAdd}
        style={{
          background: 'var(--text)',
          color: 'var(--surface)',
          border: 'none',
          borderRadius: '8px',
          padding: '6px 12px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Add
      </button>
    </div>
  )
}
