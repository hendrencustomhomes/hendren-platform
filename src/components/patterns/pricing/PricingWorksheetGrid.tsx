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
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '8px 10px',
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

const virtualMaxBodyHeight = 560

function getCellDomKey(rowId: string, field: EditableCellKey) {
  return `${rowId}:${field}`
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
                  'Catalog SKU',
                  'Description',
                  'Vendor SKU',
                  'Unit',
                  'Unit Price',
                  'Lead Days',
                  'Active',
                  'Notes',
                  'Cost Code',
                ].map((label) => (
                  <th
                    key={label}
                    style={{
                      textAlign: 'left',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '.04em',
                      color: 'var(--text-muted)',
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                      position: shouldVirtualize ? 'sticky' : 'static',
                      top: 0,
                      background: 'var(--surface)',
                      zIndex: 1,
                    }}
                  >
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
                    style={{
                      padding: 0,
                      height: `${desktopVisibleRange.topSpacerHeight}px`,
                      borderBottom: 'none',
                    }}
                  />
                </tr>
              ) : null}

              {desktopVisibleRange.rows.map((row) => {
                const rowStatus = getRowStatusLabel(row.id)
                return (
                  <tr key={row.id} style={{ height: '70px' }}>
                    <td
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '13px',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle',
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{row.source_sku}</div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: rowStatus.tone === 'danger' ? '#fca5a5' : 'var(--text-muted)',
                        }}
                      >
                        {rowStatus.text}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '13px',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle',
                      }}
                    >
                      {row.catalog_sku}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                      <input
                        ref={(element) => {
                          cellRefs.current[getCellDomKey(row.id, 'description_snapshot')] = element
                        }}
                        value={String(getRenderedCellValue(row, 'description_snapshot'))}
                        onFocus={(e) => onTextCellFocus(row.id, 'description_snapshot', e.currentTarget)}
                        onChange={(e) => onTextCellDraftChange(e.target.value)}
                        onBlur={() => onTextCellBlur(row.id, 'description_snapshot')}
                        onKeyDown={(e) => onTextCellKeyDown(e, row.id, 'description_snapshot')}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                      <input
                        ref={(element) => {
                          cellRefs.current[getCellDomKey(row.id, 'vendor_sku')] = element
                        }}
                        value={String(getRenderedCellValue(row, 'vendor_sku'))}
                        onFocus={(e) => onTextCellFocus(row.id, 'vendor_sku', e.currentTarget)}
                        onChange={(e) => onTextCellDraftChange(e.target.value)}
                        onBlur={() => onTextCellBlur(row.id, 'vendor_sku')}
                        onKeyDown={(e) => onTextCellKeyDown(e, row.id, 'vendor_sku')}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                      <input
                        ref={(element) => {
                          cellRefs.current[getCellDomKey(row.id, 'unit')] = element
                        }}
                        value={String(getRenderedCellValue(row, 'unit'))}
                        onFocus={(e) => onTextCellFocus(row.id, 'unit', e.currentTarget)}
                        onChange={(e) => onTextCellDraftChange(e.target.value)}
                        onBlur={() => onTextCellBlur(row.id, 'unit')}
                        onKeyDown={(e) => onTextCellKeyDown(e, row.id, 'unit')}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
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
                        onKeyDown={(e) => onTextCellKeyDown(e, row.id, 'unit_price')}
                        inputMode="decimal"
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                      <input
                        ref={(element) => {
                          cellRefs.current[getCellDomKey(row.id, 'lead_days')] = element
                        }}
                        value={String(getRenderedCellValue(row, 'lead_days'))}
                        onFocus={(e) => onTextCellFocus(row.id, 'lead_days', e.currentTarget)}
                        onChange={(e) => onTextCellDraftChange(e.target.value)}
                        onBlur={() => onTextCellBlur(row.id, 'lead_days')}
                        onKeyDown={(e) => onTextCellKeyDown(e, row.id, 'lead_days')}
                        inputMode="numeric"
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                      <label style={{ display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>
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
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                      <textarea
                        ref={(element) => {
                          cellRefs.current[getCellDomKey(row.id, 'notes')] = element
                        }}
                        value={String(getRenderedCellValue(row, 'notes'))}
                        onFocus={(e) => onTextCellFocus(row.id, 'notes', e.currentTarget)}
                        onChange={(e) => onTextCellDraftChange(e.target.value)}
                        onBlur={() => onTextCellBlur(row.id, 'notes')}
                        onKeyDown={(e) => onTextCellKeyDown(e, row.id, 'notes')}
                        rows={1}
                        style={{ ...cellInputStyle, resize: 'none', height: '38px', minHeight: '38px' }}
                      />
                    </td>
                    <td
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '13px',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle',
                      }}
                    >
                      {costCodeMap.get(row.cost_code_id) ?? '—'}
                    </td>
                  </tr>
                )
              })}

              {shouldVirtualize && desktopVisibleRange.bottomSpacerHeight > 0 ? (
                <tr aria-hidden="true">
                  <td
                    colSpan={10}
                    style={{
                      padding: 0,
                      height: `${desktopVisibleRange.bottomSpacerHeight}px`,
                      borderBottom: 'none',
                    }}
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
