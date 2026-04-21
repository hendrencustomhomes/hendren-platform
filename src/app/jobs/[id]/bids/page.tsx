import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import BidsTab from '../BidsTab'

export default async function JobBidsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: job, error: jobError }, { data: trades }, { data: costCodes }] = await Promise.all([
    supabase.from('jobs').select('id, job_name, archived_at').eq('id', id).single(),
    supabase.from('trades').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
    supabase.from('cost_codes').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
  ])

  if (jobError) throw new Error(jobError.message)
  if (!job) notFound()
  if (job.archived_at) redirect('/jobs?view=archived')

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <Nav title={`${job.job_name || 'Job'} Bids`} back={`/jobs/${id}`} jobId={id} />

      <div style={{ padding: '14px', maxWidth: '1080px', margin: '0 auto' }}>
        <BidsTab jobId={id} trades={(trades || []) as any} costCodes={(costCodes || []) as any} />
      </div>
    </div>
  )
}
