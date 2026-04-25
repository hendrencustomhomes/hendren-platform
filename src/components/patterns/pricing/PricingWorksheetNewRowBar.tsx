import type { CatalogItem } from '@/lib/pricing/types'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

type Props = {
  canManage: boolean
  catalogItems?: CatalogItem[]
  newCatalogSku: string
  newDescription: string
  creatingRow: boolean
  onCatalogSkuChange: (value: string) => void
  onDescriptionChange: (value: string) => void
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
  catalogItems = [],
  newCatalogSku,
  newDescription,
  creatingRow,
  onCatalogSkuChange,
  onDescriptionChange,
  onKeyDown,
  onCreateRow,
}: Props) {
  return (
    <fieldset disabled={!canManage} style={fieldsetResetStyle}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr minmax(220px, 1fr) auto',
          overflowX: 'auto',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={cellWrapStyle}>
          <select value={newCatalogSku} onChange={(e) => onCatalogSkuChange(e.target.value)} onKeyDown={(e) => onKeyDown(e)} style={cellInputStyle}>
            <option value="">Catalog</option>
            {catalogItems.map((item) => (
              <option key={item.catalog_sku} value={item.catalog_sku}>
                {item.catalog_sku}
              </option>
            ))}
          </select>
        </div>
        <div style={cellWrapStyle}>
          <input
            value={newDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => onKeyDown(e, () => {
              void onCreateRow()
            })}
            placeholder="Description"
            style={cellInputStyle}
          />
        </div>
        <div style={{ ...cellWrapStyle, display: 'flex', alignItems: 'stretch', minWidth: '96px' }}>
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
            {creatingRow ? 'Creating…' : 'Create Row'}
          </button>
        </div>
      </div>
    </fieldset>
  )
}
