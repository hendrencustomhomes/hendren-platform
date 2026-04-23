import type { Dispatch, KeyboardEvent as ReactKeyboardEvent, MutableRefObject, SetStateAction } from 'react'
import type { PricingRow } from '@/lib/pricing/types'
import { formatMoney } from '@/lib/shared/numbers'

type EditableCellKey =
  | 'description_snapshot'
  | 'vendor_sku'
  | 'unit'
  | 'unit_price'
  | 'lead_days'
  | 'is_active'
  | 'notes'

type CellDraftValue = string | boolean

type ActiveCell = {
  rowId: string
  field: EditableCellKey
}

type DesktopVisibleRange = {
  rows: PricingRow[]
  startIndex: number
  endIndex: number
  topSpacerHeight: number
  bottomSpacerHeight: number
}

type Props = {
  canManage: boolean
  shouldVirtualize: boolean
  tableScrollContainerRef: MutableRefObject<HTMLDivElement | null>
  desktopVisibleRange: DesktopVisibleRange
  costCodeMap: Map<string, string>
  activeCell: ActiveCell | null
  activeDraft: CellDraftValue | null
  cellRefs: MutableRefObject<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>
  onTableScrollTopChange: Dispatch<SetStateAction<number>>
  onTextCellFocus: (
    rowId: string,
    field: Exclude<EditableCellKey, 'is_active'>,
    element: HTMLInputElement | HTMLTextAreaElement
  ) => void
  onTextCellBlur: (rowId: string, field: Exclude<EditableCellKey, 'is_active'>) => void
  onTextCellKeyDown: (
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    rowId: string,
    field: Exclude<EditableCellKey, 'is_active'>
  ) => void
  onTextCellDraftChange: (value: string) => void
  onCheckboxFocus: (rowId: string) => void
  onCheckboxBlur: (rowId: string) => void
  onCheckboxKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>, rowId: string) => void
  onCheckboxCommit: (rowId: string, nextValue: boolean) => void
  getRenderedCellValue: (row: PricingRow, field: EditableCellKey) => CellDraftValue
  getRowStatusLabel: (rowId: string) => { text: string; tone: 'default' | 'active' | 'warning' | 'danger' }
}

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

const fieldsetResetStyle = {
  border: 'none',
  padding: 0,
  margin: 0,
  minWidth: 0,
} as const

const tableCellStyle = {
  border: '1px solid var(--border)',
  padding: 0,
  verticalAlign: 'middle' as const,
  background: 'var(--surface)',
} as const

const headerCellStyle = {
  border: '1px solid var(--border)',
  textAlign: 'left' as const,
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '.04em',
  color: 'var(--text-muted)',
  padding: '8px',
  whiteSpace: 'nowrap' as const,
  position: 'sticky' as const,
  top: 0,
  background: 'var(--surface)',
  zIndex: 1,
} as const

const staticCellStyle = {
  padding: '8px',
  fontSize: '13px',
  whiteSpace: 'nowrap' as const,
} as const

const virtualMaxBodyHeight = 560

function getCellDomKey(rowId: string, field: EditableCellKey) {
  return `${rowId}:${field}`
}

function isFullySelected(element: HTMLInputElement | HTMLTextAreaElement) {
  const valueLength = element.value.length
  return (element.selectionStart ?? 0) === 0 && (element.selectionEnd ?? 0) === valueLength
}

