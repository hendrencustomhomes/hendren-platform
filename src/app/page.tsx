import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      id, client_name, address, color, current_stage,
      pm_id, created_at, is_active,
      profiles!jobs_pm_id_fkey(full_name),
      issues(id, severity, resolved),
      price_sheet_items(id)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const jobList = jobs || []

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f7f6f3', minHeight: '100vh' }}>
      {/* Topbar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2dfd8', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontSize: '15px', fontWeight: '700' }}>Dashboard</div>
        <form action="/api/auth/signout" method="POST">
          <button type="submit" style={{ padding: '6px 12px', background: 'none', border: '1px solid #ccc', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#666' }}>
            Sign out
          </button>
        </form>
      </div>

      <div style={{ padding: '14px' }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
          {[
            { label: 'Active Jobs', value: jobList.length, color: '#1a1a18' },
            { label: 'Critical', value: jobList.filter(j => (j.issues || []).some((i: any) => i.severity === 'Critical' && !i.resolved)).length, color: '#dc2626' },
            { label: 'Warnings', value: jobList.filter(j => (j.issues || []).some((i: any) => i.severity === 'Warning' && !i.resolved)).length, color: '#b45309' },
            { label: 'No Takeoff', value: jobList.filter(j => (j.price_sheet_items || []).length === 0).length, color: '#2563eb' },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#fff', border: '1px solid #e2dfd8', borderRadius: '10px', padding: '13px 14px' }}>
              <div style={{ fontSize: '10px', color: '#777', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>{stat.label}</div>
              <div style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.02em', color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Jobs list */}
        <div style={{ background: '#fff', border: '1px solid #e2dfd8', borderRadius: '10px' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2dfd8', fontSize: '13px', fontWeight: '700', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Jobs by Stage
            <a href="/jobs/new" style={{ fontSize: '12px', fontWeight: '600', background: '#1a1a18', color: '#fff', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>+ New Job</a>
          </div>
          {jobList.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#888' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏠</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a18', marginBottom: '4px' }}>No jobs yet</div>
              <div style={{ fontSize: '12px' }}>Click "+ New Job" to create your first job.</div>
            </div>
          ) : jobList.map((job: any) => {
            const openIssues = (job.issues || []).filter((i: any) => !i.resolved)
            const hasCritical = openIssues.some((i: any) => i.severity === 'Critical')
            const stageLabels: Record<string, string> = {
              intake: 'Intake', takeoff: 'Takeoff', estimate: 'Estimate',
              contract: 'Contract', selections: 'Selections', procurement: 'Procurement',
              schedule: 'Schedule', draws: 'Draws', construction: 'Build'
            }
            return (
              <a key={job.id} href={`/jobs/${job.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid #f0ede8', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ width: '3px', height: '34px', borderRadius: '2px', background: job.color || '#3B8BD4', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>{job.client_name}</div>
                  <div style={{ fontSize: '11px', color: '#777', fontFamily: 'ui-monospace, monospace', marginTop: '1px' }}>{job.address}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 6px', borderRadius: '3px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontFamily: 'ui-monospace, monospace' }}>
                    {stageLabels[job.current_stage] || job.current_stage}
                  </span>
                  <div style={{ fontSize: '10px', color: '#777', marginTop: '2px' }}>{(job.profiles as any)?.full_name || 'Unassigned'}</div>
                  {hasCritical && <span style={{ fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '3px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontFamily: 'ui-monospace, monospace', display: 'block', marginTop: '2px' }}>Critical</span>}
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
