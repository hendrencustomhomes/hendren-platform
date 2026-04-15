'use client'

import { useEffect, useMemo, useState } from 'react'
import TakeoffFilterBar from './TakeoffFilterBar'
import TakeoffOverviewStrip from './TakeoffOverviewStrip'
import TakeoffMobileReviewList from './TakeoffMobileReviewList'
import TakeoffDesktopReviewTable from './TakeoffDesktopReviewTable'
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
  hasIncompleteTakeoffCore,
  sortTakeoffItems,
} from './takeoffUtils'
import { buildGroupedItems, matchesTextFilter } from './takeoffReviewUtils'

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

function getDraftExtendedCost(draft: TakeoffDraft) {
  const qty = Number(draft.qty)
  const unitCost = Number(draft.unit_cost)
  if (!Number.isFinite(qty) || !Number.isFinite(unitCost)) return null
  if (qty <= 0 || unitCost < 0) return null
  return qty * unitCost
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

export default function TakeoffWorkspace({
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
  const [textFilter, setTextFilter] = useState('')
  const [tradeFilter, setTradeFilter] = useState('')
  const [costCodeFilter, setCostCodeFilter] = useState('')
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false)

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

  const availableFilterCostCodes = useMemo(
    () => buildCostCodeOptions(filterCostCodesForTrade(costCodes, trades, tradeFilter)),
    [costCodes, trades, tradeFilter]
  )

  useEffect(() => {
    if (
      costCodeFilter &&
      !availableFilterCostCodes.some((option) => option.value === costCodeFilter)
    ) {
      setCostCodeFilter('')
    }
  }, [availableFilterCostCodes, costCodeFilter])

  const filteredItems = useMemo(() => {
    return sortedItems.filter((item) => {
      if (!matchesTextFilter(item, textFilter)) return false
      if (tradeFilter && item.trade !== tradeFilter) return false
      if (costCodeFilter && item.cost_code !== costCodeFilter) return false
      if (showIncompleteOnly && !hasIncompleteTakeoffCore(item)) return false
      return true
    })
  }, [sortedItems, textFilter, tradeFilter, costCodeFilter, showIncompleteOnly])

  const groupedFilteredItems = useMemo(() => buildGroupedItems(filteredItems), [filteredItems])

  const tradeSubtotals = useMemo(
    () =>
      groupedFilteredItems.map(([tradeName, groupItems]) => [
        tradeName,
        groupItems.reduce((sum, item) => {
          const qty = Number(item.qty ?? 0)
          const unitCost = Number(item.unit_cost ?? 0)
          if (!Number.isFinite(qty) || !Number.isFinite(unitCost)) return sum
          return sum + qty * unitCost
        }, 0),
      ] as [string, number]),
    [groupedFilteredItems]
  )

  const draftExtendedCost = getDraftExtendedCost(draft)
  const hasActiveFilters = Boolean(textFilter.trim() || tradeFilter || costCodeFilter || showIncompleteOnly)

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

      <TakeoffOverviewStrip
        allItems={sortedItems}
        visibleItems={filteredItems}
        tradeSubtotals={tradeSubtotals}
        hasActiveFilters={hasActiveFilters}
      />

      <TakeoffFilterBar
        isMobile={isMobile}
        textFilter={textFilter}
        onTextFilterChange={setTextFilter}
        tradeFilter={tradeFilter}
        onTradeFilterChange={setTradeFilter}
        tradeOptions={tradeOptions}
        costCodeFilter={costCodeFilter}
        onCostCodeFilterChange={setCostCodeFilter}
        costCodeOptions={availableFilterCostCodes}
        showIncompleteOnly={showIncompleteOnly}
        onShowIncompleteOnlyChange={setShowIncompleteOnly}
        hasActiveFilters={hasActiveFilters}
        onReset={() => {
          setTextFilter('')
          setTradeFilter('')
          setCostCodeFilter('')
          setShowIncompleteOnly(false)
        }}
      />

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
              onChange={(nextCostCode) =>
                setDraft((current) => ({ ...current, cost_code: nextCostCode }))
              }
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
          Draft extended cost:{' '}
          <strong style={{ color: 'var(--text)' }}>{formatCurrency(draftExtendedCost)}</strong>
        </div>
      </div>

      <div style={cardStyle()}>
        <div style={{ ...sectionLabelStyle(), marginBottom: '10px' }}>Takeoff Workspace</div>

        {!sortedItems.length ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No takeoff items yet.</div>
        ) : !filteredItems.length ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            No takeoff items match the current filters.
          </div>
        ) : isMobile ? (
          <TakeoffMobileReviewList
            groupedItems={groupedFilteredItems}
            costCodes={costCodes}
            trades={trades}
            tradeOptions={tradeOptions}
            editingId={editingId}
            expandedRowId={expandedRowId}
            onExpandedRowIdChange={setExpandedRowId}
            onUpdateItem={onUpdateItem}
          />
        ) : (
          <TakeoffDesktopReviewTable
            groupedItems={groupedFilteredItems}
            costCodes={costCodes}
            trades={trades}
            tradeOptions={tradeOptions}
            editingId={editingId}
            onUpdateItem={onUpdateItem}
          />
        )}
      </div>
    </div>
  )
}