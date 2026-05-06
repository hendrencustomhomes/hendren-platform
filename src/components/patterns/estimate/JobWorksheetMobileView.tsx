'use client'

import { useState } from 'react'
import type { JobWorksheetRow, JobWorksheetEditableCellKey } from './JobWorksheetTableAdapter'
import {
  unitOptions,
  rowTotal,
  currency,
  parentSubtotal,
} from './_worksheetFormatters'
import { resolveUnitCost } from './_lib/unitCostResolver'
import { validationLabel } from './_worksheetValidation'
import { PricingStateIcon, fmt } from './_lib/pricingStateIcon'

type Props = {
  rows: JobWorksheetRow[]
  commitCellValue: (rowId: string, field: JobWorksheetEditableCellKey, value: string) => void
  createDraftRowAfter?: () => void
  staleRowIds?: Set<string>
}

export function JobWorksheetMobileView({ rows, commitCellValue, createDraftRowAfter, staleRowIds = new Set() }: Props) {
  const total = rows.reduce((sum, row) => sum + rowTotal(row), 0)
  const [openDetailRowId, setOpenDetailRowId] = useState<string | null>(null)

  function toggleDetail(rowId: string) {
    setOpenDetailRowId((prev: string | null) => (prev === rowId ? null : rowId))
  }

  return (
    <div style={{ padding: 12, paddingBottom: 72 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Grand Total</div>
        <div style={{ fontWeight: 800, fontSize: 20 }}>{currency(total)}</div>
      </div>

      {rows.map((row) => {
        const warning = validationLabel(row)
        const subtotal = parentSubtotal(row, rows)
        const isLinked = row.pricing_source_row_id !== null
        const isOverridden = row.unit_cost_is_overridden
        const hasPricingState = isLinked || isOverridden
        const isStale = staleRowIds.has(row.id)
        const detailOpen = openDetailRowId === row.id
        const sku = row.source_sku ?? row.catalog_sku ?? null
        return (
          <div key={row.id} style={{ marginBottom: 10, paddingLeft: row.parent_id ? 12 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                value={row.description}
                placeholder="Item"
                onChange={(event) => commitCellValue(row.id, 'description', event.currentTarget.value)}
                style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: row.parent_id ? 500 : 700, border: warning ? '1px solid #dc2626' : '1px solid var(--border)', borderRadius: 8, padding: 8, boxSizing: 'border-box' }}
              />
              {hasPricingState && (
                <button
                  type="button"
                  onClick={() => toggleDetail(row.id)}
                  aria-label={detailOpen ? 'Hide pricing detail' : 'Show pricing detail'}
                  style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                >
                  <PricingStateIcon row={row} isStale={isStale} />
                </button>
              )}
            </div>
            {detailOpen && hasPricingState && (
              <div style={{ fontSize: 12, lineHeight: 1.6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Source</span>
                  <strong>{fmt(row.unit_cost_source)}</strong>
                </div>
                {isOverridden && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Override</span>
                    <strong style={{ color: '#d97706' }}>{fmt(row.unit_cost_override)}</strong>
                  </div>
                )}
                {sku && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>SKU</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{sku}</span>
                  </div>
                )}
                {isStale && (
                  <div style={{ color: '#ea580c', marginTop: 2 }}>Source price updated</div>
                )}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '0.7fr 1fr 0.9fr 1fr', gap: 6, marginTop: 4, alignItems: 'center' }}>
              <input value={row.quantity ?? ''} inputMode="decimal" onChange={(event) => commitCellValue(row.id, 'quantity', event.currentTarget.value)} style={{ minWidth: 0 }} />
              <input value={currency(resolveUnitCost(row), true)} inputMode="decimal" onChange={(event) => commitCellValue(row.id, 'unit_price', event.currentTarget.value)} style={{ minWidth: 0 }} />
              <input list="unit-options" value={row.unit ?? 'ea'} onChange={(event) => commitCellValue(row.id, 'unit', event.currentTarget.value)} style={{ minWidth: 0 }} />
              <div style={{ fontWeight: 700, textAlign: 'right' }}>{currency(rowTotal(row))}</div>
            </div>
            {!row.parent_id && subtotal !== rowTotal(row) ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Subtotal: {currency(subtotal)}</div>
            ) : null}
            {warning ? <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{warning}</div> : null}
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => createDraftRowAfter?.()}
        style={{ position: 'fixed', right: 16, bottom: 16, border: 'none', borderRadius: 999, padding: '12px 16px', background: 'var(--accent, #2563eb)', color: 'white', fontWeight: 800, boxShadow: '0 8px 24px rgba(0,0,0,.18)' }}
      >
        + Item
      </button>

      <datalist id="unit-options">{unitOptions.map((unit) => <option key={unit} value={unit} />)}</datalist>
    </div>
  )
}
