'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createProposalSnapshot } from '@/app/actions/document-actions'

type Props = {
  estimateId: string
  jobId: string
  label?: string
}

const btnStyle = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  borderRadius: '8px',
  padding: '5px 10px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  lineHeight: 1.4,
} as const

export default function SnapshotCreateButton({ estimateId, jobId, label = 'Create snapshot' }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      const result = await createProposalSnapshot(estimateId, jobId)
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push(`/jobs/${jobId}/proposal/documents/${result.documentId}`)
      }
    })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {error && (
        <span style={{ fontSize: '11px', color: 'var(--error, #c0392b)' }}>{error}</span>
      )}
      <button
        type="button"
        onClick={handleCreate}
        disabled={isPending}
        style={{ ...btnStyle, opacity: isPending ? 0.6 : 1, cursor: isPending ? 'default' : 'pointer' }}
      >
        {isPending ? 'Creating…' : label}
      </button>
    </div>
  )
}
