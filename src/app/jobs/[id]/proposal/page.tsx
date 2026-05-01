import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { buildProposalSummary, type ProposalSection, type ProposalLineItem } from '@/lib/proposalSummary'
import type { Estimate } from '@/lib/estimateTypes'

function fmtCurrency(val: number): string {
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtQty(quantity: number | string | null, unit: string | null): string {
  if (quantity == null || quantity === '') return ''
  const q = Number(quantity)
  if (Number.isNaN(q)) return ''
  return unit ? `${q} ${unit}` : String(q)
}

function fmtUnitPrice(val: number | string | null): string {
  if (val == null || val === '') return ''
  const n = Number(val)
  if (Number.isNaN(n) || n === 0) return ''
  return '$' + n.toFixed(2)
}

const INDENT_PER_DEPTH = 16

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
    .select('id, job_id, title, status, is_change_order, parent_estimate_id, created_by, created_at, updated_at')
    .eq('job_id', id)
    .order('created_at', { ascending: true })

  const estimates = (estimatesRaw ?? []) as Estimate[]
  const activeEstimate = estimates.find((e) => e.status === 'active') ?? null

  const { data: rowsRaw } = activeEstimate
    ? await supabase
        .from('job_worksheet_items')
        .select('*')
        .eq('estimate_id', activeEstimate.id)
        .order('sort_order', { ascending: true })
    : { data: [] }

  const summary = buildProposalSummary((rowsRaw ?? []) as any)

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
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {activeEstimate ? activeEstimate.title : 'No active estimate'} · Read-only
            </div>
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
