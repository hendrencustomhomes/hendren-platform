'use client'

import type {
  Dispatch,
  HTMLInputTypeAttribute,
  InputHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  MutableRefObject,
  SetStateAction,
} from 'react'

export type EditableDataTableCellKey = string

export type EditableDataTableActiveCell = {
  rowId: string
  field: EditableDataTableCellKey
}

export type EditableDataTableDraftValue = string | boolean

export type EditableDataTableVisibleRange<Row> = {
  rows: Row[]
  startIndex: number
  endIndex: number
  topSpacerHeight: number
  bottomSpacerHeight: number
}

export type EditableDataTableColumn<Row> = {
  key: EditableDataTableCellKey
  label: string
  kind: 'static' | 'text' | 'textarea' | 'checkbox'
  width?: string
  editable?: boolean
  isEditable?: (row: Row) => boolean
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  inputType?: HTMLInputTypeAttribute
  textAreaRows?: number
  getValue?: (row: Row) => string | boolean | null | undefined
  formatEditableValue?: (
    value: string | boolean | null | undefined,
    row: Row,
    isEditing: boolean
  ) => string
  renderStaticCell?: (row: Row) => React.ReactNode
}

type Props<Row> = {
  columns: EditableDataTableColumn<Row>[]
  rows: Row[]
  getRowId: (row: Row) => string
  canManage: boolean
  minWidth?: string
  rowHeight?: number
  shouldVirtualize: boolean
  visibleRange: EditableDataTableVisibleRange<Row>
  scrollContainerRef: MutableRefObject<HTMLDivElement | null>
  cellRefs: MutableRefObject<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>
  activeCell: EditableDataTableActiveCell | null
  activeDraft: EditableDataTableDraftValue | null
  onTableScrollTopChange: Dispatch<SetStateAction<number>>
  onTextCellFocus: (
    rowId: string,
    field: EditableDataTableCellKey,
    element: HTMLInputElement | HTMLTextAreaElement
  ) => void
  onTextCellBlur: (rowId: string, field: EditableDataTableCellKey) => void
  onTextCellKeyDown: (
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    rowId: string,
    field: EditableDataTableCellKey
  ) => void
  onTextCellDraftChange: (value: string) => void
  onCheckboxFocus: (rowId: string, field: EditableDataTableCellKey) => void
  onCheckboxBlur: (rowId: string, field: EditableDataTableCellKey) => void
  onCheckboxKeyDown: (
    event: ReactKeyboardEvent<HTMLInputElement>,
    rowId: string,
    field: EditableDataTableCellKey
  ) => void
  onCheckboxCommit: (rowId: string, field: EditableDataTableCellKey, nextValue: boolean) => void
  getRenderedCellValue: (row: Row, field: EditableDataTableCellKey) => EditableDataTableDraftValue
}

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

const activeTableCellStyle = {
  ...tableCellStyle,
  boxShadow: 'inset 0 0 0 2px var(--accent, #2563eb)',
  position: 'relative' as const,
  zIndex: 1,
}

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

const inputStyle = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  padding: '6px 8px',
  color: 'var(--text)',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box' as const,
} as const

const staticCellStyle = {
  padding: '8px',
  fontSize: '13px',
  whiteSpace: 'nowrap' as const,
} as const

const lockedStaticCellStyle = {
  ...staticCellStyle,
  color: 'var(--text-muted)',
  background: 'var(--surface-subtle, var(--surface))',
} as const

function getCellDomKey(rowId: string, field: EditableDataTableCellKey) {
  return `${rowId}:${field}`
}

function isFullySelected(element: HTMLInputElement | HTMLTextAreaElement) {
  const valueLength = element.value.length
  return (element.selectionStart ?? 0) === 0 && (element.selectionEnd ?? 0) === valueLength
}

function isColumnEditable<Row>(column: EditableDataTableColumn<Row>, row: Row) {
  if (column.kind === 'static') return false
  if (column.editable === false) return false
  if (column.isEditable) return column.isEditable(row)
  return true
}

function renderStaticValue<Row>(column: EditableDataTableColumn<Row>, row: Row, locked = false) {
  if (column.renderStaticCell) return column.renderStaticCell(row)
  const rawValue = column.getValue?.(row) ?? ''
  const formattedValue = column.formatEditableValue
    ? column.formatEditableValue(rawValue, row, false)
    : String(rawValue ?? '')
  return <div style={locked ? lockedStaticCellStyle : staticCellStyle}>{formattedValue}</div>
}

