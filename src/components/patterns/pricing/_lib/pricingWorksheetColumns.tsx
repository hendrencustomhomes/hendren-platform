import type { EditableDataTableColumn } from '@/components/data-display/EditableDataTable'
import { formatMoney } from '@/lib/shared/numbers'
import type { PricingRow } from '@/lib/pricing/types'

export type PricingWorksheetEditableCellKey =
  | 'description_snapshot'
  | 'vendor_sku'
  | 'pricing_type'
  | 'quantity'
  | 'unit'
  | 'unit_price'
  | 'lead_days'
  | 'is_active'
  | 'notes'

export function getPricingWorksheetColumns({
  costCodeMap,
  getRowStatusLabel,
}: {
  costCodeMap: Map<string, string>
  getRowStatusLabel: (rowId: string) => { text: string; tone: 'default' | 'active' | 'warning' | 'danger' }
}): EditableDataTableColumn<PricingRow>[] {
  return [
    {
      key: 'source_sku',
      label: 'Source SKU',
      kind: 'static',
      width: '140px',
      renderStaticCell: (row) => {
        const rowStatus = getRowStatusLabel(row.id)
        return (
          <>
            <div style={{ padding: '8px', fontSize: '13px', whiteSpace: 'nowrap', fontWeight: 700 }}>
              {row.source_sku}
            </div>
            <div style={{ padding: '0 8px 8px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {rowStatus.text}
            </div>
          </>
        )
      },
    },
    {
      key: 'catalog_sku',
      label: 'Catalog',
      kind: 'static',
      width: '120px',
      renderStaticCell: (row) => (
        <div style={{ padding: '8px', fontSize: '13px', whiteSpace: 'nowrap' }}>
          {row.catalog_sku || 'Not Linked'}
        </div>
      ),
    },
    { key: 'description_snapshot', label: 'Description', kind: 'text', width: '280px' },
    { key: 'vendor_sku', label: 'Vendor SKU', kind: 'text', width: '160px' },
    { key: 'pricing_type', label: 'Type', kind: 'text', width: '120px' },
    { key: 'quantity', label: 'Quantity', kind: 'text', width: '100px', inputMode: 'decimal' },
    { key: 'unit', label: 'Unit', kind: 'text', width: '100px' },
    {
      key: 'unit_price',
      label: 'Unit Price',
      kind: 'text',
      width: '120px',
      inputMode: 'decimal',
      formatEditableValue: (value, _row, isEditing) => {
        if (isEditing) return String(value ?? '')
        if (value == null || value === '') return ''
        const parsed = typeof value === 'number' ? value : Number(value)
        return Number.isFinite(parsed) ? formatMoney(parsed) : String(value)
      },
    },
    { key: 'lead_days', label: 'Lead Days', kind: 'text', width: '110px', inputMode: 'numeric' },
    { key: 'is_active', label: 'Active', kind: 'checkbox', width: '80px' },
    { key: 'notes', label: 'Notes', kind: 'textarea', width: '220px', textAreaRows: 1 },
    {
      key: 'cost_code_id',
      label: 'Cost Code',
      kind: 'static',
      width: '180px',
      renderStaticCell: (row) => (
        <div style={{ padding: '8px', fontSize: '13px', whiteSpace: 'nowrap' }}>
          {costCodeMap.get(row.cost_code_id) ?? '—'}
        </div>
      ),
    },
  ]
}
