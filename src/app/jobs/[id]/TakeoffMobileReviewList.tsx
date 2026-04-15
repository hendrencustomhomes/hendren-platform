'use client'

import { useEffect } from 'react'
import TakeoffSearchSelect, { type SearchSelectOption } from './TakeoffSearchSelect'
import type { CostCodeOption, TakeoffEditablePatch, TakeoffItem, TradeOption } from './takeoffTypes'
import { buildCostCodeLabel, filterCostCodesForTrade, formatCurrency, getExtendedCost, hasIncompleteTakeoffCore } from './takeoffUtils'
import { getGroupSubtotal } from './takeoffReviewUtils'

type TakeoffMobileReviewListProps = {
  groupedItems: [string, TakeoffItem[]][]
  costCodes: CostCodeOption[]
  trades: TradeOption[]
  tradeOptions: SearchSelectOption[]
  editingId: string | null
  expandedRowId: string | null
  onExpandedRowIdChange: (value: string | null) => void
  onUpdateItem: (id: string, patch: TakeoffEditablePatch) => void
}

function inputStyle() {
  return {
    width: '100%',
    padding: '9px 10px',
    border: '1px solid var(--border)',
    borderRadius: '7px',
    fontSize: '16px',
    fontFamily: 'ui-monospace,monospace',
    boxSizing: 'border-box' as const,
    outline: 'none',
    background: 'var(--surface)',
    color: 'var(--text)',
  }
}

function fieldLabelStyle() {
  return {
    fontSize: '10px',
    color: 'var(--text-muted)',
    marginBottom: '4px',
    textTransform: 'uppercase' as const,
    letterSpacing: '.04em',
    fontFamily: 'ui-monospace,monospace',
  }
}

function rowSummary(item: TakeoffItem) {
  const parts = [item.trade, item.cost_code, item.unit ? `${item.qty ?? '—'} ${item.unit}` : null].filter(Boolean)
  return parts.join(' · ') || 'Incomplete row'
}

function enterBlur(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    ;(e.target as HTMLInputElement | HTMLTextAreaElement).blur()
  }
}

