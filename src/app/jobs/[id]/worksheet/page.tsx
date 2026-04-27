import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import JobWorksheetPageOrchestrator from '@/components/patterns/estimate/JobWorksheetPageOrchestrator'

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

  const { data: rows, error } = await supabase
    .from('job_worksheet_items')
    .select('*')
    .eq('job_id', id)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('job_worksheet_items load failed:', error)
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        <JobWorksheetPageOrchestrator
          jobId={id}
          jobName={job.job_name}
          rows={(rows || []) as any}
        />
      </div>
    </div>
  )
}
