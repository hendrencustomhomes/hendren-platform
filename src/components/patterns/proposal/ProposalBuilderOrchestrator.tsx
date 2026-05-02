'use client'

import { useState, useTransition } from 'react'
import Nav from '@/components/Nav'
import { saveProposalStructure } from '@/app/actions/proposal-actions'
import type { ProposalStructureJson, ProposalStructureSection } from '@/lib/proposalStructure'
import type { JobWorksheetRow } from '@/components/patterns/estimate/JobWorksheetTableAdapter'

type Props = {
  jobId: string
  jobName: string
  estimateId: string
  estimateTitle: string
  worksheetRows: JobWorksheetRow[]
  initialStructure: ProposalStructureJson
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

export default function ProposalBuilderOrchestrator({
  jobId,
  jobName,
  estimateId,
  estimateTitle,
  worksheetRows,
  initialStructure,
}: Props) {
  const [sections, setSections] = useState<ProposalStructureSection[]>(initialStructure.sections)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [isPending, startTransition] = useTransition()

  const rowsById = new Map<string, JobWorksheetRow>()
  for (const row of worksheetRows) rowsById.set(row.id, row)

  function moveUp(index: number) {
    if (index === 0) return
    setSections((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
    setSaveStatus('idle')
  }

  function moveDown(index: number) {
    if (index === sections.length - 1) return
    setSections((prev) => {
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
    setSaveStatus('idle')
  }

  function toggleVisible(index: number) {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, visible: !s.visible } : s))
    )
    setSaveStatus('idle')
  }

  function setTitle(index: number, value: string) {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, title: value || null } : s))
    )
    setSaveStatus('idle')
  }

  function handleSave() {
    setSaveStatus('saving')
    startTransition(async () => {
      const result = await saveProposalStructure(estimateId, jobId, { sections })
      setSaveStatus('error' in result ? 'error' : 'saved')
      if (!('error' in result)) {
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    })
  }

  const statusText =
    saveStatus === 'saving' ? 'Saving…'
    : saveStatus === 'saved' ? 'Saved'
    : saveStatus === 'error' ? 'Save failed'
    : null

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
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>Proposal Builder</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {estimateTitle} · Structure only — reorder, hide, or rename sections
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {statusText && (
              <span
                style={{
                  fontSize: '12px',
                  color: saveStatus === 'error' ? 'var(--error, #c0392b)' : 'var(--text-muted)',
                }}
              >
                {statusText}
              </span>
            )}
            <button type="button" onClick={handleSave} disabled={isPending} style={btnStyle}>
              Save structure
            </button>
          </div>
        </div>

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
                .map((id) => rowsById.get(id))
                .filter((r): r is JobWorksheetRow => r !== undefined)

              const displayTitle =
                section.title?.trim() || sourceRows[0]?.description || '(unnamed section)'

              return (
                <div
                  key={section.id}
                  style={{
                    borderBottom: index < sections.length - 1 ? '1px solid var(--border)' : undefined,
                    opacity: section.visible ? 1 : 0.45,
                  }}
                >
                  {/* Section header controls */}
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
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        style={{ ...iconBtnStyle, opacity: index === 0 ? 0.3 : 1 }}
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(index)}
                        disabled={index === sections.length - 1}
                        style={{ ...iconBtnStyle, opacity: index === sections.length - 1 ? 0.3 : 1 }}
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>

                    {/* Title input */}
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

                    {/* Visibility toggle */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        flexShrink: 0,
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={section.visible}
                        onChange={() => toggleVisible(index)}
                        style={{ width: 14, height: 14 }}
                      />
                      Visible
                    </label>
                  </div>

                  {/* Source rows (read-only) */}
                  {sourceRows.length > 0 && (
                    <div style={{ padding: '6px 12px 8px 36px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
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

        {/* Footer hint */}
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '2px' }}>
          Changes are not saved until you click "Save structure". Visit{' '}
          <a href={`/jobs/${jobId}/proposal`} style={{ color: 'inherit' }}>
            Proposal Summary
          </a>{' '}
          to preview the result.
        </div>
      </div>
    </>
  )
}
