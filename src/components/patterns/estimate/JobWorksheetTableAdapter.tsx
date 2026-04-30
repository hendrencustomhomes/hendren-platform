'use client'

import { useMemo } from 'react'
import { EditableDataTable } from '@/components/data-display/EditableDataTable'
import type { EditableDataTableColumn } from '@/components/data-display/EditableDataTable'
import { useWorksheetInteraction } from '@/components/data-display/worksheet/useWorksheetInteraction'
import { useWorksheetVirtualization } from '@/components/data-display/worksheet/useWorksheetVirtualization'
import type { WorksheetActiveCell, WorksheetCellDraftValue } from '@/components/data-display/worksheet/worksheetTypes'
import {
  unitOptions,
  rowTotal,
  currency,
  parentSubtotal,
  validationLabel,
  getDepth,
} from '@/app/jobs/[id]/takeoff/_worksheetFormatters'

export type JobWorksheetRowKind = 'line_item' | 'assembly' | 'note' | 'allowance'
export type JobWorksheetPricingType = 'unit' | 'lump_sum' | 'allowance' | 'manual' | 'unpriced'
export type JobWorksheetScopeStatus = 'included' | 'excluded'

export type JobWorksheetRow = {
  id: string
  parent_id: string | null
  sort_order: number
  row_kind: JobWorksheetRowKind
  description: string
  location: string | null
  notes: string | null
  scope_status: JobWorksheetScopeStatus
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
  pricing_type: JobWorksheetPricingType
}

export type JobWorksheetEditableCellKey =
  | 'description'
  | 'quantity'
  | 'unit_price'
  | 'unit'
  | 'location'
  | 'notes'

const editableCellOrder: readonly JobWorksheetEditableCellKey[] = [
  'description','quantity','unit_price','unit','location','notes'
]

function isMobile() {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
}

function MobileView({ rows, commitCellValue, createDraftRowAfter }: any) {
  const total = rows.reduce((sum: number, row: JobWorksheetRow) => sum + rowTotal(row), 0)

  return (
    <div style={{ padding: 12, paddingBottom: 72 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Grand Total</div>
        <div style={{ fontWeight: 800, fontSize: 20 }}>{currency(total)}</div>
      </div>

      {rows.map((row: JobWorksheetRow) => {
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

function getColumns(rowsById: Map<string, JobWorksheetRow>, onDeleteRow: any, commit: any): EditableDataTableColumn<JobWorksheetRow>[] {
  return [
    { key:'description',label:'Item',kind:'text',width:'300px',getValue:(row)=>row.description,getCellPaddingLeft:(row)=>8+getDepth(row,rowsById)*16 },
    { key:'quantity',label:'Qty',kind:'text',width:'90px',getValue:(row)=>String(row.quantity??'') },
    { key:'unit_price',label:'Unit Price',kind:'text',width:'120px',getValue:(row)=>String(row.unit_price??''),formatEditableValue:(value,row,editing)=>currency(value,editing) },
    { key:'unit',label:'Unit',kind:'static',width:'120px',renderStaticCell:(row)=>(<input list="unit-options" value={row.unit??'ea'} onChange={(event)=>commit(row.id,'unit',event.currentTarget.value)} />) },
    { key:'total_price',label:'Total',kind:'static',width:'120px',getValue:(row)=>currency(rowTotal(row)) },
    { key:'location',label:'Location',kind:'text',width:'140px',getValue:(row)=>row.location??'' },
    { key:'notes',label:'Notes',kind:'text',width:'200px',getValue:(row)=>row.notes??'' },
    { key:'actions',label:'',kind:'static',width:'50px',renderStaticCell:(row)=>(<button type="button" onClick={()=>onDeleteRow(row.id)} style={{color:'#dc2626',background:'none',border:'none',fontWeight:800,cursor:'pointer'}}>✕</button>) }
  ]
}

export function JobWorksheetTableAdapter(props:any) {
  const { rows } = props
  const rowsById = useMemo<Map<string, JobWorksheetRow>>(
    () => new Map<string, JobWorksheetRow>(rows.map((row: JobWorksheetRow) => [row.id, row])),
    [rows]
  )
  const columns = useMemo(()=>getColumns(rowsById,props.deleteRow,props.commitCellValue),[rowsById,props.deleteRow,props.commitCellValue])

  const virt = useWorksheetVirtualization<JobWorksheetRow>({ rows, rowHeight:64, overscan:8, threshold:20, maxBodyHeight:560 })

  const interaction = useWorksheetInteraction<JobWorksheetRow, JobWorksheetEditableCellKey>({
    rows,
    getRowId:(row:JobWorksheetRow)=>row.id,
    cellOrder:editableCellOrder,
    activeCell:props.activeCell,
    onActiveCellChange:props.setActiveCell,
    activeDraft:props.activeDraft,
    onActiveDraftChange:props.setActiveDraft,
    getCellValue:(row,field)=>String(row[field]??''),
    commitCellValue:props.commitCellValue,
    handleUndo:props.handleUndo,
    onCreateRow:props.createDraftRowAfter,
    onDeleteRow:props.deleteRow,
    scrollContainerRef:virt.scrollContainerRef,
    shouldVirtualize:virt.shouldVirtualize,
    tableViewportHeight:virt.tableViewportHeight,
    onTableScrollTopChange:virt.setTableScrollTop,
    rowHeight:64,
    tableScrollTop:virt.tableScrollTop
  })

  if (isMobile()) return <MobileView {...props} />

  return (
    <>
      <datalist id="unit-options">{unitOptions.map((unit)=><option key={unit} value={unit}/>)}</datalist>
      <EditableDataTable
        columns={columns}
        rows={rows}
        getRowId={(row:JobWorksheetRow)=>row.id}
        canManage
        cellRefs={interaction.cellRefs}
        activeCell={props.activeCell}
        activeDraft={props.activeDraft}
        scrollContainerRef={virt.scrollContainerRef}
        shouldVirtualize={virt.shouldVirtualize}
        visibleRange={virt.visibleRange}
        onTableScrollTopChange={virt.setTableScrollTop}
        onTextCellFocus={interaction.handleTextCellFocus}
        onTextCellBlur={interaction.handleTextCellBlur}
        onTextCellKeyDown={interaction.handleTextCellKeyDown}
        onTextCellDraftChange={interaction.handleDraftChange}
        onCheckboxFocus={interaction.handleCheckboxFocus}
        onCheckboxBlur={interaction.handleCheckboxBlur}
        onCheckboxKeyDown={interaction.handleCheckboxKeyDown}
        onCheckboxCommit={interaction.handleCheckboxCommit}
        getRenderedCellValue={interaction.getRenderedCellValue}
      />
    </>
  )
}
