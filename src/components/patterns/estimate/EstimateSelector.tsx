'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import type { Estimate, EstimateStatus } from '@/lib/estimateTypes'
import {
  createEstimate,
  setActiveEstimate,
  archiveEstimate,
  duplicateEstimate,
  renameEstimate,
} from '@/app/actions/estimate-actions'

type Props = {
  jobId: string
  estimates: Estimate[]
}

type ActionResult = { error: string } | { success: true } | { estimate: Estimate }

const STATUS_STYLE: Record<EstimateStatus, { bg: string; color: string }> = {
  active:   { bg: '#dcfce7', color: '#15803d' },
  draft:    { bg: '#f1f5f9', color: '#475569' },
  staged:   { bg: '#fef9c3', color: '#854d0e' },
  sent:     { bg: '#dbeafe', color: '#1d4ed8' },
  signed:   { bg: '#d1fae5', color: '#065f46' },
  rejected: { bg: '#fee2e2', color: '#991b1b' },
  voided:   { bg: '#f3f4f6', color: '#6b7280' },
  archived: { bg: '#f3f4f6', color: '#9ca3af' },
}

function StatusBadge({ status }: { status: EstimateStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.draft
  return (
    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

function Btn({ children, onClick, disabled, variant = 'default' }: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 11, padding: '2px 8px',
        border: '1px solid var(--border)', borderRadius: 4,
        background: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        color: variant === 'danger' ? '#dc2626' : 'var(--text)',
        fontWeight: 600, opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}

export function EstimateSelector({ jobId, estimates }: Props) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [flashError, setFlashError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  const active = estimates.find((e) => e.status === 'active')
  const nonArchived = estimates.filter((e) => e.status !== 'archived')
  const archived = estimates.filter((e) => e.status === 'archived')

  function showError(msg: string) {
    setFlashError(msg)
    setTimeout(() => setFlashError(null), 5000)
  }

  function act(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await fn()
      if ('error' in result) showError(result.error)
    })
  }

  function startRename(est: Estimate) {
    setEditingId(est.id)
    setEditingTitle(est.title)
  }

  function commitRename(id: string) {
    const title = editingTitle.trim()
    setEditingId(null)
    if (!title) return
    act(() => renameEstimate(id, title, jobId))
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          border: '1px solid var(--border)', borderRadius: 8,
          padding: '5px 10px', background: 'var(--surface)',
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
          color: 'var(--text)', opacity: isPending ? 0.6 : 1,
        }}
      >
        <span>{active?.title ?? 'No active estimate'}</span>
        <StatusBadge status={active?.status ?? 'draft'} />
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
            minWidth: 380, background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: 12,
          }}
        >
          {flashError && (
            <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8, padding: '6px 8px', background: '#fef2f2', borderRadius: 6 }}>
              {flashError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {nonArchived.map((est) => (
              <div
                key={est.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 6,
                  background: est.status === 'active' ? 'rgba(0,0,0,.03)' : 'none',
                }}
              >
                {editingId === est.id ? (
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.currentTarget.value)}
                    onBlur={() => commitRename(est.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(est.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    style={{ flex: 1, fontSize: 13, border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px' }}
                  />
                ) : (
                  <span
                    style={{ flex: 1, fontSize: 13, fontWeight: est.status === 'active' ? 700 : 500 }}
                    title="Double-click to rename"
                    onDoubleClick={() => startRename(est)}
                  >
                    {est.title}
                    {est.is_change_order && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>CO</span>
                    )}
                  </span>
                )}
                <StatusBadge status={est.status} />
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {est.status !== 'active' && (
                    <Btn onClick={() => act(() => setActiveEstimate(est.id, jobId))} disabled={isPending}>Use</Btn>
                  )}
                  <Btn onClick={() => startRename(est)} disabled={isPending}>Rename</Btn>
                  <Btn onClick={() => act(() => duplicateEstimate(est.id, jobId))} disabled={isPending}>Copy</Btn>
                  {est.status !== 'active' && (
                    <Btn onClick={() => act(() => archiveEstimate(est.id, jobId))} disabled={isPending} variant="danger">Archive</Btn>
                  )}
                </div>
              </div>
            ))}
          </div>

          {archived.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none', padding: '4px 0' }}>
                Archived ({archived.length})
              </summary>
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {archived.map((est) => (
                  <div key={est.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>{est.title}</span>
                    <StatusBadge status={est.status} />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Btn onClick={() => act(() => setActiveEstimate(est.id, jobId))} disabled={isPending}>Restore</Btn>
                      <Btn onClick={() => act(() => duplicateEstimate(est.id, jobId))} disabled={isPending}>Copy</Btn>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => act(() => createEstimate(jobId))}
              disabled={isPending}
              style={{
                width: '100%', padding: '7px 0', border: '1px dashed var(--border)',
                borderRadius: 8, background: 'none', cursor: isPending ? 'not-allowed' : 'pointer',
                fontSize: 12, color: 'var(--text-muted)', fontWeight: 600,
                opacity: isPending ? 0.5 : 1,
              }}
            >
              + New estimate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
