'use client'

import { useEffect, useMemo, useState } from 'react'
import TakeoffMobileReviewList from './TakeoffMobileReviewList'
import TakeoffDesktopReviewTable from './TakeoffDesktopReviewTable'
import TakeoffSearchSelect, { type SearchSelectOption } from './TakeoffSearchSelect'
import type {
  CostCodeOption,
  TakeoffEditablePatch,
  TakeoffItem,
  TakeoffRowKind,
  TradeOption,
} from './takeoffTypes'
import {
  buildCostCodeLabel,
  filterCostCodesForTrade,
  hasIncompleteTakeoffCore,
  isAssemblyRow,
  isItemRow,
  sortTakeoffItems,
} from './takeoffUtils'
import {
  buildTakeoffTree,
  filterTakeoffTree,
  flattenTakeoffTree,
  matchesTextFilter,
} from './takeoffReviewUtils'

type TakeoffDraft = {
  row_kind: TakeoffRowKind
  parent_id: string
  trade: string
  description: string
  cost_code: string
  qty: string
  unit: string
  notes: string
}

type WorkspacePanel = 'new_item' | 'new_assembly' | 'filters' | null

type TakeoffWorkspaceProps = {
  items: TakeoffItem[]
  trades: TradeOption[]
  costCodes: CostCodeOption[]
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

function actionButtonStyle(active: boolean) {
  return {
    padding: '8px 12px',
    borderRadius: '8px',
    border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`,
    background: active ? 'var(--text)' : 'var(--surface)',
    color: active ? 'var(--bg)' : 'var(--text)',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  }
}

function toolbarBadgeStyle() {
  return {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: 'ui-monospace,monospace',
  }
}

function overlayStyle(isMobile: boolean, align: 'left' | 'right') {
  return {
    position: 'absolute' as const,
    top: 'calc(100% + 8px)',
    left: isMobile || align === 'left' ? 0 : 'auto',
    right: isMobile || align === 'right' ? 0 : 'auto',
    width: isMobile ? '100%' : align === 'left' ? 'min(100%, 560px)' : 'min(100%, 900px)',
    zIndex: 50,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    boxShadow: '0 16px 40px rgba(0,0,0,0.16)',
    padding: '12px 14px',
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

function panelHeaderButtonStyle() {
  return {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '12px',
    cursor: 'pointer',
  }
}

function buildTradeOptions(trades: TradeOption[]): SearchSelectOption[] {
  return trades
    .map((trade) => ({ value: trade.name, label: trade.name }))
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

function buildAssemblyOptions(items: TakeoffItem[]): SearchSelectOption[] {
  return items
    .filter(isAssemblyRow)
    .map((item) => ({
      value: item.id,
      label: item.description,
      keywords: [item.description, item.trade, item.notes ?? ''],
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export default function TakeoffWorkspace({
  items,
  trades,
  costCodes,
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
  const [openPanel, setOpenPanel] = useState<WorkspacePanel>(null)
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
  const assemblyOptions = useMemo(() => buildAssemblyOptions(sortedItems), [sortedItems])

  useEffect(() => {
    if (draft.parent_id && !assemblyOptions.some((option) => option.value === draft.parent_id)) {
      setDraft((current) => ({ ...current, parent_id: '' }))
    }
  }, [assemblyOptions, draft.parent_id, setDraft])

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

  const takeoffTree = useMemo(() => buildTakeoffTree(sortedItems), [sortedItems])

  const filteredTree = useMemo(() => {
    return filterTakeoffTree(takeoffTree, (item) => {
      if (!matchesTextFilter(item, textFilter)) return false
      if (tradeFilter && item.trade !== tradeFilter) return false
      if (costCodeFilter && item.cost_code !== costCodeFilter) return false
      if (showIncompleteOnly && !hasIncompleteTakeoffCore(item)) return false
      return true
    })
  }, [takeoffTree, textFilter, tradeFilter, costCodeFilter, showIncompleteOnly])

  const visibleItems = useMemo(() => flattenTakeoffTree(filteredTree), [filteredTree])

  const tradeCounts = useMemo(() => {
    const groups = new Map<string, number>()
    visibleItems.forEach((item) => {
      if (!isItemRow(item)) return
      const key = item.trade?.trim() || 'Unassigned'
      groups.set(key, (groups.get(key) ?? 0) + 1)
    })
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [visibleItems])

  const activeFilterCount = [
    textFilter.trim(),
    tradeFilter,
    costCodeFilter,
    showIncompleteOnly ? 'incomplete' : '',
  ].filter(Boolean).length

  function openNewItemPanel() {
    setDraft({
      row_kind: 'item',
      parent_id: '',
      trade: '',
      description: '',
      cost_code: '',
      qty: '1',
      unit: '',
      notes: '',
    })
    setOpenPanel((current) => (current === 'new_item' ? null : 'new_item'))
  }

  function openNewAssemblyPanel() {
    setDraft({
      row_kind: 'assembly',
      parent_id: '',
      trade: '',
      description: '',
      cost_code: '',
      qty: '1',
      unit: '',
      notes: '',
    })
    setOpenPanel((current) => (current === 'new_assembly' ? null : 'new_assembly'))
  }

  function startAddChild(parent: TakeoffItem) {
    setDraft({
      row_kind: 'item',
      parent_id: parent.id,
      trade: parent.trade === 'Assembly' ? '' : parent.trade,
      description: '',
      cost_code: '',
      qty: '1',
      unit: '',
      notes: '',
    })
    setOpenPanel('new_item')
  }

  const addDisabled = !draft.description.trim() || (draft.row_kind === 'item' && !draft.trade.trim())

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

      <div style={{ ...cardStyle(), position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '8px',
          }}
        >
          <div style={sectionLabelStyle()}>Takeoff Workspace</div>
          <div style={toolbarBadgeStyle()}>
            {visibleItems.length}/{sortedItems.length} visible
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <button type="button" onClick={openNewItemPanel} style={actionButtonStyle(openPanel === 'new_item')}>
            ➕ New Item
          </button>

          <button type="button" onClick={openNewAssemblyPanel} style={actionButtonStyle(openPanel === 'new_assembly')}>
            🧱 New Assembly
          </button>

          <button
            type="button"
            onClick={() => setOpenPanel((current) => (current === 'filters' ? null : 'filters'))}
            style={actionButtonStyle(openPanel === 'filters')}
          >
            🔎 Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </button>
        </div>

        {openPanel === 'filters' && (
          <div style={overlayStyle(isMobile, 'left')}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
                marginBottom: '10px',
              }}
            >
              <div style={sectionLabelStyle()}>Review Filters</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTextFilter('')
                      setTradeFilter('')
                      setCostCodeFilter('')
                      setShowIncompleteOnly(false)
                    }}
                    style={panelHeaderButtonStyle()}
                  >
                    Reset
                  </button>
                )}
                <button type="button" onClick={() => setOpenPanel(null)} style={panelHeaderButtonStyle()}>
                  Close
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              <div>
                <div style={fieldLabelStyle()}>Text Search</div>
                <input
                  value={textFilter}
                  onChange={(e) => setTextFilter(e.target.value)}
                  placeholder="Search description, trade, code, notes..."
                  style={inp}
                />
              </div>

              <div>
                <div style={fieldLabelStyle()}>Trade Filter</div>
                <TakeoffSearchSelect
                  value={tradeFilter}
                  options={tradeOptions}
                  onChange={setTradeFilter}
                  placeholder="All trades"
                  allowEmpty
                  emptyLabel="All trades"
                />
              </div>

              <div>
                <div style={fieldLabelStyle()}>Cost Code Filter</div>
                <TakeoffSearchSelect
                  value={costCodeFilter}
                  options={availableFilterCostCodes}
                  onChange={setCostCodeFilter}
                  placeholder="All cost codes"
                  allowEmpty
                  emptyLabel="All cost codes"
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={showIncompleteOnly}
                  onChange={(e) => setShowIncompleteOnly(e.target.checked)}
                  style={{ accentColor: 'var(--blue)', cursor: 'pointer' }}
                />
                Incomplete Only
              </label>
            </div>
          </div>
        )}

        {openPanel === 'new_assembly' && (
          <div style={overlayStyle(isMobile, 'right')}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
                marginBottom: '10px',
              }}
            >
              <div style={sectionLabelStyle()}>New Assembly</div>
              <button type="button" onClick={() => setOpenPanel(null)} style={panelHeaderButtonStyle()}>
                Close
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1.5fr 1.5fr auto',
                gap: '8px',
                alignItems: 'end',
              }}
            >
              <div>
                <div style={fieldLabelStyle()}>Trade</div>
                <TakeoffSearchSelect
                  value={tradeOptions.some((option) => option.value === draft.trade) ? draft.trade : ''}
                  options={tradeOptions}
                  onChange={(nextTrade) => setDraft((current) => ({ ...current, trade: nextTrade }))}
                  placeholder="Optional trade"
                  allowEmpty
                  emptyLabel="No trade"
                />
              </div>

              <div>
                <div style={fieldLabelStyle()}>Assembly Name</div>
                <input
                  value={draft.description}
                  onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
                  style={inp}
                />
              </div>

              <div>
                <div style={fieldLabelStyle()}>Notes</div>
                <input
                  value={draft.notes}
                  onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))}
                  style={inp}
                />
              </div>

              <button
                onClick={onAddItem}
                disabled={saving || addDisabled}
                style={{
                  padding: '10px 12px',
                  border: 'none',
                  borderRadius: '7px',
                  background: 'var(--text)',
                  color: 'var(--bg)',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: saving || addDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {openPanel === 'new_item' && (
          <div style={overlayStyle(isMobile, 'right')}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
                marginBottom: '10px',
              }}
            >
              <div style={sectionLabelStyle()}>{draft.parent_id ? 'New Child Item' : 'New Item'}</div>
              <button type="button" onClick={() => setOpenPanel(null)} style={panelHeaderButtonStyle()}>
                Close
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1.2fr 1.2fr 2fr .8fr .9fr 1.2fr auto',
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
                <div style={fieldLabelStyle()}>Parent Assembly</div>
                <TakeoffSearchSelect
                  value={draft.parent_id}
                  options={assemblyOptions}
                  onChange={(nextParentId) => setDraft((current) => ({ ...current, parent_id: nextParentId }))}
                  placeholder="Top-level item"
                  allowEmpty
                  emptyLabel="Top-level item"
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
                disabled={saving || addDisabled}
                style={{
                  padding: '10px 12px',
                  border: 'none',
                  borderRadius: '7px',
                  background: 'var(--text)',
                  color: 'var(--bg)',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: saving || addDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Add'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={cardStyle()}>
        {!sortedItems.length ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No takeoff rows yet.</div>
        ) : !visibleItems.length ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            No takeoff rows match the current filters.
          </div>
        ) : isMobile ? (
          <TakeoffMobileReviewList
            treeNodes={filteredTree}
            costCodes={costCodes}
            trades={trades}
            tradeOptions={tradeOptions}
            editingId={editingId}
            expandedRowId={expandedRowId}
            onExpandedRowIdChange={setExpandedRowId}
            onUpdateItem={onUpdateItem}
            onStartAddChild={startAddChild}
          />
        ) : (
          <TakeoffDesktopReviewTable
            treeNodes={filteredTree}
            costCodes={costCodes}
            trades={trades}
            tradeOptions={tradeOptions}
            editingId={editingId}
            onUpdateItem={onUpdateItem}
            onStartAddChild={startAddChild}
          />
        )}
      </div>
    </div>
  )
}
