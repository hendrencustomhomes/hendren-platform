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
  getDepth,
} from './_worksheetFormatters'
import { JobWorksheetMobileView } from './JobWorksheetMobileView'

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

function getColumns(
  rowsById: Map<string, JobWorksheetRow>,
  onDeleteRow: (rowId: string) => void,
  commit: (rowId: string, field: JobWorksheetEditableCellKey, value: string) => void,
): EditableDataTableColumn<JobWorksheetRow>[] {
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

type AdapterProps = {
  rows: JobWorksheetRow[]
  activeCell: WorksheetActiveCell<JobWorksheetEditableCellKey> | null
  activeDraft: WorksheetCellDraftValue
  setActiveCell: (cell: WorksheetActiveCell<JobWorksheetEditableCellKey> | null) => void
  setActiveDraft: (draft: WorksheetCellDraftValue) => void
  commitCellValue: (rowId: string, field: JobWorksheetEditableCellKey, value: string | boolean) => void
  handleUndo: () => void
  createDraftRowAfter: (options?: { sourceRowId?: string; asChild?: boolean }) => void
  deleteRow: (rowId: string) => void
}

export function JobWorksheetTableAdapter(props: AdapterProps) {
  const { rows } = props
  const rowsById = useMemo<Map<string, JobWorksheetRow>>(
    () => new Map<string, JobWorksheetRow>(rows.map((row) => [row.id, row])),
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

  if (isMobile()) return (
    <JobWorksheetMobileView
      rows={rows}
      commitCellValue={props.commitCellValue}
      createDraftRowAfter={props.createDraftRowAfter}
    />
  )

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
