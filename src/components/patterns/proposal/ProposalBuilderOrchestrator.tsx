'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import {
  saveProposalStructure,
  unlockProposal,
  signProposal,
  voidProposal,
} from '@/app/actions/proposal-actions'
import { sendProposal } from '@/app/actions/document-actions'
import type { ProposalStructureJson, ProposalStructureSection, ProposalStatus } from '@/lib/proposalStructure'
import type { JobWorksheetRow } from '@/components/patterns/estimate/JobWorksheetTableAdapter'

type Props = {
  jobId: string
  jobName: string
  estimateId: string
  estimateTitle: string
  worksheetRows: JobWorksheetRow[]
  initialStructure: ProposalStructureJson
  proposalStatus: ProposalStatus
  isLocked: boolean
}

const btnStyle = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  borderRadius: '8px',
  padding: '6px 10px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
} as const

const iconBtnStyle = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  borderRadius: '6px',
  padding: '3px 7px',
  fontSize: '11px',
  cursor: 'pointer',
  lineHeight: 1,
} as const

const STATUS_BADGE: Record<ProposalStatus, { bg: string; color: string; label: string }> = {
  draft:  { bg: '#f1f5f9', color: '#475569', label: 'Draft' },
  sent:   { bg: '#fef9c3', color: '#92400e', label: 'Sent — Locked' },
  signed: { bg: '#dbeafe', color: '#1d4ed8', label: 'Signed — Locked' },
  voided: { bg: '#fee2e2', color: '#991b1b', label: 'Voided' },
}

