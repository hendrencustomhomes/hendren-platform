import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'

const STAGE_LABELS: Record<string,string> = {intake:'Intake',takeoff:'Takeoff',estimate:'Estimate',contract:'Contract',selections:'Selections',procurement:'Procurement',schedule:'Schedule',draws:'Draws',construction:'Build'}

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: jobs } = await supabase
    .from('jobs')
    .select(`id, client_name, address, color, current_stage, created_at, is_active, profiles!jobs_pm_id_fkey(full_name), issues(id, severity, resolved)`)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const jobList = jobs || []
  const criticalJobs = jobList.filter(j => (j.issues||[]).some((i:any) => i.severity === 'Critical' && !i.resolved))

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <Nav title="Dashboard" />

      <div style={{ padding: '14px', maxWidth: '900px', margin: '0 auto' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '14px' }}>
          {[
            { label: 'Active Jobs', value: jobList.length, color: 'var(--text)' },
            { label: 'Critical', value: criticalJobs.length, color: 'var(--red)' },
            { label: 'In Progress', value: jobList.filter(j => j.current_stage !== 'intake').length, color: 'var(--blue)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '13px 14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Jobs list */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '13px', fontWeight: '700' }}>Jobs</div>
            <a href="/jobs/new" style={{ fontSize: '12px', fontWeight: '600', background: 'var(--text)', color: 'var(--bg)', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>+ New Job</a>
          </div>
          {jobList.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏠</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>No jobs yet</div>
              <div style={{ fontSize: '12px' }}>Click "+ New Job" to get started</div>
            </div>
          ) : jobList.map((job: any) => {
            const openIssues = (job.issues||[]).filter((i:any) => !i.resolved)
            const hasCritical = openIssues.some((i:any) => i.severity === 'Critical')
            return (
              <a key={job.id} href={`/jobs/${job.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 16px', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ width: '3px', height: '36px', borderRadius: '2px', background: job.color || '#3B8BD4', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>{job.client_name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.address}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '10px', background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid var(--blue)', fontFamily: 'ui-monospace,monospace' }}>
                    {STAGE_LABELS[job.current_stage] || job.current_stage}
                  </span>
                  {hasCritical && <div style={{ fontSize: '10px', color: 'var(--red)', marginTop: '2px', fontWeight: '600' }}>⚠ Critical</div>}
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
