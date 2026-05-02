import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { fmtCurrency, fmtQty, fmtUnitPrice, INDENT_PER_DEPTH } from '@/lib/proposalFormatters'
import type { ProposalDocumentRecord, ProposalDocStatus } from '@/lib/proposalSnapshot'
import DocShell from '@/components/pdf/DocShell'
import DocHeader from '@/components/pdf/DocHeader'
import DocSection from '@/components/pdf/DocSection'
import DocLineItemTable, { type DocLineItemRow } from '@/components/pdf/DocLineItemTable'
import DocTotalsBlock from '@/components/pdf/DocTotalsBlock'
import DocFooter from '@/components/pdf/DocFooter'
import PrintButton from '@/components/pdf/PrintButton'

const STATUS_BADGE: Record<ProposalDocStatus, { bg: string; color: string; label: string }> = {
  draft_snapshot: { bg: '#f1f5f9', color: '#475569', label: 'Draft Snapshot' },
  sent:           { bg: '#fef9c3', color: '#92400e', label: 'Sent' },
  signed:         { bg: '#dbeafe', color: '#1d4ed8', label: 'Signed' },
  voided:         { bg: '#fee2e2', color: '#991b1b', label: 'Voided' },
}

function fmtTs(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  )
}

export default async function ProposalDocumentPage({
  params,
}: {
  params: Promise<{ id: string; documentId: string }>
}) {
  const { id, documentId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: raw } = await supabase
    .from('proposal_documents')
    .select('*')
    .eq('id', documentId)
    .eq('job_id', id)
    .single()

  if (!raw) notFound()

  const doc = raw as ProposalDocumentRecord
  const snap = doc.snapshot_json
  const badge = STATUS_BADGE[doc.doc_status] ?? STATUS_BADGE.draft_snapshot

  return (
    <>
      {/* Nav — hidden when printing */}
      <div
        className="doc-no-print"
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
          href={`/jobs/${id}/proposal/preview`}
          style={{ fontSize: '20px', color: 'var(--text-muted)', textDecoration: 'none', lineHeight: 1, flexShrink: 0 }}
        >
          ‹
        </a>
        <span
          style={{
            flex: 1,
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {snap.job_name || 'Job'} · Proposal Snapshot
        </span>
        <PrintButton />
      </div>

      {/* Voided notice */}
      {doc.doc_status === 'voided' && (
        <div
          className="doc-no-print"
          style={{
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '12px',
            color: '#991b1b',
            margin: '12px 16px 0',
          }}
        >
          This document has been voided
          {doc.voided_at ? ` on ${fmtTs(doc.voided_at)}` : ''}.
          The snapshot content is preserved below for reference.
        </div>
      )}

      <DocShell>
        <DocHeader
          title={snap.job_name || 'Proposal'}
          meta={[
            ...(snap.estimate_title ? [{ value: snap.estimate_title }] : []),
            { value: badge.label, badge: { bg: badge.bg, color: badge.color } },
          ]}
          totalLabel={snap.grand_total > 0 ? 'Total' : undefined}
          totalValue={snap.grand_total > 0 ? fmtCurrency(snap.grand_total) : undefined}
        />

        {snap.sections.length === 0 ? (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
            }}
          >
            No sections were captured in this snapshot.
          </div>
        ) : (
          snap.sections.map((section) => {
            const tableRows: DocLineItemRow[] = section.items.map((item) => ({
              id: item.id,
              depth: item.depth,
              description: item.description,
              qty: fmtQty(item.quantity, item.unit) || undefined,
              unitPrice: fmtUnitPrice(item.unit_price) || undefined,
              total:
                item.row_kind !== 'note' && item.line_total > 0
                  ? fmtCurrency(item.line_total)
                  : undefined,
              isNote: item.row_kind === 'note',
            }))

            return (
              <DocSection
                key={section.id}
                title={section.title}
                subtotal={section.subtotal > 0 ? fmtCurrency(section.subtotal) : undefined}
              >
                <DocLineItemTable rows={tableRows} indentPerDepth={INDENT_PER_DEPTH} />
              </DocSection>
            )
          })
        )}

        {snap.grand_total > 0 && (
          <DocTotalsBlock
            rows={[{ label: 'Total', value: fmtCurrency(snap.grand_total), bold: true }]}
          />
        )}

        <DocFooter
          generatedAt={fmtTs(snap.captured_at)}
          note="Snapshot — reflects estimate at time of capture."
        />
      </DocShell>
    </>
  )
}
