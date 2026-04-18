'use client'

import { trashJob } from '../actions'

export default function JobTrashControls({ jobId, counts }: { jobId: string; counts: any }) {
  const total = Object.values(counts).reduce((a: number, b: any) => a + (b || 0), 0)

  const message = total > 0
    ? `This job has ${total} linked records. It will NOT delete them, but will hide the job. Continue?`
    : 'Move this job to trash?'

  const action = trashJob.bind(null, jobId)

  return (
    <form action={action} onSubmit={(e) => { if (!confirm(message)) e.preventDefault() }}>
      <button type="submit" style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--red)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
        Move to Trash
      </button>
    </form>
  )
}
