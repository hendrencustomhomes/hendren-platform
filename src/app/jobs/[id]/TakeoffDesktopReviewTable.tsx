'use client'

import TakeoffSearchSelect, { type SearchSelectOption } from './TakeoffSearchSelect'
import type { CostCodeOption, TakeoffEditablePatch, TakeoffItem, TradeOption } from './takeoffTypes'
import { buildCostCodeLabel, filterCostCodesForTrade, formatCurrency, getExtendedCost, hasIncompleteTakeoffCore } from './takeoffUtils'
import { getGroupSubtotal } from './takeoffReviewUtils'

type TakeoffDesktopReviewTableProps = {
  groupedItems: [string, TakeoffItem[]][]
  costCodes: CostCodeOption[]
  trades: TradeOption[]
  tradeOptions: SearchSelectOption[]
  editingId: string | null
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

function desktopColumns() {
  return '1fr 1.35fr 2fr .7fr .8fr .9fr .9fr 1.4fr'
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

export default function TakeoffDesktopReviewTable({
  groupedItems,
  costCodes,
  trades,
  tradeOptions,
  editingId,
  onUpdateItem,
}: TakeoffDesktopReviewTableProps) {
  const inp = inputStyle()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {groupedItems.map(([tradeName, groupItems]) => {
        const groupSubtotal = getGroupSubtotal(groupItems)
        return (
          <div key={tradeName}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
                marginBottom: '8px',
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

            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: '1120px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: desktopColumns(),
                    gap: '8px',
                    padding: '0 0 8px',
                    borderBottom: '1px solid var(--border)',
                    marginBottom: '8px',
                  }}
                >
                  {['Trade', 'Cost Code', 'Description', 'Qty', 'Unit', 'Unit Cost', 'Ext Cost', 'Notes'].map((label) => (
                    <div key={label} style={fieldLabelStyle()}>{label}</div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {groupItems.map((item) => {
                    const rowCostCodeOptions = buildCostCodeOptions(filterCostCodesForTrade(costCodes, trades, item.trade))
                    const extendedCost = getExtendedCost(item)
                    const isIncomplete = hasIncompleteTakeoffCore(item)
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: desktopColumns(),
                          gap: '8px',
                          padding: '8px',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          background: isIncomplete ? 'var(--amber-bg, #fff7ed)' : 'var(--bg)',
                        }}
                      >
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

                        <div style={{ ...inp, display: 'flex', alignItems: 'center' }}>{formatCurrency(extendedCost)}</div>

                        <input
                          defaultValue={item.notes ?? ''}
                          disabled={editingId === item.id}
                          style={inp}
                          onBlur={(e) => {
                            const next = e.target.value.trim() || null
                            if (next !== (item.notes ?? null)) onUpdateItem(item.id, { notes: next })
                          }}
                          onKeyDown={enterBlur}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