export function PricingWorksheetGrid({
  canManage,
  shouldVirtualize,
  tableScrollContainerRef,
  desktopVisibleRange,
  costCodeMap,
  activeCell,
  activeDraft,
  cellRefs,
  onTableScrollTopChange,
  onTextCellFocus,
  onTextCellBlur,
  onTextCellKeyDown,
  onTextCellDraftChange,
  onCheckboxFocus,
  onCheckboxBlur,
  onCheckboxKeyDown,
  onCheckboxCommit,
  getRenderedCellValue,
  getRowStatusLabel,
}: Props) {
  return (
    <fieldset disabled={!canManage} style={fieldsetResetStyle}>
      <div style={{ overflowX: 'auto' }}>
        <div
          ref={tableScrollContainerRef}
          onScroll={(event) => {
            if (!shouldVirtualize) return
            onTableScrollTopChange(event.currentTarget.scrollTop)
          }}
          style={{
            overflowY: shouldVirtualize ? 'auto' : 'visible',
            maxHeight: shouldVirtualize ? `${virtualMaxBodyHeight}px` : undefined,
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1180px' }}>
            <thead>
              <tr>
                {[
                  'Source SKU',
                  'Catalog',
                  'Description',
                  'Vendor SKU',
                  'Unit',
                  'Unit Price',
                  'Lead Days',
                  'Active',
                  'Notes',
                  'Cost Code',
                ].map((label) => (
                  <th key={label} style={headerCellStyle}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shouldVirtualize && desktopVisibleRange.topSpacerHeight > 0 ? (
                <tr aria-hidden="true">
                  <td
                    colSpan={10}
                    style={{ padding: 0, height: `${desktopVisibleRange.topSpacerHeight}px`, border: 'none' }}
                  />
                </tr>
              ) : null}

              {desktopVisibleRange.rows.map((row) => {
                const rowStatus = getRowStatusLabel(row.id)
                return (
                  <tr key={row.id} style={{ height: '52px' }}>
                    <td style={tableCellStyle}>
                      <div style={{ ...staticCellStyle, fontWeight: 700 }}>{row.source_sku}</div>
                      <div
                        style={{
                          padding: '0 8px 8px',
                          fontSize: '11px',
                          color: rowStatus.tone === 'danger' ? '#fca5a5' : 'var(--text-muted)',
                        }}
                      >
                        {rowStatus.text}
                      </div>
                    </td>
                    <td style={tableCellStyle}>
                      <div style={staticCellStyle}>{row.catalog_sku || 'Not Linked'}</div>
                    </td>
                    <td style={tableCellStyle}>
                      <input
                        ref={(element) => {
                          cellRefs.current[getCellDomKey(row.id, 'description_snapshot')] = element
                        }}
                        value={String(getRenderedCellValue(row, 'description_snapshot'))}
                        onFocus={(e) => onTextCellFocus(row.id, 'description_snapshot', e.currentTarget)}
                        onChange={(e) => onTextCellDraftChange(e.target.value)}
                        onBlur={() => onTextCellBlur(row.id, 'description_snapshot')}
                        onKeyDown={(e) => {
                          if (e.key.startsWith('Arrow') && isFullySelected(e.currentTarget)) return
                          onTextCellKeyDown(e, row.id, 'description_snapshot')
                        }}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <input
                        ref={(element) => {
                          cellRefs.current[getCellDomKey(row.id, 'vendor_sku')] = element
                        }}
                        value={String(getRenderedCellValue(row, 'vendor_sku'))}
                        onFocus={(e) => onTextCellFocus(row.id, 'vendor_sku', e.currentTarget)}
                        onChange={(e) => onTextCellDraftChange(e.target.value)}
                        onBlur={() => onTextCellBlur(row.id, 'vendor_sku')}
                        onKeyDown={(e) => {
                          if (e.key.startsWith('Arrow') && isFullySelected(e.currentTarget)) return
                          onTextCellKeyDown(e, row.id, 'vendor_sku')
                        }}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <input
                        ref={(element) => {
                          cellRefs.current[getCellDomKey(row.id, 'unit')] = element
                        }}
                        value={String(getRenderedCellValue(row, 'unit'))}
                        onFocus={(e) => onTextCellFocus(row.id, 'unit', e.currentTarget)}
                        onChange={(e) => onTextCellDraftChange(e.target.value)}
                        onBlur={() => onTextCellBlur(row.id, 'unit')}
                        onKeyDown={(e) => {
                          if (e.key.startsWith('Arrow') && isFullySelected(e.currentTarget)) return
                          onTextCellKeyDown(e, row.id, 'unit')
                        }}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <input
                        ref={(element) => {
                          cellRefs.current[getCellDomKey(row.id, 'unit_price')] = element
                        }}
                        value={
                          activeCell?.rowId === row.id && activeCell.field === 'unit_price'
                            ? String(activeDraft ?? '')
                            : row.unit_price != null
                              ? formatMoney(row.unit_price)
                              : ''
                        }
                        onFocus={(e) => onTextCellFocus(row.id, 'unit_price', e.currentTarget)}
                        onChange={(e) => onTextCellDraftChange(e.target.value)}
                        onBlur={() => onTextCellBlur(row.id, 'unit_price')}
                        onKeyDown={(e) => {
                          if (e.key.startsWith('Arrow') && isFullySelected(e.currentTarget)) return
                          onTextCellKeyDown(e, row.id, 'unit_price')
                        }}
                        inputMode="decimal"
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <input
                        ref={(element) => {
                          cellRefs.current[getCellDomKey(row.id, 'lead_days')] = element
                        }}
                        value={String(getRenderedCellValue(row, 'lead_days'))}
                        onFocus={(e) => onTextCellFocus(row.id, 'lead_days', e.currentTarget)}
                        onChange={(e) => onTextCellDraftChange(e.target.value)}
                        onBlur={() => onTextCellBlur(row.id, 'lead_days')}
                        onKeyDown={(e) => {
                          if (e.key.startsWith('Arrow') && isFullySelected(e.currentTarget)) return
                          onTextCellKeyDown(e, row.id, 'lead_days')
                        }}
                        inputMode="numeric"
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <label style={{ display: 'flex', justifyContent: 'center', padding: '8px', cursor: 'pointer' }}>
                        <input
                          ref={(element) => {
                            cellRefs.current[getCellDomKey(row.id, 'is_active')] = element
                          }}
                          type="checkbox"
                          checked={Boolean(getRenderedCellValue(row, 'is_active'))}
                          onFocus={() => onCheckboxFocus(row.id)}
                          onChange={(e) => onCheckboxCommit(row.id, e.target.checked)}
                          onBlur={() => onCheckboxBlur(row.id)}
                          onKeyDown={(e) => onCheckboxKeyDown(e, row.id)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                      </label>
                    </td>
                    <td style={tableCellStyle}>
                      <textarea
                        ref={(element) => {
                          cellRefs.current[getCellDomKey(row.id, 'notes')] = element
                        }}
                        value={String(getRenderedCellValue(row, 'notes'))}
                        onFocus={(e) => onTextCellFocus(row.id, 'notes', e.currentTarget)}
                        onChange={(e) => onTextCellDraftChange(e.target.value)}
                        onBlur={() => onTextCellBlur(row.id, 'notes')}
                        onKeyDown={(e) => {
                          if (e.key.startsWith('Arrow') && isFullySelected(e.currentTarget)) return
                          onTextCellKeyDown(e, row.id, 'notes')
                        }}
                        rows={1}
                        style={{ ...cellInputStyle, resize: 'none', height: '34px', minHeight: '34px' }}
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <div style={staticCellStyle}>{costCodeMap.get(row.cost_code_id) ?? '—'}</div>
                    </td>
                  </tr>
                )
              })}

              {shouldVirtualize && desktopVisibleRange.bottomSpacerHeight > 0 ? (
                <tr aria-hidden="true">
                  <td
                    colSpan={10}
                    style={{ padding: 0, height: `${desktopVisibleRange.bottomSpacerHeight}px`, border: 'none' }}
                  />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </fieldset>
  )
}
