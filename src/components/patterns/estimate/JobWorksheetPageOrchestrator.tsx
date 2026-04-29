'use client'

import { PageShell } from '@/components/layout/PageShell'
import { JobWorksheetTableAdapter, type JobWorksheetRow } from './JobWorksheetTableAdapter'
import { useJobWorksheetState } from './_hooks/useJobWorksheetState'
import { useJobWorksheetPersistence } from './_hooks/useJobWorksheetPersistence'

type Props = {
  jobId: string
  jobName: string
  rows: JobWorksheetRow[]
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

export default function JobWorksheetPageOrchestrator({ jobId, jobName, rows }: Props) {
  const { persistRow, createRow, restoreRows, deleteRow, persistSortOrders } = useJobWorksheetPersistence()

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
  } = useJobWorksheetState(jobId, rows, persistRow, createRow, restoreRows, deleteRow, persistSortOrders)

  const statusLabel = getSheetStatusLabel(saveCounts)

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
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{statusLabel}</div>
              <button type="button" onClick={() => createDraftRowAfter()} style={secondaryButtonStyle}>
                Add row
              </button>
            </div>
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
