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

export default function JobWorksheetPageOrchestrator({ jobId, jobName, rows }: Props) {
  const { persistRow } = useJobWorksheetPersistence()

  const {
    localRows,
    activeCell,
    activeDraft,
    setActiveCell,
    setActiveDraft,
    commitCellValue,
    handleUndo,
  } = useJobWorksheetState(rows, persistRow)

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
          <div style={{ fontSize: '18px', fontWeight: 700 }}>Internal Job Worksheet</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Editable slice (existing rows only). Changes auto-save.
          </div>
        </div>

        <JobWorksheetTableAdapter
          rows={localRows}
          activeCell={activeCell}
          activeDraft={activeDraft}
          setActiveCell={setActiveCell}
          setActiveDraft={setActiveDraft}
          commitCellValue={commitCellValue}
          handleUndo={handleUndo}
        />
      </div>
    </PageShell>
  )
}