function buildCostCodeOptions(costCodes: CostCodeOption[]): SearchSelectOption[] {
  return costCodes
    .map((item) => ({
      value: item.cost_code,
      label: buildCostCodeLabel(item),
      keywords: [item.cost_code, item.title],
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export default function TakeoffMobileReviewList({
  groupedItems,
  costCodes,
  trades,
  tradeOptions,
  editingId,
  expandedRowId,
  onExpandedRowIdChange,
  onUpdateItem,
}: TakeoffMobileReviewListProps) {
  const inp = inputStyle()

  useEffect(() => {
    if (expandedRowId && !groupedItems.some(([, items]) => items.some((item) => item.id === expandedRowId))) {
      onExpandedRowIdChange(null)
    }
  }, [expandedRowId, groupedItems, onExpandedRowIdChange])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {groupedItems.map(([tradeName, groupItems]) => {
        const groupSubtotal = getGroupSubtotal(groupItems)
        return (
          <div key={tradeName}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '6px',
                padding: '8px 10px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: 'var(--bg)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: '700' }}>{tradeName}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {groupItems.length} rows · {formatCurrency(groupSubtotal)}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {groupItems.map((item) => {
                const rowCostCodeOptions = buildCostCodeOptions(filterCostCodesForTrade(costCodes, trades, item.trade))
                const isOpen = expandedRowId === item.id
                const extendedCost = getExtendedCost(item)
                return (
                  <div
                    key={item.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '10px',
                      background: hasIncompleteTakeoffCore(item) ? 'var(--amber-bg, #fff7ed)' : 'var(--bg)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onExpandedRowIdChange(isOpen ? null : item.id)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: 'inherit',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '2px' }}>
                          {item.description || 'Untitled Item'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{rowSummary(item)}</div>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: '700' }}>{formatCurrency(extendedCost)}</div>
                    </button>

                    {isOpen && (
                      <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                        <div>
                          <div style={fieldLabelStyle()}>Trade</div>
                          <TakeoffSearchSelect
                            value={item.trade}
                            disabled={editingId === item.id}
                            options={tradeOptions}
                            onChange={(nextTrade) => {
                              if (nextTrade && nextTrade !== item.trade) {
                                onUpdateItem(item.id, { trade: nextTrade, cost_code: null })
                              }
                            }}
                            placeholder="Search trade"
                          />
                        </div>

                        <div>
                          <div style={fieldLabelStyle()}>Cost Code</div>
                          <TakeoffSearchSelect
                            value={item.cost_code ?? ''}
                            disabled={editingId === item.id}
                            options={rowCostCodeOptions}
                            onChange={(nextCostCode) => {
                              const normalized = nextCostCode || null
                              if (normalized !== (item.cost_code ?? null)) {
                                onUpdateItem(item.id, { cost_code: normalized })
                              }
                            }}
                            placeholder="Search cost code"
                            allowEmpty
                            emptyLabel="None"
                          />
                        </div>

                        <div>
                          <div style={fieldLabelStyle()}>Description</div>
                          <input
                            defaultValue={item.description}
                            disabled={editingId === item.id}
                            style={inp}
                            onBlur={(e) => {
                              const next = e.target.value.trim()
                              if (next && next !== item.description) onUpdateItem(item.id, { description: next })
                            }}
                            onKeyDown={enterBlur}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <div style={fieldLabelStyle()}>Qty</div>
                            <input
                              defaultValue={item.qty ?? 1}
                              disabled={editingId === item.id}
                              inputMode="decimal"
                              style={inp}
                              onBlur={(e) => {
                                const next = Number(e.target.value)
                                if (Number.isFinite(next) && next > 0 && next !== (item.qty ?? 1)) {
                                  onUpdateItem(item.id, { qty: next })
                                }
                              }}
                              onKeyDown={enterBlur}
                            />
                          </div>
                          <div>
                            <div style={fieldLabelStyle()}>Unit</div>
                            <input
                              defaultValue={item.unit ?? ''}
                              disabled={editingId === item.id}
                              style={inp}
                              onBlur={(e) => {
                                const next = e.target.value.trim() || null
                                if (next !== (item.unit ?? null)) onUpdateItem(item.id, { unit: next })
                              }}
                              onKeyDown={enterBlur}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <div style={fieldLabelStyle()}>Unit Cost</div>
                            <input
                              defaultValue={item.unit_cost ?? ''}
                              disabled={editingId === item.id}
                              inputMode="decimal"
                              style={inp}
                              onBlur={(e) => {
                                const next = e.target.value.trim()
                                const parsed = next ? Number(next) : null
                                if (next === '') {
                                  if (item.unit_cost !== null && item.unit_cost !== undefined) {
                                    onUpdateItem(item.id, { unit_cost: null })
                                  }
                                  return
                                }
                                if (parsed !== null && Number.isFinite(parsed) && parsed !== item.unit_cost) {
                                  onUpdateItem(item.id, { unit_cost: parsed })
                                }
                              }}
                              onKeyDown={enterBlur}
                            />
                          </div>
                          <div>
                            <div style={fieldLabelStyle()}>Extended Cost</div>
                            <div style={{ ...inp, display: 'flex', alignItems: 'center' }}>{formatCurrency(extendedCost)}</div>
                          </div>
                        </div>

                        <div>
                          <div style={fieldLabelStyle()}>Notes</div>
                          <textarea
                            defaultValue={item.notes ?? ''}
                            disabled={editingId === item.id}
                            rows={2}
                            style={{ ...inp, resize: 'vertical' as const }}
                            onBlur={(e) => {
                              const next = e.target.value.trim() || null
                              if (next !== (item.notes ?? null)) onUpdateItem(item.id, { notes: next })
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
