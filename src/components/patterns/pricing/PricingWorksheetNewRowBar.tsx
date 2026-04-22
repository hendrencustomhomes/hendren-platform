import type { CatalogItem } from '@/lib/pricing-sources-types'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

type Props = {
  canManage: boolean
  catalogItems: CatalogItem[]
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
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '8px 10px',
  color: 'var(--text)',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box' as const,
} as const

export function PricingWorksheetNewRowBar({
  canManage,
  catalogItems,
  newCatalogSku,
  newDescription,
  newVendorSku,
  newUnit,
  newUnitPrice,
  newLeadDays,
  newNotes,
  creatingRow,
  onCatalogSkuChange,
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
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, 1.2fr) repeat(6, minmax(110px, 1fr))',
          gap: '8px',
          overflowX: 'auto',
        }}
      >
        <select
          value={newCatalogSku}
          onChange={(e) => onCatalogSkuChange(e.target.value)}
          onKeyDown={(e) => onKeyDown(e)}
          style={cellInputStyle}
        >
          <option value="">Optional catalog link</option>
          {catalogItems.map((item) => (
            <option key={item.catalog_sku} value={item.catalog_sku}>
              {item.catalog_sku} · {item.title}
            </option>
          ))}
        </select>
        <input
          value={newDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => onKeyDown(e)}
          placeholder="Description"
          style={cellInputStyle}
        />
        <input
          value={newVendorSku}
          onChange={(e) => onVendorSkuChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => onKeyDown(e)}
          placeholder="Vendor SKU"
          style={cellInputStyle}
        />
        <input
          value={newUnit}
          onChange={(e) => onUnitChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => onKeyDown(e)}
          placeholder="Unit"
          style={cellInputStyle}
        />
        <input
          value={newUnitPrice}
          onChange={(e) => onUnitPriceChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => onKeyDown(e)}
          inputMode="decimal"
          placeholder="Unit price"
          style={cellInputStyle}
        />
        <input
          value={newLeadDays}
          onChange={(e) => onLeadDaysChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => onKeyDown(e)}
          inputMode="numeric"
          placeholder="Lead days"
          style={cellInputStyle}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
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
          <button
            type="button"
            onClick={() => void onCreateRow()}
            disabled={creatingRow}
            style={{
              background: 'var(--text)',
              color: 'var(--surface)',
              border: 'none',
              borderRadius: '8px',
              padding: '0 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: creatingRow ? 'not-allowed' : 'pointer',
              opacity: creatingRow ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {creatingRow ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </fieldset>
  )
}
