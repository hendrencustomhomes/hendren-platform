import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import JobWorksheetPageOrchestrator from '@/components/patterns/estimate/JobWorksheetPageOrchestrator'
import type { Estimate } from '@/lib/estimateTypes'
import { ESTIMATE_SELECT, isEstimateEditable } from '@/lib/estimateTypes'

export default async function JobWorksheetPage({ params }: { params: Promise<{ id: string }> }) {
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

  let estimates = (estimatesRaw ?? []) as Estimate[]
  let activeEstimate = estimates.find((e) => e.status === 'active') ?? null

  // Guard: every worksheet load must have an active estimate.
  // Promote an existing non-archived estimate, or create a new one.
  if (!activeEstimate) {
    const candidate = estimates.find((e) => e.status !== 'archived') ?? estimates[0] ?? null

    if (candidate) {
      await supabase.rpc('set_active_estimate', {
        p_estimate_id: candidate.id,
        p_job_id: id,
      })
      activeEstimate = { ...candidate, status: 'active' }
      estimates = estimates.map((e) =>
        e.id === candidate.id ? activeEstimate! : { ...e, status: e.status === 'active' ? 'draft' : e.status }
      )
    } else {
      const { data: created } = await supabase
        .from('estimates')
        .insert({ job_id: id, title: 'Base Estimate', status: 'active', created_by: user.id })
        .select(ESTIMATE_SELECT)
        .single()

      if (created) {
        activeEstimate = created as Estimate
        estimates = [activeEstimate]
      }
    }
  }

  const { data: rows, error: rowsError } = activeEstimate
    ? await supabase
        .from('job_worksheet_items')
        .select('*')
        .eq('estimate_id', activeEstimate.id)
        .order('sort_order', { ascending: true })
    : { data: [], error: null }

  if (rowsError) {
    console.error('job_worksheet_items load failed:', rowsError)
  }

  const isLocked = !activeEstimate || !isEstimateEditable(activeEstimate)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '100%', margin: '0 auto', padding: '0 24px', boxSizing: 'border-box' }}>
        <JobWorksheetPageOrchestrator
          jobId={id}
          jobName={job.job_name}
          activeEstimateId={activeEstimate?.id ?? ''}
          rows={(rows || []) as any}
          estimates={estimates}
          isLocked={isLocked}
        />
      </div>
    </div>
  )
}
