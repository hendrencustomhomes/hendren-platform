import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { deriveDefaultStructure, reconcileStructure, type ProposalStructureJson, type ProposalStatus } from '@/lib/proposalStructure'
import ProposalBuilderOrchestrator from '@/components/patterns/proposal/ProposalBuilderOrchestrator'
import type { Estimate } from '@/lib/estimateTypes'
import { ESTIMATE_SELECT } from '@/lib/estimateTypes'

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
    .select(ESTIMATE_SELECT)
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
      .select('structure_json, proposal_status, locked_at')
      .eq('estimate_id', activeEstimate.id)
      .maybeSingle(),
  ])

  const worksheetRows = (rowsRaw ?? []) as any[]
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
          proposalStatus={proposalStatus}
          isLocked={isLocked}
        />
      </div>
    </div>
  )
}
