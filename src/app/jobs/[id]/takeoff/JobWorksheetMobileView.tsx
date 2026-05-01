'use client'

import type { JobWorksheetRow } from '@/components/patterns/estimate/JobWorksheetTableAdapter'
import {
  unitOptions,
  rowTotal,
  currency,
  parentSubtotal,
  validationLabel,
} from './_worksheetFormatters'

type Props = {
  rows: JobWorksheetRow[]
  commitCellValue: (rowId: string, field: string, value: string) => void
  createDraftRowAfter?: () => void
}

export function JobWorksheetMobileView({ rows, commitCellValue, createDraftRowAfter }: Props) {
  const total = rows.reduce((sum, row) => sum + rowTotal(row), 0)

  return (
    <div style={{ padding: 12, paddingBottom: 72 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Grand Total</div>
        <div style={{ fontWeight: 800, fontSize: 20 }}>{currency(total)}</div>
      </div>

      {rows.map((row) => {
        const warning = validationLabel(row)
        const subtotal = parentSubtotal(row, rows)
        return (
          <div key={row.id} style={{ marginBottom: 10, paddingLeft: row.parent_id ? 12 : 0 }}>
            <input
              value={row.description}
              placeholder="Item"
              onChange={(event) => commitCellValue(row.id, 'description', event.currentTarget.value)}
              style={{ width: '100%', fontSize: 14, fontWeight: row.parent_id ? 500 : 700, border: warning ? '1px solid #dc2626' : '1px solid var(--border)', borderRadius: 8, padding: 8, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '0.7fr 1fr 0.9fr 1fr', gap: 6, marginTop: 4, alignItems: 'center' }}>
              <input value={row.quantity ?? ''} inputMode="decimal" onChange={(event) => commitCellValue(row.id, 'quantity', event.currentTarget.value)} style={{ minWidth: 0 }} />
              <input value={currency(row.unit_price, true)} inputMode="decimal" onChange={(event) => commitCellValue(row.id, 'unit_price', event.currentTarget.value)} style={{ minWidth: 0 }} />
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
