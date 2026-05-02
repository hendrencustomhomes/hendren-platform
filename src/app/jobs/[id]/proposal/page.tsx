import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { type ProposalSection, type ProposalLineItem } from '@/lib/proposalSummary'
import { deriveDefaultStructure, reconcileStructure, applyStructure, type ProposalStructureJson, type ProposalStatus } from '@/lib/proposalStructure'
import type { Estimate } from '@/lib/estimateTypes'
import { ESTIMATE_SELECT } from '@/lib/estimateTypes'

import { fmtCurrency, fmtQty, fmtUnitPrice, INDENT_PER_DEPTH } from '@/lib/proposalFormatters'

function SectionHeader({ section }: { section: ProposalSection }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: '12px',
        padding: '10px 12px',
        background: 'var(--surface-alt, var(--surface))',
        borderBottom: '1px solid var(--border)',
        fontWeight: 700,
        fontSize: '13px',
      }}
    >
      <span>{section.description}</span>
      {section.subtotal > 0 && (
        <span style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontWeight: 400, fontSize: '12px' }}>
          {fmtCurrency(section.subtotal)}
        </span>
      )}
    </div>
  )
}

function LineItemRow({ item }: { item: ProposalLineItem }) {
  const isNote = item.row_kind === 'note'
  const indent = item.depth * INDENT_PER_DEPTH

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 100px 80px 90px',
        gap: '8px',
        padding: '7px 12px',
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
}

function ColumnHeaders() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 100px 80px 90px',
        gap: '8px',
        padding: '6px 12px',
        fontSize: '10px',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderBottom: '1px solid var(--border)',
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      <span>Description</span>
      <span style={{ textAlign: 'right' }}>Qty / Unit</span>
      <span style={{ textAlign: 'right' }}>Unit Price</span>
      <span style={{ textAlign: 'right' }}>Total</span>
    </div>
  )
}

export default async function ProposalSummaryPage({ params }: { params: Promise<{ id: string }> }) {
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

  const [{ data: rowsRaw }, { data: structureRecord }] = await Promise.all([
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

  return (
    <PageShell title={`${job.job_name || 'Job'} · Proposal Summary`} back={`/jobs/${id}`}>
      <div style={{ display: 'grid', gap: '12px' }}>
        {/* Header card */}
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
          }}
        >
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>Proposal Summary</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {activeEstimate ? activeEstimate.title : 'No active estimate'} · Read-only
              </span>
              {activeEstimate && (
                <span style={{
                  fontSize: '10px',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  background:
                    proposalStatus === 'signed' ? '#dbeafe' :
                    proposalStatus === 'sent' ? '#fef9c3' :
                    proposalStatus === 'voided' ? '#fee2e2' : '#f1f5f9',
                  color:
                    proposalStatus === 'signed' ? '#1d4ed8' :
                    proposalStatus === 'sent' ? '#92400e' :
                    proposalStatus === 'voided' ? '#991b1b' : '#475569',
                }}>
                  {proposalStatus}
                </span>
              )}
            </div>
            {activeEstimate && (
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <a href={`/jobs/${id}/proposal/builder`} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {isLocked ? 'View structure →' : 'Customize structure →'}
                </a>
                <a href={`/jobs/${id}/proposal/preview`} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Preview →
                </a>
                <a href={`/jobs/${id}/proposal/pdf`} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  PDF →
                </a>
              </div>
            )}
          </div>
          {summary.grandTotal > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Estimate Total</div>
              <div style={{ fontSize: '20px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {fmtCurrency(summary.grandTotal)}
              </div>
            </div>
          )}
        </div>

        {/* Summary table */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {summary.sections.length === 0 ? (
            <div
              style={{
                padding: '40px 24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}
            >
              No worksheet rows found for the active estimate.
            </div>
          ) : (
            <>
              <ColumnHeaders />
              {summary.sections.map((section) => (
                <div key={section.id}>
                  <SectionHeader section={section} />
                  {section.items.map((item) => (
                    <LineItemRow key={item.id} item={item} />
                  ))}
                </div>
              ))}

              {/* Grand total footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  padding: '12px',
                  borderTop: '2px solid var(--border)',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                <span>Total</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(summary.grandTotal)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  )
}
