'use client'

import { useEffect, useMemo, useState } from 'react'
import TakeoffScopeContext from './TakeoffScopeContext'
import TakeoffSearchSelect, { type SearchSelectOption } from './TakeoffSearchSelect'
import type {
  CostCodeOption,
  ScopeContextItem,
  TakeoffEditablePatch,
  TakeoffItem,
  TradeOption,
} from './takeoffTypes'
import {
  buildCostCodeLabel,
  filterCostCodesForTrade,
  formatCurrency,
  getExtendedCost,
  hasIncompleteTakeoffCore,
  sortTakeoffItems,
} from './takeoffUtils'

type TakeoffDraft = {
  trade: string
  description: string
  cost_code: string
  qty: string
  unit: string
  unit_cost: string
  notes: string
}

type TakeoffWorkspaceProps = {
  items: TakeoffItem[]
  trades: TradeOption[]
  costCodes: CostCodeOption[]
  scopeItems: ScopeContextItem[]
  draft: TakeoffDraft
  setDraft: React.Dispatch<React.SetStateAction<TakeoffDraft>>
  saving: boolean
  editingId: string | null
  error: string | null
  onAddItem: () => void
  onUpdateItem: (id: string, patch: TakeoffEditablePatch) => void
}

function cardStyle() {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '12px 14px',
  }
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

