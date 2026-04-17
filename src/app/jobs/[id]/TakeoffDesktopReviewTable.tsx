'use client'

import TakeoffSearchSelect, { type SearchSelectOption } from './TakeoffSearchSelect'
import type { CostCodeOption, TakeoffEditablePatch, TakeoffItem, TradeOption } from './takeoffTypes'
import type { TakeoffTreeNode } from './takeoffReviewUtils'
import {
  buildCostCodeLabel,
  filterCostCodesForTrade,
  hasIncompleteTakeoffCore,
  isAssemblyRow,
} from './takeoffUtils'

type TakeoffDesktopReviewTableProps = {
  treeNodes: TakeoffTreeNode[]
  costCodes: CostCodeOption[]
  trades: TradeOption[]
  tradeOptions: SearchSelectOption[]
  editingId: string | null
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

function desktopColumns() {
  return '1fr 1.15fr 2.2fr .8fr .8fr 1.6fr'
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

function normalizeTradeValue(item: TakeoffItem, tradeOptions: SearchSelectOption[]) {
  return tradeOptions.some((option) => option.value === item.trade) ? item.trade : ''
}

export default function TakeoffDesktopReviewTable({
  treeNodes,
  costCodes,
  trades,
  tradeOptions,
  editingId,
  onUpdateItem,
  onStartAddChild,
}: TakeoffDesktopReviewTableProps) {
  const inp = inputStyle()

  function renderItemRow(item: TakeoffItem, depth: number) {
    const rowCostCodeOptions = buildCostCodeOptions(filterCostCodesForTrade(costCodes, trades, item.trade))
    const isIncomplete = hasIncompleteTakeoffCore(item)
    const normalizedTradeValue = normalizeTradeValue(item, tradeOptions)

    return (
      <div
        key={item.id}
        style={{
          marginLeft: `${depth * 18}px`,
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
  }

  function renderAssemblyNode(node: TakeoffTreeNode, depth: number): React.ReactNode {
    const assembly = node.row
    const normalizedTradeValue = normalizeTradeValue(assembly, tradeOptions)

    return (
      <div key={assembly.id} style={{ marginLeft: `${depth * 18}px`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          style={{
            padding: '10px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            background: 'var(--surface)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '8px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '.04em',
                  color: 'var(--text-muted)',
                }}
              >
                Assembly
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {node.children.length} child rows
              </div>
            </div>
            <button
              type="button"
              onClick={() => onStartAddChild(assembly)}
              style={{
                padding: '7px 10px',
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.6fr', gap: '8px' }}>
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
              <input
                defaultValue={assembly.notes ?? ''}
                disabled={editingId === assembly.id}
                style={inp}
                onBlur={(e) => {
                  const next = e.target.value.trim() || null
                  if (next !== (assembly.notes ?? null)) onUpdateItem(assembly.id, { notes: next })
                }}
                onKeyDown={enterBlur}
              />
            </div>
          </div>
        </div>

        {node.children.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  function renderNode(node: TakeoffTreeNode, depth: number): React.ReactNode {
    if (isAssemblyRow(node.row)) return renderAssemblyNode(node, depth)
    return renderItemRow(node.row, depth)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: '980px' }}>
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
            {['Trade', 'Cost Code', 'Description', 'Qty', 'Unit', 'Notes'].map((label) => (
              <div key={label} style={fieldLabelStyle()}>{label}</div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {treeNodes.map((node) => renderNode(node, 0))}
          </div>
        </div>
      </div>
    </div>
  )
}
