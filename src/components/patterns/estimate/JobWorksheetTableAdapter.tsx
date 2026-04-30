'use client'

import { useMemo } from 'react'
import { EditableDataTable } from '@/components/data-display/EditableDataTable'
import type { EditableDataTableColumn } from '@/components/data-display/EditableDataTable'
import { useWorksheetInteraction } from '@/components/data-display/worksheet/useWorksheetInteraction'
import { useWorksheetVirtualization } from '@/components/data-display/worksheet/useWorksheetVirtualization'
import type { WorksheetActiveCell, WorksheetCellDraftValue } from '@/components/data-display/worksheet/worksheetTypes'

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

const unitOptions = ['flat','ea','sqft','lnft','cuft'] as const

function isMobile() {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
}

function MobileView({ rows, commitCellValue }: any) {
  const total = rows.reduce((s:any,r:any)=>{
    const q=Number(r.quantity);const p=Number(r.unit_price)
    return s+(q&&p?q*p:0)
  },0)

  return (
    <div style={{padding:12}}>
      <div style={{fontWeight:600, marginBottom:12}}>Total: ${total.toFixed(2)}</div>
      {rows.map((row:any)=>(
        <div key={row.id} style={{marginBottom:10, paddingLeft: row.parent_id?12:0}}>
          <input value={row.description} onChange={(e)=>commitCellValue(row.id,'description',e.target.value)} style={{width:'100%'}} />
          <div style={{display:'flex', gap:6}}>
            <input value={row.quantity??''} onChange={(e)=>commitCellValue(row.id,'quantity',e.target.value)} style={{flex:1}} />
            <input value={row.unit_price??''} onChange={(e)=>commitCellValue(row.id,'unit_price',e.target.value)} style={{flex:1}} />
            <input list="unit-options" value={row.unit??'ea'} onChange={(e)=>commitCellValue(row.id,'unit',e.target.value)} style={{flex:1}} />
            <div style={{flex:1}}>{row.quantity&&row.unit_price?`$${(Number(row.quantity)*Number(row.unit_price)).toFixed(2)}`:''}</div>
          </div>
        </div>
      ))}
      <datalist id="unit-options">{unitOptions.map(u=><option key={u} value={u}/>)}</datalist>
    </div>
  )
}

function getDepth(row: JobWorksheetRow, rowsById: Map<string, JobWorksheetRow>) {
  return row.parent_id ? 1 : 0
}

function currency(val: any, editing: boolean) {
  if (!val) return ''
  const num = Number(val)
  if (isNaN(num)) return val
  return editing ? String(num) : `$${num.toFixed(2)}`
}

function getColumns(rowsById: Map<string, JobWorksheetRow>, onDeleteRow: any, commit: any): EditableDataTableColumn<JobWorksheetRow>[] {
  return [
    { key:'description',label:'Item',kind:'text',width:'300px',getValue:(r)=>r.description,getCellPaddingLeft:(r)=>8+getDepth(r,rowsById)*16 },
    { key:'quantity',label:'Qty',kind:'text',width:'90px',getValue:(r)=>String(r.quantity??'') },
    { key:'unit_price',label:'Unit Price',kind:'text',width:'120px',getValue:(r)=>String(r.unit_price??''),formatEditableValue:(v,r,e)=>currency(v,e) },
    { key:'unit',label:'Unit',kind:'static',width:'120px',renderStaticCell:(r)=>(<input list="unit-options" value={r.unit??'ea'} onChange={(e)=>commit(r.id,'unit',e.target.value)} />) },
    { key:'total_price',label:'Total',kind:'static',width:'120px',getValue:(r)=>{const q=Number(r.quantity);const p=Number(r.unit_price);if(!q||!p)return'';return`$${(q*p).toFixed(2)}`} },
    { key:'location',label:'Location',kind:'text',width:'140px',getValue:(r)=>r.location??'' },
    { key:'notes',label:'Notes',kind:'text',width:'200px',getValue:(r)=>r.notes??'' },
    { key:'actions',label:'',kind:'static',width:'50px',renderStaticCell:(r)=>(<button onClick={()=>onDeleteRow(r.id)} style={{color:'#dc2626'}}>✕</button>) }
  ]
}

export function JobWorksheetTableAdapter(props:any) {
  if (isMobile()) return <MobileView {...props} />

  const { rows } = props
  const rowsById = useMemo(()=>new Map(rows.map((r:any)=>[r.id,r])),[rows])
  const columns = useMemo(()=>getColumns(rowsById,props.deleteRow,props.commitCellValue),[rowsById])

  const virt = useWorksheetVirtualization({ rows, rowHeight:64, overscan:8, threshold:20, maxBodyHeight:560 })

  const interaction = useWorksheetInteraction({
    rows,
    getRowId:(r:any)=>r.id,
    cellOrder:editableCellOrder,
    activeCell:props.activeCell,
    onActiveCellChange:props.setActiveCell,
    activeDraft:props.activeDraft,
    onActiveDraftChange:props.setActiveDraft,
    getCellValue:(r:any,f:any)=>r[f]??'',
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

  return (
    <>
      <datalist id="unit-options">{unitOptions.map(u=><option key={u} value={u}/>)}</datalist>
      <EditableDataTable
        columns={columns}
        rows={rows}
        getRowId={(r:any)=>r.id}
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
