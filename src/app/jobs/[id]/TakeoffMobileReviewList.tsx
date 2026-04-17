'use client'

import { useEffect } from 'react'
import TakeoffSearchSelect, { type SearchSelectOption } from './TakeoffSearchSelect'
import type { CostCodeOption, TakeoffEditablePatch, TakeoffItem, TradeOption } from './takeoffTypes'
import type { TakeoffTreeNode } from './takeoffReviewUtils'
import {
  buildCostCodeLabel,
  filterCostCodesForTrade,
  hasIncompleteTakeoffCore,
  isAssemblyRow,
} from './takeoffUtils'

type TakeoffMobileReviewListProps = {
  treeNodes: TakeoffTreeNode[]
  costCodes: CostCodeOption[]
  trades: TradeOption[]
  tradeOptions: SearchSelectOption[]
  editingId: string | null
  expandedRowId: string | null
  onExpandedRowIdChange: (value: string | null) => void
  onUpdateItem: (id: string, patch: TakeoffEditablePatch) => void
  onStartAddChild: (parent: TakeoffItem) => void
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

function buildCostCodeOptions(costCodes: CostCodeOption[]): SearchSelectOption[] {
  return costCodes
    .map((item) => ({
      value: item.cost_code,
      label: buildCostCodeLabel(item),
      keywords: [item.cost_code, item.title],
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

function rowSummary(item: TakeoffItem) {
  const parts = [item.trade, item.cost_code, item.unit ? `${item.qty ?? '—'} ${item.unit}` : null].filter(Boolean)
  return parts.join(' · ') || 'Incomplete row'
}

function normalizeTradeValue(item: TakeoffItem, tradeOptions: SearchSelectOption[]) {
  return tradeOptions.some((option) => option.value === item.trade) ? item.trade : ''
}

function containsRowId(nodes: TakeoffTreeNode[], rowId: string): boolean {
  return nodes.some((node) => node.row.id === rowId || containsRowId(node.children, rowId))
}

function enterBlur(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    ;(e.target as HTMLInputElement | HTMLTextAreaElement).blur()
  }
}

export default function TakeoffMobileReviewList({
  treeNodes,
  costCodes,
  trades,
  tradeOptions,
  editingId,
  expandedRowId,
  onExpandedRowIdChange,
  onUpdateItem,
  onStartAddChild,
}: TakeoffMobileReviewListProps) {
  const inp = inputStyle()

  useEffect(() => {
    if (expandedRowId && !containsRowId(treeNodes, expandedRowId)) {
      onExpandedRowIdChange(null)
    }
  }, [expandedRowId, treeNodes, onExpandedRowIdChange])

  function renderItemNode(node: TakeoffTreeNode, depth: number) {
    const item = node.row
    const rowCostCodeOptions = buildCostCodeOptions(filterCostCodesForTrade(costCodes, trades, item.trade))
    const isOpen = expandedRowId === item.id
    const normalizedTradeValue = normalizeTradeValue(item, tradeOptions)

    return (
      <div
        key={item.id}
        style={{
          marginLeft: `${depth * 12}px`,
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
        </button>

        {isOpen && (
          <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
            <div>
              <div style={fieldLabelStyle()}>Trade</div>
              <TakeoffSearchSelect
                value={normalizedTradeValue}
                disabled={editingId === item.id}
                options={tradeOptions}
                onChange={(nextTrade) => {
                  if (nextTrade && nextTrade !== item.trade) {
                    onUpdateItem(item.id, {
                      trade: nextTrade,
                      cost_code: nextTrade === item.trade ? item.cost_code : null,
                    })
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
  }

  function renderAssemblyNode(node: TakeoffTreeNode, depth: number): React.ReactNode {
    const assembly = node.row
    const isOpen = expandedRowId === assembly.id
    const normalizedTradeValue = normalizeTradeValue(assembly, tradeOptions)

    return (
      <div
        key={assembly.id}
        style={{
          marginLeft: `${depth * 12}px`,
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '10px',
          background: 'var(--surface)',
        }}
      >
        <button
          type="button"
          onClick={() => onExpandedRowIdChange(isOpen ? null : assembly.id)}
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
              {assembly.description || 'Untitled Assembly'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Assembly · {node.children.length} child rows
            </div>
          </div>
        </button>

        {isOpen && (
          <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
            <div>
              <div style={fieldLabelStyle()}>Trade</div>
              <TakeoffSearchSelect
                value={normalizedTradeValue}
                disabled={editingId === assembly.id}
                options={tradeOptions}
                onChange={(nextTrade) => {
                  const normalized = nextTrade || 'Assembly'
                  if (normalized !== assembly.trade) onUpdateItem(assembly.id, { trade: normalized })
                }}
                placeholder="Optional trade"
                allowEmpty
                emptyLabel="No trade"
              />
            </div>

            <div>
              <div style={fieldLabelStyle()}>Assembly Name</div>
              <input
                defaultValue={assembly.description}
                disabled={editingId === assembly.id}
                style={inp}
                onBlur={(e) => {
                  const next = e.target.value.trim()
                  if (next && next !== assembly.description) onUpdateItem(assembly.id, { description: next })
                }}
                onKeyDown={enterBlur}
              />
            </div>

            <div>
              <div style={fieldLabelStyle()}>Notes</div>
              <textarea
                defaultValue={assembly.notes ?? ''}
                disabled={editingId === assembly.id}
                rows={2}
                style={{ ...inp, resize: 'vertical' as const }}
                onBlur={(e) => {
                  const next = e.target.value.trim() || null
                  if (next !== (assembly.notes ?? null)) onUpdateItem(assembly.id, { notes: next })
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => onStartAddChild(assembly)}
              style={{
                padding: '9px 10px',
                borderRadius: '7px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              + Child Item
            </button>

            {node.children.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {node.children.map((child) => renderNode(child, depth + 1))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  function renderNode(node: TakeoffTreeNode, depth: number): React.ReactNode {
    if (isAssemblyRow(node.row)) return renderAssemblyNode(node, depth)
    return renderItemNode(node, depth)
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{treeNodes.map((node) => renderNode(node, 0))}</div>
}
