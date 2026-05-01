'use client'

import { useRef, useState, useTransition } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { JobWorksheetTableAdapter, type JobWorksheetRow } from './JobWorksheetTableAdapter'
import { EstimateSelector } from './EstimateSelector'
import { useJobWorksheetState } from './_hooks/useJobWorksheetState'
import { useJobWorksheetPersistence } from './_hooks/useJobWorksheetPersistence'
import { importEstimate } from '@/app/actions/estimate-actions'
import type { Estimate } from '@/lib/estimateTypes'

type Props = {
  jobId: string
  jobName: string
  activeEstimateId: string
  rows: JobWorksheetRow[]
  estimates: Estimate[]
}

function getSheetStatusLabel(saveCounts: { saving: number; dirty: number; error: number }) {
  if (saveCounts.error > 0) return 'Save failed — local changes retained'
  if (saveCounts.saving > 0) return 'Saving…'
  if (saveCounts.dirty > 0) return 'Unsaved changes'
  return 'Saved'
}

const secondaryButtonStyle = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  borderRadius: '10px',
  padding: '8px 10px',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
} as const

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export default function JobWorksheetPageOrchestrator({ jobId, jobName, activeEstimateId, rows, estimates }: Props) {
  const { persistRow, createRow, restoreRows, deleteRow, persistSortOrders } = useJobWorksheetPersistence(activeEstimateId)

  const {
    localRows,
    activeCell,
    activeDraft,
    setActiveCell,
    setActiveDraft,
    commitCellValue,
    createDraftRowAfter,
    deleteWorksheetRow,
    handleUndo,
    saveCounts,
  } = useJobWorksheetState(jobId, activeEstimateId, rows, persistRow, createRow, restoreRows, deleteRow, persistSortOrders)

  const statusLabel = getSheetStatusLabel(saveCounts)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleExport() {
    const rowsById = new Map<string, JobWorksheetRow>()
    for (const r of localRows) {
      if (!r.id.startsWith('draft_')) rowsById.set(r.id, r)
    }

    function getDepth(row: JobWorksheetRow): number {
      let depth = 0
      let current: JobWorksheetRow | undefined = row
      while (current?.parent_id && depth < 8) {
        current = rowsById.get(current.parent_id)
        depth++
      }
      return depth
    }

    const lines: string[] = ['depth,description,quantity,unit,unit_price,location,notes,row_kind']
    for (const row of localRows) {
      if (row.id.startsWith('draft_')) continue
      lines.push([
        csvEscape(getDepth(row)),
        csvEscape(row.description),
        csvEscape(row.quantity),
        csvEscape(row.unit),
        csvEscape(row.unit_price),
        csvEscape(row.location),
        csvEscape(row.notes),
        csvEscape(row.row_kind),
      ].join(','))
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'worksheet.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!file.name.endsWith('.csv')) {
      setImportStatus({ kind: 'error', text: 'Please select a .csv file.' })
      setTimeout(() => setImportStatus(null), 6000)
      return
    }

    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      startTransition(async () => {
        const result = await importEstimate(jobId, text)
        if ('error' in result) {
          setImportStatus({ kind: 'error', text: result.error })
        } else {
          setImportStatus({ kind: 'success', text: 'Import complete — new draft estimate created.' })
        }
        setTimeout(() => setImportStatus(null), 6000)
      })
    }
    reader.readAsText(file)
  }

  return (
    <PageShell title={`${jobName || 'Job'} · Worksheet`} back={`/jobs/${jobId}`}>
      <div style={{ display: 'grid', gap: '12px' }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>Internal Job Worksheet</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Editable slice. Changes auto-save.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {importStatus && (
                <div style={{
                  fontSize: '12px',
                  color: importStatus.kind === 'error' ? 'var(--error, #c0392b)' : 'var(--success, #27ae60)',
                  whiteSpace: 'nowrap',
                }}>
                  {importStatus.text}
                </div>
              )}
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{statusLabel}</div>
              <button type="button" onClick={handleExport} style={secondaryButtonStyle}>
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
                style={secondaryButtonStyle}
              >
                {isPending ? 'Importing…' : 'Import CSV'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleImportFileChange}
              />
              <button type="button" onClick={() => createDraftRowAfter()} style={secondaryButtonStyle}>
                Add row
              </button>
            </div>
          </div>

          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <EstimateSelector jobId={jobId} estimates={estimates} />
          </div>
        </div>

        <JobWorksheetTableAdapter
          rows={localRows}
          activeCell={activeCell}
          activeDraft={activeDraft}
          setActiveCell={setActiveCell}
          setActiveDraft={setActiveDraft}
          commitCellValue={commitCellValue}
          createDraftRowAfter={createDraftRowAfter}
          deleteRow={deleteWorksheetRow}
          handleUndo={handleUndo}
        />
      </div>
    </PageShell>
  )
}
