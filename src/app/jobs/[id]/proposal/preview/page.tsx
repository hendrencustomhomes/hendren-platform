import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { deriveDefaultStructure, reconcileStructure, applyStructure, type ProposalStructureJson, type ProposalStatus } from '@/lib/proposalStructure'
import type { Estimate } from '@/lib/estimateTypes'
import { ESTIMATE_SELECT } from '@/lib/estimateTypes'
import { fmtCurrency, fmtQty, fmtUnitPrice, INDENT_PER_DEPTH } from '@/lib/proposalFormatters'
import type { ProposalSection, ProposalLineItem } from '@/lib/proposalSummary'
import SnapshotCreateButton from '@/components/patterns/proposal/SnapshotCreateButton'

const STATUS_BADGE: Record<ProposalStatus, { bg: string; color: string; label: string }> = {
  draft:  { bg: '#f1f5f9', color: '#475569', label: 'Draft' },
  sent:   { bg: '#fef9c3', color: '#92400e', label: 'Sent' },
  signed: { bg: '#dbeafe', color: '#1d4ed8', label: 'Signed' },
  voided: { bg: '#fee2e2', color: '#991b1b', label: 'Voided' },
}

export default async function ProposalPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: job } = await supabase
    .from('jobs')
    .select('id, job_name')
    .eq('id', id)
    .single()

  if (!job) notFound()

  const { data: estimatesRaw } = await supabase
    .from('estimates')
    .select(ESTIMATE_SELECT)
    .eq('job_id', id)
    .order('created_at', { ascending: true })

  const estimates = (estimatesRaw ?? []) as Estimate[]
  const activeEstimate = estimates.find((e) => e.status === 'active') ?? null

  const [{ data: rowsRaw }, { data: structureRecord }, { data: latestDocRaw }] = await Promise.all([
    activeEstimate
      ? supabase
          .from('job_worksheet_items')
          .select('*')
          .eq('estimate_id', activeEstimate.id)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] }),
    activeEstimate
      ? supabase
          .from('proposal_structures')
          .select('structure_json, proposal_status, locked_at')
          .eq('estimate_id', activeEstimate.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    activeEstimate
      ? supabase
          .from('proposal_documents')
          .select('id, doc_status, created_at')
          .eq('estimate_id', activeEstimate.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const worksheetRows = (rowsRaw ?? []) as any
  const proposalStatus = ((structureRecord as any)?.proposal_status ?? 'draft') as ProposalStatus
  const isLocked = !!((structureRecord as any)?.locked_at)

  let structure: ProposalStructureJson
  if (!(structureRecord as any)?.structure_json) {
    structure = deriveDefaultStructure(worksheetRows)
  } else if (isLocked) {
    structure = (structureRecord as any).structure_json
  } else {
    structure = reconcileStructure((structureRecord as any).structure_json, worksheetRows)
  }

  const summary = applyStructure(structure, worksheetRows)
  const badge = STATUS_BADGE[proposalStatus]
  const latestDoc = latestDocRaw as { id: string; doc_status: string; created_at: string } | null

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh' }}>
      {/* Slim nav */}
      <div
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <a
          href={`/jobs/${id}/proposal`}
          style={{ fontSize: '20px', color: 'var(--text-muted)', textDecoration: 'none', lineHeight: 1, flexShrink: 0 }}
        >
          ‹
        </a>
        <span style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {job.job_name || 'Job'} · Proposal Preview
        </span>
        <a
          href={`/jobs/${id}/proposal/builder`}
          style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
        >
          {isLocked ? 'View structure →' : 'Edit structure →'}
        </a>
        <a
          href={`/jobs/${id}/proposal/pdf`}
          style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
        >
          PDF →
        </a>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '760px', margin: '0 auto' }}>

        {/* Header */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700 }}>{job.job_name || 'Proposal'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                {activeEstimate && (
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{activeEstimate.title}</span>
                )}
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
            </div>
            {summary.grandTotal > 0 && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Total</div>
                <div style={{ fontSize: '24px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCurrency(summary.grandTotal)}
                </div>
              </div>
            )}
          </div>
          {activeEstimate && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {latestDoc && (
                <a
                  href={`/jobs/${id}/proposal/documents/${latestDoc.id}`}
                  style={{ fontSize: '12px', color: 'var(--text-muted)' }}
                >
                  Latest snapshot →
                </a>
              )}
              {proposalStatus !== 'voided' && (
                <SnapshotCreateButton estimateId={activeEstimate.id} jobId={id} />
              )}
            </div>
          )}
        </div>

        {/* Sections */}
        {summary.sections.length === 0 ? (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px',
            }}
          >
            No worksheet rows found for the active estimate.
          </div>
        ) : (
          summary.sections.map((section) => (
            <div
              key={section.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              {/* Section header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'var(--surface-alt, var(--surface))',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {section.description}
                </span>
                {section.subtotal > 0 && (
                  <span style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {fmtCurrency(section.subtotal)}
                  </span>
                )}
              </div>

              {/* Column headers */}
              {section.items.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 100px 80px 90px',
                    gap: '8px',
                    padding: '5px 16px',
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span>Description</span>
                  <span style={{ textAlign: 'right' }}>Qty / Unit</span>
                  <span style={{ textAlign: 'right' }}>Unit Price</span>
                  <span style={{ textAlign: 'right' }}>Total</span>
                </div>
              )}

              {/* Line items */}
              {section.items.map((item) => {
                const isNote = item.row_kind === 'note'
                const indent = item.depth * INDENT_PER_DEPTH
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 100px 80px 90px',
                      gap: '8px',
                      padding: '7px 16px',
                      fontSize: '12px',
                      borderBottom: '1px solid var(--border)',
                      alignItems: 'baseline',
                      color: isNote ? 'var(--text-muted)' : 'var(--text)',
                    }}
                  >
                    <span style={{ paddingLeft: `${indent}px`, fontStyle: isNote ? 'italic' : undefined }}>
                      {item.description}
                    </span>
                    <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>{fmtQty(item.quantity, item.unit)}</span>
                    <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>{isNote ? '' : fmtUnitPrice(item.unit_price)}</span>
                    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {isNote || item.lineTotal === 0 ? '' : fmtCurrency(item.lineTotal)}
                    </span>
                  </div>
                )
              })}
            </div>
          ))
        )}

        {/* Grand total */}
        {summary.sections.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '12px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '14px',
            }}
          >
            <span>Total</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(summary.grandTotal)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
