import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import JobWorksheetPageOrchestrator from '@/components/patterns/estimate/JobWorksheetPageOrchestrator'
import type { Estimate } from '@/lib/estimateTypes'

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

  const { data: estimates } = await supabase
    .from('estimates')
    .select('id, job_id, title, status, is_change_order, parent_estimate_id, created_by, created_at, updated_at')
    .eq('job_id', id)
    .order('created_at', { ascending: true })

  const activeEstimate = (estimates ?? []).find((e) => e.status === 'active') ?? null

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

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '100%', margin: '0 auto', padding: '0 24px', boxSizing: 'border-box' }}>
        <JobWorksheetPageOrchestrator
          jobId={id}
          jobName={job.job_name}
          activeEstimateId={activeEstimate?.id ?? ''}
          rows={(rows || []) as any}
          estimates={(estimates || []) as Estimate[]}
        />
      </div>
    </div>
  )
}