export function EditableDataTable<Row>({
  columns,
  getRowId,
  canManage,
  minWidth = '1180px',
  rowHeight = 52,
  shouldVirtualize,
  visibleRange,
  scrollContainerRef,
  cellRefs,
  activeCell,
  activeDraft,
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
}: Props<Row>) {
  return (
    <fieldset disabled={!canManage} style={fieldsetResetStyle}>
      <div style={{ overflowX: 'auto' }}>
        <div
          ref={scrollContainerRef}
          onScroll={(event) => {
            if (!shouldVirtualize) return
            onTableScrollTopChange(event.currentTarget.scrollTop)
          }}
          style={{
            overflowY: shouldVirtualize ? 'auto' : 'visible',
            maxHeight: shouldVirtualize ? '560px' : undefined,
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth }}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} style={{ ...headerCellStyle, width: column.width }}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shouldVirtualize && visibleRange.topSpacerHeight > 0 ? (
                <tr aria-hidden="true">
                  <td
                    colSpan={columns.length}
                    style={{ padding: 0, height: `${visibleRange.topSpacerHeight}px`, border: 'none' }}
                  />
                </tr>
              ) : null}

              {visibleRange.rows.map((row) => {
                const rowId = getRowId(row)
                return (
                  <tr key={rowId} style={{ height: `${rowHeight}px` }}>
                    {columns.map((column) => {
                      const isActive = activeCell?.rowId === rowId && activeCell.field === column.key
                      const cellStyle = isActive ? activeTableCellStyle : tableCellStyle

                      if (column.kind === 'static') {
                        return (
                          <td key={column.key} style={cellStyle}>
                            {renderStaticValue(column, row)}
                          </td>
                        )
                      }

                      const editable = isColumnEditable(column, row)
                      if (!editable) {
                        return (
                          <td key={column.key} style={cellStyle}>
                            {renderStaticValue(column, row, true)}
                          </td>
                        )
                      }

                      if (column.kind === 'checkbox') {
                        const checked = Boolean(getRenderedCellValue(row, column.key))
                        return (
                          <td key={column.key} style={cellStyle}>
                            <label
                              style={{ display: 'flex', justifyContent: 'center', padding: '8px', cursor: 'pointer' }}
                            >
                              <input
                                ref={(element) => {
                                  cellRefs.current[getCellDomKey(rowId, column.key)] = element
                                }}
                                type="checkbox"
                                checked={checked}
                                onFocus={() => onCheckboxFocus(rowId, column.key)}
                                onChange={(event) =>
                                  onCheckboxCommit(rowId, column.key, event.currentTarget.checked)
                                }
                                onBlur={() => onCheckboxBlur(rowId, column.key)}
                                onKeyDown={(event) => onCheckboxKeyDown(event, rowId, column.key)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                            </label>
                          </td>
                        )
                      }

                      const value = getRenderedCellValue(row, column.key)
                      const isEditing = activeCell?.rowId === rowId && activeCell.field === column.key
                      const formattedValue = column.formatEditableValue
                        ? column.formatEditableValue(value, row, isEditing)
                        : String(value ?? '')

                      if (column.kind === 'textarea') {
                        return (
                          <td key={column.key} style={cellStyle}>
                            <textarea
                              ref={(element) => {
                                cellRefs.current[getCellDomKey(rowId, column.key)] = element
                              }}
                              value={formattedValue}
                              onFocus={(event) => onTextCellFocus(rowId, column.key, event.currentTarget)}
                              onChange={(event) => onTextCellDraftChange(event.currentTarget.value)}
                              onBlur={() => onTextCellBlur(rowId, column.key)}
                              onKeyDown={(event) => {
                                if (event.key.startsWith('Arrow') && isFullySelected(event.currentTarget)) return
                                onTextCellKeyDown(event, rowId, column.key)
                              }}
                              rows={column.textAreaRows ?? 1}
                              style={{ ...inputStyle, resize: 'none', height: '34px', minHeight: '34px' }}
                            />
                          </td>
                        )
                      }

                      return (
                        <td key={column.key} style={cellStyle}>
                          <input
                            ref={(element) => {
                              cellRefs.current[getCellDomKey(rowId, column.key)] = element
                            }}
                            type={column.inputType ?? 'text'}
                            inputMode={column.inputMode}
                            value={formattedValue}
                            onFocus={(event) => onTextCellFocus(rowId, column.key, event.currentTarget)}
                            onChange={(event) => onTextCellDraftChange(event.currentTarget.value)}
                            onBlur={() => onTextCellBlur(rowId, column.key)}
                            onKeyDown={(event) => {
                              if (event.key.startsWith('Arrow') && isFullySelected(event.currentTarget)) return
                              onTextCellKeyDown(event, rowId, column.key)
                            }}
                            style={inputStyle}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}

              {shouldVirtualize && visibleRange.bottomSpacerHeight > 0 ? (
                <tr aria-hidden="true">
                  <td
                    colSpan={columns.length}
                    style={{ padding: 0, height: `${visibleRange.bottomSpacerHeight}px`, border: 'none' }}
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
