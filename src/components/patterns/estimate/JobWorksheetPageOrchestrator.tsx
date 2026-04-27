'use client'

import { PageShell } from '@/components/layout/PageShell'
import { JobWorksheetTableAdapter, type JobWorksheetRow } from './JobWorksheetTableAdapter'

type Props = {
  jobId: string
  jobName: string
  rows: JobWorksheetRow[]
}

export default function JobWorksheetPageOrchestrator({ jobId, jobName, rows }: Props) {
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
            Read-only slice using shared worksheet UI. Editing, creation, and persistence come next.
          </div>
        </div>

        <JobWorksheetTableAdapter rows={rows} />
      </div>
    </PageShell>
  )
}
