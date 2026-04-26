'use client'

type WorksheetRowKind = 'line_item' | 'assembly' | 'note' | 'allowance'
type WorksheetPricingType = 'unit' | 'lump_sum' | 'allowance' | 'manual' | 'unpriced'
type WorksheetScopeStatus = 'included' | 'excluded'

export type JobWorksheetReadOnlyRow = {
  id: string
  parent_id: string | null
  sort_order: number
  row_kind: WorksheetRowKind
  description: string
  location: string | null
  notes: string | null
  scope_status: WorksheetScopeStatus
  is_upgrade: boolean
  replaces_item_id: string | null
  quantity: number | string | null
  unit: string | null
  pricing_source_row_id: string | null
  pricing_header_id: string | null
  catalog_sku: string | null
  source_sku: string | null
  unit_price: number | string | null
  total_price: number | string | null
  pricing_type: WorksheetPricingType
}

type Props = {
  jobId: string
  rows: JobWorksheetReadOnlyRow[]
}

const rowKindLabels: Record<WorksheetRowKind, string> = {
  line_item: 'Line item',
  assembly: 'Assembly',
  allowance: 'Allowance',
  note: 'Note',
}

const pricingTypeLabels: Record<WorksheetPricingType, string> = {
  unit: 'Unit',
  lump_sum: 'Lump sum',
  allowance: 'Allowance',
  manual: 'Manual',
  unpriced: 'Unpriced',
}

const panelStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '14px',
} as const

const labelStyle = {
  fontSize: '10px',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  fontFamily: 'ui-monospace,monospace',
} as const

const headerCellStyle = {
  border: '1px solid var(--border)',
  textAlign: 'left',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  color: 'var(--text-muted)',
  padding: '8px',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  background: 'var(--surface)',
  zIndex: 1,
} as const

const cellStyle = {
  border: '1px solid var(--border)',
  padding: '8px',
  fontSize: '13px',
  verticalAlign: 'top',
  background: 'var(--surface)',
} as const

function formatNumber(value: number | string | null) {
  if (value === null || value === '') return '—'
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return String(value)
  return numericValue.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function formatMoney(value: number | string | null) {
  if (value === null || value === '') return '—'
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return String(value)
  return numericValue.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function getDepth(row: JobWorksheetReadOnlyRow, rowsById: Map<string, JobWorksheetReadOnlyRow>) {
  let depth = 0
  let currentParentId = row.parent_id
  const seen = new Set<string>()

  while (currentParentId && !seen.has(currentParentId) && depth < 8) {
    seen.add(currentParentId)
    const parent = rowsById.get(currentParentId)
    if (!parent) break
    depth += 1
    currentParentId = parent.parent_id
  }

  return depth
}

function getRowTone(row: JobWorksheetReadOnlyRow) {
  if (row.row_kind === 'assembly') return 'Assembly row: may carry its own total or group child scope.'
  if (row.row_kind === 'allowance') return 'Allowance row: selection linkage is not built yet.'
  if (row.row_kind === 'note') return 'Note row: non-priced context.'
  if (row.pricing_type === 'unpriced') return 'Unpriced line item.'
  return 'Ready'
}

export default function JobWorksheetReadOnly({ jobId, rows }: Props) {
  const rowsById = new Map(rows.map((row) => [row.id, row]))
  const assemblies = rows.filter((row) => row.row_kind === 'assembly').length
  const allowances = rows.filter((row) => row.row_kind === 'allowance').length
  const notes = rows.filter((row) => row.row_kind === 'note').length
  const unpriced = rows.filter((row) => row.pricing_type === 'unpriced').length

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>Internal Job Worksheet</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
              Read-only first slice against job_worksheet_items. Legacy takeoff and estimate tables are not used here.
            </div>
          </div>
          <a
            href={`/jobs/${jobId}`}
            style={{
              fontSize: '12px',
              padding: '7px 10px',
              border: '1px solid var(--border)',
              borderRadius: '7px',
              textDecoration: 'none',
              alignSelf: 'flex-start',
              color: 'var(--text)',
            }}
          >
            Back to job
          </a>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
        {[
          ['Rows', rows.length],
          ['Assemblies', assemblies],
          ['Allowances', allowances],
          ['Notes', notes],
          ['Unpriced', unpriced],
        ].map(([label, value]) => (
          <div key={label} style={panelStyle}>
            <div style={labelStyle}>{label}</div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>{value}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ ...panelStyle, textAlign: 'center', padding: '28px 18px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>No worksheet rows yet.</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>
            This proves the new worksheet route can load safely. Row creation/editing comes in the next slice.
          </div>
        </div>
      ) : (
        <div style={panelStyle}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '1120px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>Type</th>
                  <th style={headerCellStyle}>Description</th>
                  <th style={headerCellStyle}>Location</th>
                  <th style={headerCellStyle}>Qty</th>
                  <th style={headerCellStyle}>Unit</th>
                  <th style={headerCellStyle}>Pricing</th>
                  <th style={headerCellStyle}>Unit Price</th>
                  <th style={headerCellStyle}>Total</th>
                  <th style={headerCellStyle}>Source</th>
                  <th style={headerCellStyle}>Status</th>
                  <th style={headerCellStyle}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const depth = getDepth(row, rowsById)
                  const isAssembly = row.row_kind === 'assembly'
                  return (
                    <tr key={row.id}>
                      <td style={{ ...cellStyle, fontWeight: isAssembly ? 700 : 500 }}>
                        {rowKindLabels[row.row_kind]}
                      </td>
                      <td style={{ ...cellStyle, fontWeight: isAssembly ? 700 : 500 }}>
                        <div style={{ paddingLeft: `${depth * 18}px` }}>{row.description}</div>
                      </td>
                      <td style={cellStyle}>{row.location || '—'}</td>
                      <td style={cellStyle}>{row.row_kind === 'note' ? '—' : formatNumber(row.quantity)}</td>
                      <td style={cellStyle}>{row.row_kind === 'note' ? '—' : row.unit || '—'}</td>
                      <td style={cellStyle}>{pricingTypeLabels[row.pricing_type]}</td>
                      <td style={cellStyle}>{row.row_kind === 'note' ? '—' : formatMoney(row.unit_price)}</td>
                      <td style={{ ...cellStyle, fontWeight: row.total_price ? 700 : 400 }}>
                        {row.row_kind === 'note' ? '—' : formatMoney(row.total_price)}
                      </td>
                      <td style={cellStyle}>
                        <div>{row.catalog_sku || '—'}</div>
                        {row.source_sku ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{row.source_sku}</div>
                        ) : null}
                      </td>
                      <td style={cellStyle}>{getRowTone(row)}</td>
                      <td style={cellStyle}>{row.notes || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
