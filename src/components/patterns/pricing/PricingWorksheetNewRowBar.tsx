import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

type Props = {
  canManage: boolean
  newCatalogSku: string
  newDescription: string
  newVendorSku: string
  newUnit: string
  newUnitPrice: string
  newLeadDays: string
  newNotes: string
  creatingRow: boolean
  onCatalogSkuChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onVendorSkuChange: (value: string) => void
  onUnitChange: (value: string) => void
  onUnitPriceChange: (value: string) => void
  onLeadDaysChange: (value: string) => void
  onNotesChange: (value: string) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>, onCommit?: () => void) => void
  onCreateRow: () => void | Promise<unknown>
}

const fieldsetResetStyle = {
  border: 'none',
  padding: 0,
  margin: 0,
  minWidth: 0,
} as const

const cellInputStyle = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  padding: '6px 8px',
  color: 'var(--text)',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box' as const,
} as const

const cellWrapStyle = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  minWidth: 0,
} as const

export function PricingWorksheetNewRowBar({
  canManage,
  newDescription,
  newVendorSku,
  newUnit,
  newUnitPrice,
  newLeadDays,
  newNotes,
  creatingRow,
  onDescriptionChange,
  onVendorSkuChange,
  onUnitChange,
  onUnitPriceChange,
  onLeadDaysChange,
  onNotesChange,
  onKeyDown,
  onCreateRow,
}: Props) {
  return (
    <fieldset disabled={!canManage} style={fieldsetResetStyle}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2.2fr 1.2fr 0.8fr 0.9fr 0.9fr 1.5fr auto',
          overflowX: 'auto',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={cellWrapStyle}>
          <input
            value={newDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => onKeyDown(e)}
            placeholder="Description"
            style={cellInputStyle}
          />
        </div>
        <div style={cellWrapStyle}>
          <input
            value={newVendorSku}
            onChange={(e) => onVendorSkuChange(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => onKeyDown(e)}
            placeholder="Vendor SKU"
            style={cellInputStyle}
          />
        </div>
        <div style={cellWrapStyle}>
          <input
            value={newUnit}
            onChange={(e) => onUnitChange(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => onKeyDown(e)}
            placeholder="Unit"
            style={cellInputStyle}
          />
        </div>
        <div style={cellWrapStyle}>
          <input
            value={newUnitPrice}
            onChange={(e) => onUnitPriceChange(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => onKeyDown(e)}
            inputMode="decimal"
            placeholder="Unit price"
            style={cellInputStyle}
          />
        </div>
        <div style={cellWrapStyle}>
          <input
            value={newLeadDays}
            onChange={(e) => onLeadDaysChange(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => onKeyDown(e)}
            inputMode="numeric"
            placeholder="Lead days"
            style={cellInputStyle}
          />
        </div>
        <div style={cellWrapStyle}>
          <input
            value={newNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) =>
              onKeyDown(e, () => {
                void onCreateRow()
              })
            }
            placeholder="Notes"
            style={cellInputStyle}
          />
        </div>
        <div
          style={{
            ...cellWrapStyle,
            display: 'flex',
            alignItems: 'stretch',
            minWidth: '72px',
          }}
        >
          <button
            type="button"
            onClick={() => void onCreateRow()}
            disabled={creatingRow}
            style={{
              background: 'transparent',
              color: 'var(--text)',
              border: 'none',
              width: '100%',
              fontSize: '12px',
              fontWeight: 700,
              cursor: creatingRow ? 'not-allowed' : 'pointer',
              opacity: creatingRow ? 0.7 : 1,
            }}
          >
            {creatingRow ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </fieldset>
  )
}