function sectionLabelStyle() {
  return {
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: '.05em',
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

function getDraftExtendedCost(draft: TakeoffDraft) {
  const qty = Number(draft.qty)
  const unitCost = Number(draft.unit_cost)
  if (!Number.isFinite(qty) || !Number.isFinite(unitCost)) return null
  if (qty <= 0 || unitCost < 0) return null
  return qty * unitCost
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

function buildTradeOptions(trades: TradeOption[]): SearchSelectOption[] {
  return trades
    .map((trade) => ({
      value: trade.name,
      label: trade.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
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

export default function TakeoffWorkspaceNext({
  items,
  trades,
  costCodes,
  scopeItems,
  draft,
  setDraft,
  saving,
  editingId,
  error,
  onAddItem,
  onUpdateItem,
}: TakeoffWorkspaceProps) {
  const inp = inputStyle()
  const [isMobile, setIsMobile] = useState(false)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const apply = () => setIsMobile(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  const sortedItems = useMemo(() => sortTakeoffItems(items), [items])
  const tradeOptions = useMemo(() => buildTradeOptions(trades), [trades])

  const filteredDraftCostCodes = useMemo(
    () => filterCostCodesForTrade(costCodes, trades, draft.trade),
    [costCodes, trades, draft.trade]
  )

  const filteredDraftCostCodeOptions = useMemo(
    () => buildCostCodeOptions(filteredDraftCostCodes),
    [filteredDraftCostCodes]
  )

  const totalCost = useMemo(
    () => sortedItems.reduce((sum, item) => sum + (getExtendedCost(item) ?? 0), 0),
    [sortedItems]
  )

  const incompleteCount = useMemo(
    () => sortedItems.filter(hasIncompleteTakeoffCore).length,
    [sortedItems]
  )

  const tradeSubtotals = useMemo(() => {
    const subtotals = new Map<string, number>()
    sortedItems.forEach((item) => {
      const key = item.trade?.trim() || 'Unassigned'
      const current = subtotals.get(key) ?? 0
      subtotals.set(key, current + (getExtendedCost(item) ?? 0))
    })
    return Array.from(subtotals.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [sortedItems])

  const draftExtendedCost = getDraftExtendedCost(draft)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {error && (
        <div
          style={{
            background: 'var(--red-bg)',
            border: '1px solid var(--red)',
            color: 'var(--red)',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '12px',
          }}
        >
          {error}
        </div>
      )}

      <TakeoffScopeContext scopeItems={scopeItems} />

      <div style={cardStyle()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <div style={sectionLabelStyle()}>Takeoff Overview</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sortedItems.length} rows</div>
            <div style={{ fontSize: '12px', color: incompleteCount ? 'var(--amber)' : 'var(--text-muted)' }}>
              {incompleteCount} incomplete
            </div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text)' }}>
              {formatCurrency(totalCost)} total
            </div>
          </div>
        </div>

        {!!tradeSubtotals.length && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
            {tradeSubtotals.map(([tradeName, subtotal]) => (
              <div
                key={tradeName}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                }}
              >
                <div style={fieldLabelStyle()}>{tradeName}</div>
                <div style={{ fontSize: '13px', fontWeight: '700' }}>{formatCurrency(subtotal)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={cardStyle()}>
        <div style={{ ...sectionLabelStyle(), marginBottom: '10px' }}>Add Takeoff Item</div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1.2fr 2fr .7fr .8fr .9fr 1.2fr auto',
            gap: '8px',
            alignItems: 'end',
          }}
        >
          <div>
            <div style={fieldLabelStyle()}>Trade</div>
            <TakeoffSearchSelect
              value={draft.trade}
              options={tradeOptions}
              onChange={(nextTrade) => {
                setDraft((current) => ({
                  ...current,
                  trade: nextTrade,
                  cost_code: nextTrade === current.trade ? current.cost_code : '',
                }))
              }}
              placeholder="Search trade"
            />
          </div>

          <div>
            <div style={fieldLabelStyle()}>Cost Code</div>
            <TakeoffSearchSelect
              value={draft.cost_code}
              options={filteredDraftCostCodeOptions}
              onChange={(nextCostCode) => setDraft((current) => ({ ...current, cost_code: nextCostCode }))}
              placeholder="Search cost code"
              allowEmpty
              emptyLabel="None"
            />
          </div>

          <div>
            <div style={fieldLabelStyle()}>Description</div>
            <input
              value={draft.description}
              onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
              style={inp}
            />
          </div>

          <div>
            <div style={fieldLabelStyle()}>Qty</div>
            <input
              value={draft.qty}
              onChange={(e) => setDraft((current) => ({ ...current, qty: e.target.value }))}
              inputMode="decimal"
              style={inp}
            />
          </div>

          <div>
            <div style={fieldLabelStyle()}>Unit</div>
            <input
              value={draft.unit}
              onChange={(e) => setDraft((current) => ({ ...current, unit: e.target.value }))}
              style={inp}
            />
          </div>

          <div>
            <div style={fieldLabelStyle()}>Unit Cost</div>
            <input
              value={draft.unit_cost}
              onChange={(e) => setDraft((current) => ({ ...current, unit_cost: e.target.value }))}
              inputMode="decimal"
              style={inp}
            />
          </div>

          <div>
            <div style={fieldLabelStyle()}>Notes</div>
            <input
              value={draft.notes}
              onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onAddItem()
                }
              }}
              style={inp}
            />
          </div>

          <button
            onClick={onAddItem}
            disabled={saving || !draft.trade.trim() || !draft.description.trim()}
            style={{
              padding: '10px 12px',
              border: 'none',
              borderRadius: '7px',
              background: 'var(--text)',
              color: 'var(--bg)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: saving || !draft.trade.trim() || !draft.description.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Add'}
          </button>
        </div>

        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Draft extended cost: <strong style={{ color: 'var(--text)' }}>{formatCurrency(draftExtendedCost)}</strong>
        </div>
      </div>

      <div style={cardStyle()}>
        <div style={{ ...sectionLabelStyle(), marginBottom: '10px' }}>Takeoff Workspace</div>

        {!sortedItems.length ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No takeoff items yet.</div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedItems.map((item) => {
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
                    background: 'var(--bg)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedRowId(isOpen ? null : item.id)}
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
        ) : (
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
                {sortedItems.map((item) => {
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
        )}
      </div>
    </div>
  )
}