export default function ProposalBuilderOrchestrator({
  jobId,
  jobName,
  estimateId,
  estimateTitle,
  worksheetRows,
  initialStructure,
  proposalStatus,
  isLocked,
}: Props) {
  const router = useRouter()
  const [sections, setSections] = useState<ProposalStructureSection[]>(initialStructure.sections)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const rowsById = new Map<string, JobWorksheetRow>()
  for (const row of worksheetRows) rowsById.set(row.id, row)

  function clearActionState() {
    setSaveStatus('idle')
    setActionError(null)
  }

  function moveUp(index: number) {
    if (index === 0 || isLocked) return
    setSections((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
    clearActionState()
  }

  function moveDown(index: number) {
    if (index === sections.length - 1 || isLocked) return
    setSections((prev) => {
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
    clearActionState()
  }

  function toggleVisible(index: number) {
    if (isLocked) return
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, visible: !s.visible } : s))
    )
    clearActionState()
  }

  function setTitle(index: number, value: string) {
    if (isLocked) return
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, title: value || null } : s))
    )
    clearActionState()
  }

  function handleSave() {
    if (isLocked) return
    setSaveStatus('saving')
    setActionError(null)
    startTransition(async () => {
      const result = await saveProposalStructure(estimateId, jobId, { sections })
      if ('error' in result) {
        setSaveStatus('error')
        setActionError(result.error)
      } else {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    })
  }

  function handleSend() {
    setActionError(null)
    startTransition(async () => {
      const result = await sendProposal(estimateId, jobId)
      if ('error' in result) {
        setActionError(result.error)
      } else {
        router.push(`/jobs/${jobId}/proposal/documents/${result.documentId}`)
      }
    })
  }

  function handleUnlock() {
    setActionError(null)
    startTransition(async () => {
      const result = await unlockProposal(estimateId, jobId)
      if ('error' in result) setActionError(result.error)
    })
  }

  function handleSign() {
    setActionError(null)
    startTransition(async () => {
      const result = await signProposal(estimateId, jobId)
      if ('error' in result) setActionError(result.error)
    })
  }

  function handleVoid() {
    if (!window.confirm('Void this proposal? This cannot be undone without duplicating the estimate.')) return
    setActionError(null)
    startTransition(async () => {
      const result = await voidProposal(estimateId, jobId)
      if ('error' in result) setActionError(result.error)
    })
  }

  const badge = STATUS_BADGE[proposalStatus]
  const saveStatusText =
    saveStatus === 'saving' ? 'Saving…' :
    saveStatus === 'saved' ? 'Saved' :
    saveStatus === 'error' ? 'Save failed' : null

  return (
    <>
      <Nav title={`${jobName || 'Job'} · Proposal Builder`} back={`/jobs/${jobId}/proposal`} jobId={jobId} />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Header */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700 }}>Proposal Builder</span>
              <span style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 700,
                background: badge.bg,
                color: badge.color,
              }}>
                {badge.label}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {estimateTitle}
              {isLocked ? ' · Read-only — proposal is locked' : ' · Reorder, hide, or rename sections'}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
              <a href={`/jobs/${jobId}/proposal/preview`} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Preview →
              </a>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {actionError && (
              <span style={{ fontSize: '12px', color: 'var(--error, #c0392b)' }}>{actionError}</span>
            )}
            {saveStatusText && (
              <span style={{ fontSize: '12px', color: saveStatus === 'error' ? 'var(--error, #c0392b)' : 'var(--text-muted)' }}>
                {saveStatusText}
              </span>
            )}

            {/* Save structure (only when unlocked) */}
            {!isLocked && proposalStatus !== 'voided' && (
              <button type="button" onClick={handleSave} disabled={isPending} style={btnStyle}>
                Save structure
              </button>
            )}

            {/* Send: atomic — locks proposal + estimate + creates snapshot in one transaction */}
            {proposalStatus === 'draft' && (
              <button type="button" onClick={handleSend} disabled={isPending} style={btnStyle}>
                Send proposal
              </button>
            )}

            {/* Unlock: sent → draft (only when sent, not signed) */}
            {proposalStatus === 'sent' && (
              <button type="button" onClick={handleUnlock} disabled={isPending} style={btnStyle}>
                Unlock
              </button>
            )}

            {/* Sign: sent → signed */}
            {proposalStatus === 'sent' && (
              <button type="button" onClick={handleSign} disabled={isPending} style={btnStyle}>
                Mark as signed
              </button>
            )}

            {/* Void: sent or signed → voided */}
            {(proposalStatus === 'sent' || proposalStatus === 'signed') && (
              <button
                type="button"
                onClick={handleVoid}
                disabled={isPending}
                style={{ ...btnStyle, color: 'var(--error, #c0392b)', borderColor: 'var(--error, #c0392b)' }}
              >
                Void
              </button>
            )}
          </div>
        </div>

        {/* Locked notice */}
        {isLocked && (
          <div style={{
            background: '#fef9c3',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '12px',
            color: '#92400e',
          }}>
            This proposal is locked. Worksheet edits and structure changes are blocked.
            {proposalStatus === 'sent' && ' Click "Unlock" to revert to draft.'}
            {proposalStatus === 'signed' && ' A signed proposal cannot be unlocked — duplicate the estimate to create a new draft.'}
          </div>
        )}

        {/* Sections list */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {sections.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No sections. Add worksheet rows to generate a structure.
            </div>
          ) : (
            sections.map((section, index) => {
              const sourceRows = section.source_row_ids
                .map((sid) => rowsById.get(sid))
                .filter((r): r is JobWorksheetRow => r !== undefined)

              return (
                <div
                  key={section.id}
                  style={{
                    borderBottom: index < sections.length - 1 ? '1px solid var(--border)' : undefined,
                    opacity: section.visible ? 1 : 0.45,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      background: 'var(--surface-alt, var(--surface))',
                    }}
                  >
                    {/* Reorder buttons */}
                    {!isLocked && (
                      <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          style={{ ...iconBtnStyle, opacity: index === 0 ? 0.3 : 1 }}
                          title="Move up"
                        >▲</button>
                        <button
                          type="button"
                          onClick={() => moveDown(index)}
                          disabled={index === sections.length - 1}
                          style={{ ...iconBtnStyle, opacity: index === sections.length - 1 ? 0.3 : 1 }}
                          title="Move down"
                        >▼</button>
                      </div>
                    )}

                    {/* Title */}
                    {isLocked ? (
                      <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, padding: '4px 0' }}>
                        {section.title?.trim() || sourceRows[0]?.description || '(unnamed section)'}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={section.title ?? ''}
                        onChange={(e) => setTitle(index, e.target.value)}
                        placeholder={sourceRows[0]?.description ?? 'Section title'}
                        style={{
                          flex: 1,
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          background: 'var(--bg)',
                          color: 'var(--text)',
                          minWidth: 0,
                        }}
                      />
                    )}

                    {/* Visibility toggle */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        cursor: isLocked ? 'default' : 'pointer',
                        flexShrink: 0,
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={section.visible}
                        onChange={() => toggleVisible(index)}
                        disabled={isLocked}
                        style={{ width: 14, height: 14 }}
                      />
                      Visible
                    </label>
                  </div>

                  {sourceRows.length > 0 && (
                    <div style={{ padding: '6px 12px 8px', paddingLeft: isLocked ? '12px' : '36px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {sourceRows.map((row) => (
                        <span
                          key={row.id}
                          style={{
                            fontSize: '11px',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {row.description || '(blank)'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {!isLocked && proposalStatus !== 'voided' && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '2px' }}>
            Changes are not saved until you click "Save structure". Visit{' '}
            <a href={`/jobs/${jobId}/proposal`} style={{ color: 'inherit' }}>Proposal Summary</a>{' '}
            to preview the result.
          </div>
        )}
      </div>
    </>
  )
}
