'use client'

import { useMemo, useState, useTransition } from 'react'
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
import { resolveUnitCost } from './_lib/unitCostResolver'
import { JobWorksheetMobileView } from './JobWorksheetMobileView'
import { PricingLinkModal } from './PricingLinkModal'
import { unlinkRowFromPricing, acceptPricingSource } from '@/app/actions/worksheet-pricing-actions'

export type JobWorksheetRowKind = 'line_item' | 'assembly' | 'note' | 'allowance'
export type JobWorksheetPricingType = 'unit' | 'lump_sum' | 'allowance' | 'manual' | 'unpriced'
export type JobWorksheetScopeStatus = 'included' | 'excluded'

export type JobWorksheetRow = {
  id: string
  estimate_id: string
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
  // Legacy column — kept for snapshot compatibility. Do NOT use for resolution.
  unit_price: number | string | null
  total_price: number | string | null
  pricing_type: JobWorksheetPricingType
  // Unit cost resolution fields
  unit_cost_manual: number | null
  unit_cost_source: number | null
  unit_cost_override: number | null
  unit_cost_is_overridden: boolean
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

function PricingSourceBadge({ row }: { row: JobWorksheetRow }) {
  const isLinked = row.pricing_source_row_id !== null
  return (
    <span
      title={isLinked ? `Linked · SKU: ${row.source_sku ?? row.catalog_sku ?? ''}` : 'No pricing source linked'}
      style={{
        display: 'inline-block',
        fontSize: '10px',
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: '4px',
        letterSpacing: '.03em',
        background: isLinked ? 'rgba(37,99,235,.1)' : 'var(--bg)',
        color: isLinked ? 'var(--blue, #2563eb)' : 'var(--text-muted)',
        border: `1px solid ${isLinked ? 'rgba(37,99,235,.25)' : 'var(--border)'}`,
        whiteSpace: 'nowrap',
      }}
    >
      {isLinked ? 'Linked' : 'Manual'}
    </span>
  )
}

function getColumns(
  rowsById: Map<string, JobWorksheetRow>,
  onDeleteRow: (rowId: string) => void,
  commit: (rowId: string, field: JobWorksheetEditableCellKey, value: string) => void,
  onLinkRow: (rowId: string) => void,
  onUnlinkRow: (rowId: string) => void,
  onAcceptSource: (rowId: string) => void,
): EditableDataTableColumn<JobWorksheetRow>[] {
  return [
    { key:'description',label:'Item',kind:'text',width:'300px',getValue:(row)=>row.description,getCellPaddingLeft:(row)=>8+getDepth(row,rowsById)*16 },
    { key:'quantity',label:'Qty',kind:'text',width:'90px',getValue:(row)=>String(row.quantity??'') },
    { key:'unit_price',label:'Unit Price',kind:'text',width:'120px',getValue:(row)=>String(resolveUnitCost(row)??''),formatEditableValue:(value,row,editing)=>currency(value,editing) },
    {
      key:'pricing_source',
      label:'Source',
      kind:'static',
      width:'90px',
      renderStaticCell:(row) => <PricingSourceBadge row={row} />,
    },
    { key:'unit',label:'Unit',kind:'static',width:'120px',renderStaticCell:(row)=>(<input list="unit-options" value={row.unit??'ea'} onChange={(event)=>commit(row.id,'unit',event.currentTarget.value)} />) },
    { key:'total_price',label:'Total',kind:'static',width:'120px',getValue:(row)=>currency(rowTotal(row)) },
    { key:'location',label:'Location',kind:'text',width:'140px',getValue:(row)=>row.location??'' },
    { key:'notes',label:'Notes',kind:'text',width:'200px',getValue:(row)=>row.notes??'' },
    {
      key:'actions',
      label:'',
      kind:'static',
      width:'120px',
      renderStaticCell:(row) => (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onLinkRow(row.id)}
            title="Link to price source"
            style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)', whiteSpace: 'nowrap' }}
          >
            Link
          </button>
          {row.pricing_source_row_id && (
            <button
              type="button"
              onClick={() => onUnlinkRow(row.id)}
              title="Remove price link"
              style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
            >
              Unlink
            </button>
          )}
          {row.unit_cost_is_overridden && (
            <button
              type="button"
              onClick={() => onAcceptSource(row.id)}
              title="Accept linked source price, discard override"
              style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
            >
              Accept
            </button>
          )}
          <button
            type="button"
            onClick={() => onDeleteRow(row.id)}
            style={{ color: '#dc2626', background: 'none', border: 'none', fontWeight: 800, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      ),
    },
  ]
}

type AdapterProps = {
  jobId: string
  activeEstimateId: string
  isEditable?: boolean
  rows: JobWorksheetRow[]
  activeCell: WorksheetActiveCell<JobWorksheetEditableCellKey> | null
  activeDraft: WorksheetCellDraftValue
  setActiveCell: (cell: WorksheetActiveCell<JobWorksheetEditableCellKey> | null) => void
  setActiveDraft: (draft: WorksheetCellDraftValue) => void
  commitCellValue: (rowId: string, field: JobWorksheetEditableCellKey, value: string | boolean) => void
  forceUpdateRow: (row: JobWorksheetRow) => void
  handleUndo: () => void
  createDraftRowAfter: (options?: { sourceRowId?: string; asChild?: boolean }) => void
  deleteRow: (rowId: string) => void
}

export function JobWorksheetTableAdapter(props: AdapterProps) {
  const { rows, jobId, activeEstimateId, isEditable = true } = props

  const [linkModalRowId, setLinkModalRowId] = useState<string | null>(null)
  const [pendingPriceEdit, setPendingPriceEdit] = useState<{ rowId: string; value: string } | null>(null)
  const [unlinkPending, startUnlinkTransition] = useTransition()
  const [acceptPending, startAcceptTransition] = useTransition()

  const rowsById = useMemo<Map<string, JobWorksheetRow>>(
    () => new Map<string, JobWorksheetRow>(rows.map((row) => [row.id, row])),
    [rows]
  )

  function handleUnlinkRow(rowId: string) {
    startUnlinkTransition(async () => {
      const result = await unlinkRowFromPricing(rowId, activeEstimateId, jobId)
      if ('error' in result) return
      props.forceUpdateRow(result.row)
    })
  }

  function handleAcceptSource(rowId: string) {
    startAcceptTransition(async () => {
      const result = await acceptPricingSource(rowId, activeEstimateId, jobId)
      if ('error' in result) return
      props.forceUpdateRow(result.row)
    })
  }

  // Intercept unit_price commits on linked rows to show confirm dialog before writing override
  function wrappedCommitCellValue(
    rowId: string,
    field: JobWorksheetEditableCellKey,
    value: string | boolean,
  ) {
    if (field === 'unit_price') {
      const row = rowsById.get(rowId)
      if (row?.pricing_source_row_id) {
        setPendingPriceEdit({ rowId, value: String(value) })
        return
      }
    }
    props.commitCellValue(rowId, field, value)
  }

  const columns = useMemo(
    () => getColumns(rowsById, props.deleteRow, props.commitCellValue, setLinkModalRowId, handleUnlinkRow, handleAcceptSource),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowsById, props.deleteRow, props.commitCellValue, unlinkPending, acceptPending],
  )

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
    commitCellValue: wrappedCommitCellValue,
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
        canManage={isEditable}
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

      {/* Link-price modal */}
      {linkModalRowId && (
        <PricingLinkModal
          rowId={linkModalRowId}
          estimateId={activeEstimateId}
          jobId={jobId}
          onClose={() => setLinkModalRowId(null)}
          onLinked={(updatedRow) => {
            props.forceUpdateRow(updatedRow)
            setLinkModalRowId(null)
          }}
        />
      )}

      {/* Inline confirm: manual price edit drops the link */}
      {pendingPriceEdit && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '18px 20px',
              maxWidth: '340px',
              width: '90vw',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 700 }}>Override linked price?</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              This will override the linked source price. The link is kept — use Accept to revert to the source price.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setPendingPriceEdit(null)}
                style={{ padding: '7px 14px', fontSize: '13px', fontWeight: 600, border: '1px solid var(--border)', borderRadius: '7px', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  props.commitCellValue(pendingPriceEdit.rowId, 'unit_price', pendingPriceEdit.value)
                  setPendingPriceEdit(null)
                }}
                style={{ padding: '7px 14px', fontSize: '13px', fontWeight: 700, border: 'none', borderRadius: '7px', background: '#dc2626', color: '#fff', cursor: 'pointer' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
