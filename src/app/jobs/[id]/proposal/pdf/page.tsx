import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import {
  deriveDefaultStructure,
  reconcileStructure,
  applyStructure,
  type ProposalStructureJson,
  type ProposalStatus,
} from '@/lib/proposalStructure'
import type { Estimate } from '@/lib/estimateTypes'
import { ESTIMATE_SELECT } from '@/lib/estimateTypes'
import { fmtCurrency, fmtQty, fmtUnitPrice, INDENT_PER_DEPTH } from '@/lib/proposalFormatters'
import DocShell from '@/components/pdf/DocShell'
import DocHeader, { type MetaItem } from '@/components/pdf/DocHeader'
import DocSection from '@/components/pdf/DocSection'
import DocLineItemTable, { type DocLineItemRow } from '@/components/pdf/DocLineItemTable'
import DocTotalsBlock from '@/components/pdf/DocTotalsBlock'
import DocFooter from '@/components/pdf/DocFooter'
import PrintButton from '@/components/pdf/PrintButton'

const STATUS_BADGE: Record<ProposalStatus, { bg: string; color: string }> = {
  draft:  { bg: '#f1f5f9', color: '#475569' },
  sent:   { bg: '#fef9c3', color: '#92400e' },
  signed: { bg: '#dbeafe', color: '#1d4ed8' },
  voided: { bg: '#fee2e2', color: '#991b1b' },
}

function fmtGenDate(date: Date): string {
  return (
    date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) +
    ' at ' +
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  )
}

export default async function ProposalPdfPage({ params }: { params: Promise<{ id: string }> }) {
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
  const badge = STATUS_BADGE[proposalStatus]
  const generatedAt = fmtGenDate(new Date())

  const headerMeta: MetaItem[] = [
    ...(activeEstimate ? [{ value: activeEstimate.title }] : []),
    {
      value: proposalStatus.charAt(0).toUpperCase() + proposalStatus.slice(1),
      badge,
    },
  ]

  return (
    <>
      {/* Nav bar — hidden when printing */}
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
          {job.job_name || 'Job'} · Proposal PDF
        </span>
        <PrintButton />
      </div>

      <DocShell>
        <DocHeader
          title={job.job_name || 'Proposal'}
          meta={headerMeta}
          totalLabel={summary.grandTotal > 0 ? 'Total' : undefined}
          totalValue={summary.grandTotal > 0 ? fmtCurrency(summary.grandTotal) : undefined}
        />

        {summary.sections.length === 0 ? (
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
            No worksheet rows found for the active estimate.
          </div>
        ) : (
          summary.sections.map((section) => {
            const tableRows: DocLineItemRow[] = section.items.map((item) => ({
              id: item.id,
              depth: item.depth,
              description: item.description,
              qty: fmtQty(item.quantity, item.unit) || undefined,
              unitPrice: fmtUnitPrice(item.unit_price) || undefined,
              total: item.row_kind !== 'note' && item.lineTotal > 0
                ? fmtCurrency(item.lineTotal)
                : undefined,
              isNote: item.row_kind === 'note',
            }))

            return (
              <DocSection
                key={section.id}
                title={section.description}
                subtotal={section.subtotal > 0 ? fmtCurrency(section.subtotal) : undefined}
              >
                <DocLineItemTable rows={tableRows} indentPerDepth={INDENT_PER_DEPTH} />
              </DocSection>
            )
          })
        )}

        {summary.sections.length > 0 && (
          <DocTotalsBlock
            rows={[{ label: 'Total', value: fmtCurrency(summary.grandTotal), bold: true }]}
          />
        )}

        <DocFooter generatedAt={generatedAt} note="Internal estimate — not a signed contract." />
      </DocShell>
    </>
  )
}
