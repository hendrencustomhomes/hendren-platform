import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { deriveDefaultStructure, type ProposalStructureJson } from '@/lib/proposalStructure'
import ProposalBuilderOrchestrator from '@/components/patterns/proposal/ProposalBuilderOrchestrator'
import type { Estimate } from '@/lib/estimateTypes'

export default async function ProposalBuilderPage({ params }: { params: Promise<{ id: string }> }) {
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

  if (!activeEstimate) {
    redirect(`/jobs/${id}/proposal`)
  }

  const [{ data: rowsRaw }, { data: structureRecord }] = await Promise.all([
    supabase
      .from('job_worksheet_items')
      .select('*')
      .eq('estimate_id', activeEstimate.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('proposal_structures')
      .select('structure_json')
      .eq('estimate_id', activeEstimate.id)
      .maybeSingle(),
  ])

  const worksheetRows = (rowsRaw ?? []) as any[]
  const structure: ProposalStructureJson =
    (structureRecord as any)?.structure_json ?? deriveDefaultStructure(worksheetRows)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '100%', margin: '0 auto', padding: '0 24px', boxSizing: 'border-box' }}>
        <ProposalBuilderOrchestrator
          jobId={id}
          jobName={job.job_name}
          estimateId={activeEstimate.id}
          estimateTitle={activeEstimate.title}
          worksheetRows={worksheetRows}
          initialStructure={structure}
        />
      </div>
    </div>
  )
}
