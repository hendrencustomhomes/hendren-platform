'use client'

import FilesTab from '@/components/FilesTab'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const REFERRAL_OPTIONS = [
  'Past Client',
  'Realtor',
  'Architect',
  'Designer',
  'Website',
  'Yard Sign',
  'Social Media',
  'Walk-in',
  'Other',
]

type Props = {
  jobId: string
  job: any
  stageItems: Record<string, any[]>
  checkedMap: Record<string, boolean>
  stateMap: Record<string, string>
  issues: any[]
  logs: any[]
  subs: any[]
  orders: any[]
  selections: any[]
  takeoffItems: any[]
  estimates: any[]
  files: any[]
  stages: string[]
  stageLabels: Record<string, string>
  stageIcons: Record<string, string>
  statusColors: Record<string, string>
  userId: string
  canEditInfo: boolean
  pmOptions: { id: string; full_name: string | null }[]
}

export default function JobTabs(props: Props) {
  const {
    jobId,
    job,
    stageItems,
    checkedMap: initChecked,
    stateMap: initState,
    issues: initIssues,
    logs: initLogs,
    subs,
    orders,
    files,
    stages,
    stageLabels,
    stageIcons,
    statusColors,
    userId,
    canEditInfo,
    pmOptions,
  } = props

  const router = useRouter()
  const supabase = createClient()

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'

  const [tab, setTab] = useState('checklist')
  const [checked, setChecked] = useState<Record<string, boolean>>(initChecked)
  const [stateMap, setStateMap] = useState<Record<string, string>>(initState)
  const [issues, setIssues] = useState<any[]>(initIssues)
  const [logs, setLogs] = useState<any[]>(initLogs)
  const [logText, setLogText] = useState('')
  const [logSaving, setLogSaving] = useState(false)
  const [issueTitle, setIssueTitle] = useState('')
  const [issueSeverity, setIssueSeverity] = useState('Warning')
  const [issueDetail, setIssueDetail] = useState('')
  const [issueSaving, setIssueSaving] = useState(false)
  const [showIssueForm, setShowIssueForm] = useState(false)

  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [infoDraft, setInfoDraft] = useState({
    job_name: '',
    project_address: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    sqft: '',
    lot_sqft: '',
    referral_source: '',
    contract_type: 'fixed_price',
    pm_id: '',
    scope_notes: '',
  })

  const curIdx = stages.indexOf(job.current_stage)

  const inp = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid var(--border)',
    borderRadius: '7px',
    fontSize: '12px',
    fontFamily: 'ui-monospace,monospace',
    boxSizing: 'border-box' as const,
    outline: 'none',
    background: 'var(--surface)',
    color: 'var(--text)',
  }

  function startInfoEdit() {
    setInfoDraft({
      job_name: job.job_name ?? '',
      project_address: job.project_address ?? '',
      client_name: job.client_name ?? '',
      client_email: job.client_email ?? '',
      client_phone: job.client_phone ?? '',
      sqft: job.sqft?.toString() ?? '',
      lot_sqft: job.lot_sqft?.toString() ?? '',
      referral_source: job.referral_source ?? '',
      contract_type: job.contract_type ?? 'fixed_price',
      pm_id: job.pm_id ?? '',
      scope_notes: job.scope_notes ?? '',
    })
    setInfoError(null)
    setIsEditingInfo(true)
  }

  function cancelInfoEdit() {
    setIsEditingInfo(false)
    setInfoError(null)
    setInfoDraft({
      job_name: '',
      project_address: '',
      client_name: '',
      client_email: '',
      client_phone: '',
      sqft: '',
      lot_sqft: '',
      referral_source: '',
      contract_type: 'fixed_price',
      pm_id: '',
      scope_notes: '',
    })
  }

  function parseNumberOrNull(value: string) {
    if (!value.trim()) return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }

  async function saveInfo() {
    setInfoSaving(true)
    setInfoError(null)

    const payload = {
      job_name: infoDraft.job_name.trim() || null,
      project_address: infoDraft.project_address.trim() || null,
      client_name: infoDraft.client_name.trim() || null,
      client_email: infoDraft.client_email.trim() || null,
      client_phone: infoDraft.client_phone.trim() || null,
      sqft: parseNumberOrNull(infoDraft.sqft),
      lot_sqft: parseNumberOrNull(infoDraft.lot_sqft),
      referral_source: infoDraft.referral_source || null,
      contract_type: infoDraft.contract_type,
      pm_id: infoDraft.pm_id || null,
      scope_notes: infoDraft.scope_notes.trim() || null,
    }

    const { error } = await supabase.from('jobs').update(payload).eq('id', job.id)

    setInfoSaving(false)

    if (error) {
      setInfoError('Failed to save info')
      return
    }

    cancelInfoEdit()
    router.refresh()
  }

  async function toggleCheck(itemId: string, val: boolean) {
    setChecked((c) => ({ ...c, [itemId]: val }))
    const existingId = stateMap[itemId]
    if (existingId) {
      await supabase.from('job_checklist_state').update({ is_checked: val }).eq('id', existingId)
    } else {
      const { data } = await supabase
        .from('job_checklist_state')
        .insert({ job_id: jobId, checklist_item_id: itemId, is_checked: val })
        .select()
        .single()
      if (data) setStateMap((m) => ({ ...m, [itemId]: data.id }))
    }
  }

  async function addLog() {
    if (!logText.trim()) return
    setLogSaving(true)
    const { data } = await supabase
      .from('job_logs')
      .insert({ job_id: jobId, body: logText.trim(), author_id: userId })
      .select('*, profiles(full_name)')
      .single()
    setLogSaving(false)
    if (data) {
      setLogs((l) => [data, ...l])
      setLogText('')
    }
  }

  async function addIssue() {
    if (!issueTitle.trim()) return
    setIssueSaving(true)
    const { data } = await supabase
      .from('issues')
      .insert({
        job_id: jobId,
        title: issueTitle.trim(),
        severity: issueSeverity,
        detail: issueDetail.trim() || null,
        stage: job.current_stage,
      })
      .select()
      .single()
    setIssueSaving(false)
    if (data) {
      setIssues((i) => [data, ...i])
      setIssueTitle('')
      setIssueDetail('')
      setShowIssueForm(false)
    }
  }

  async function resolveIssue(issueId: string) {
    await supabase
      .from('issues')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', issueId)
    setIssues((i) => i.map((x) => (x.id === issueId ? { ...x, resolved: true } : x)))
  }

  const TABS = ['info', 'checklist', 'log', 'issues', 'subs', 'orders', 'files']
  const TAB_LABELS: Record<string, string> = {
    info: 'Info',
    checklist: 'Checklist',
    log: 'Log',
    issues: `Issues${issues.filter((i) => !i.resolved).length ? ' (' + issues.filter((i) => !i.resolved).length + ')' : ''}`,
    subs: 'Subs',
    orders: 'Orders',
    files: 'Files',
  }

  return (
    <div>
      <div style={{ display:'flex', gap:'2px', borderBottom:'1px solid var(--border)', marginBottom:'12px', overflowX:'auto' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => {
              if (tab === 'info' && t !== 'info' && isEditingInfo) cancelInfoEdit()
              setTab(t)
            }}
            style={{
              padding:'8px 14px',
              border:'none',
              background:'none',
              cursor:'pointer',
              fontSize:'12px',
              fontWeight:'600',
              color:tab===t?'var(--text)':'var(--text-muted)',
              borderBottom:`2px solid ${tab===t?'var(--text)':'transparent'}`,
              fontFamily:'system-ui,-apple-system,sans-serif',
              whiteSpace:'nowrap',
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {canEditInfo && (
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px' }}>
              {!isEditingInfo ? (
                <button onClick={startInfoEdit} style={{ padding:'7px 14px', background:'var(--text)', color:'var(--bg)', border:'none', borderRadius:'7px', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>
                  Edit
                </button>
              ) : (
                <>
                  <button onClick={cancelInfoEdit} disabled={infoSaving} style={{ padding:'7px 14px', border:'1px solid var(--border)', background:'none', color:'var(--text-muted)', borderRadius:'7px', fontSize:'12px', fontWeight:'600', cursor:infoSaving?'not-allowed':'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={saveInfo} disabled={infoSaving} style={{ padding:'7px 14px', background:infoSaving?'var(--border)':'var(--text)', color:'var(--bg)', border:'none', borderRadius:'7px', fontSize:'12px', fontWeight:'600', cursor:infoSaving?'not-allowed':'pointer' }}>
                    {infoSaving ? 'Saving...' : 'Save'}
                  </button>
                </>
              )}
            </div>
          )}

          {isEditingInfo && infoError && (
            <div style={{ background:'var(--red-bg)', border:'1px solid var(--red)', color:'var(--red)', borderRadius:'8px', padding:'10px 12px', fontSize:'12px' }}>
              {infoError}
            </div>
          )}

          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 14px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'8px' }}>Job</div>

            <div style={{ fontSize:'12px', marginBottom:'10px' }}>
              <strong>Job Name:</strong>{' '}
              {!isEditingInfo ? (
                job.job_name || '—'
              ) : (
                <input
                  value={infoDraft.job_name}
                  onChange={(e) => setInfoDraft((d) => ({ ...d, job_name: e.target.value }))}
                  style={inp}
                />
              )}
            </div>

            <div style={{ fontSize:'12px' }}>
              <strong>Project Address:</strong>{' '}
              {!isEditingInfo ? (
                job.project_address || '—'
              ) : (
                <input
                  value={infoDraft.project_address}
                  onChange={(e) => setInfoDraft((d) => ({ ...d, project_address: e.target.value }))}
                  style={inp}
                />
              )}
            </div>
          </div>

          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 14px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'8px' }}>Client</div>

            <div style={{ fontSize:'12px', marginBottom:'10px' }}>
              <strong>Client Name:</strong>{' '}
              {!isEditingInfo ? (
                job.client_name || '—'
              ) : (
                <input
                  value={infoDraft.client_name}
                  onChange={(e) => setInfoDraft((d) => ({ ...d, client_name: e.target.value }))}
                  style={inp}
                />
              )}
            </div>

            <div style={{ fontSize:'12px', marginBottom:'10px' }}>
              <strong>Email:</strong>{' '}
              {!isEditingInfo ? (
                job.client_email || '—'
              ) : (
                <input
                  type="email"
                  autoComplete="email"
                  value={infoDraft.client_email}
                  onChange={(e) => setInfoDraft((d) => ({ ...d, client_email: e.target.value }))}
                  style={inp}
                />
              )}
            </div>

            <div style={{ fontSize:'12px' }}>
              <strong>Phone:</strong>{' '}
              {!isEditingInfo ? (
                job.client_phone || '—'
              ) : (
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={infoDraft.client_phone}
                  onChange={(e) => setInfoDraft((d) => ({ ...d, client_phone: e.target.value }))}
                  style={inp}
                />
              )}
            </div>
          </div>

          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 14px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'8px' }}>Project</div>

            <div style={{ fontSize:'12px', marginBottom:'10px' }}>
              <strong>Sq Ft:</strong>{' '}
              {!isEditingInfo ? (
                job.sqft || '—'
              ) : (
                <input
                  type="number"
                  inputMode="numeric"
                  autoComplete="off"
                  value={infoDraft.sqft}
                  onChange={(e) => setInfoDraft((d) => ({ ...d, sqft: e.target.value }))}
                  style={inp}
                />
              )}
            </div>

            <div style={{ fontSize:'12px', marginBottom:'10px' }}>
              <strong>Lot Sq Ft:</strong>{' '}
              {!isEditingInfo ? (
                job.lot_sqft || '—'
              ) : (
                <input
                  type="number"
                  inputMode="numeric"
                  autoComplete="off"
                  value={infoDraft.lot_sqft}
                  onChange={(e) => setInfoDraft((d) => ({ ...d, lot_sqft: e.target.value }))}
                  style={inp}
                />
              )}
            </div>

            <div style={{ fontSize:'12px', marginBottom:'10px' }}>
              <strong>Referral:</strong>{' '}
              {!isEditingInfo ? (
                job.referral_source || '—'
              ) : (
                <select
                  value={infoDraft.referral_source}
                  onChange={(e) => setInfoDraft((d) => ({ ...d, referral_source: e.target.value }))}
                  style={inp}
                >
                  <option value="">Select referral</option>
                  {REFERRAL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ fontSize:'12px' }}>
              <strong>Contract:</strong>{' '}
              {!isEditingInfo ? (
                job.contract_type === 'cost_plus' ? 'Cost Plus' : 'Fixed Price'
              ) : (
                <select
                  value={infoDraft.contract_type}
                  onChange={(e) => setInfoDraft((d) => ({ ...d, contract_type: e.target.value }))}
                  style={inp}
                >
                  <option value="fixed_price">Fixed Price</option>
                  <option value="cost_plus">Cost Plus</option>
                </select>
              )}
            </div>
          </div>

          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 14px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'8px' }}>Project Manager</div>

            <div style={{ fontSize:'12px', marginBottom:'6px' }}>
              <strong>PM:</strong>{' '}
              {!isEditingInfo ? (
                (job.profiles as any)?.full_name || '—'
              ) : (
                <select
                  value={infoDraft.pm_id}
                  onChange={(e) => setInfoDraft((d) => ({ ...d, pm_id: e.target.value }))}
                  style={inp}
                >
                  <option value="">Select project manager</option>
                  {pmOptions.map((pm) => (
                    <option key={pm.id} value={pm.id}>{pm.full_name || 'Unnamed User'}</option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ fontSize:'12px' }}>
              <strong>Phone:</strong> {(job.profiles as any)?.phone || '—'}
            </div>
          </div>

          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 14px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'8px' }}>Operational</div>
            <div style={{ fontSize:'12px', marginBottom:'10px' }}>
              <strong>Stage:</strong> {job.current_stage}
            </div>
            <div style={{ fontSize:'12px' }}>
              <strong>Scope:</strong>{' '}
              {!isEditingInfo ? (
                job.scope_notes || '—'
              ) : (
                <div style={{ marginTop:'6px' }}>
                  <textarea
                    value={infoDraft.scope_notes}
                    onChange={(e) => setInfoDraft((d) => ({ ...d, scope_notes: e.target.value }))}
                    style={{ ...inp, minHeight:'60px', resize:'vertical' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'checklist' && (
        <div>
          {stages.map((stage) => {
            const items = stageItems[stage] || []
            if (!items.length) return null
            const i = stages.indexOf(stage)
            const done = i < curIdx
            const active = i === curIdx
            const checkedCount = items.filter((it: any) => checked[it.id]).length
            const pct = items.length ? Math.round((checkedCount / items.length) * 100) : 0

            return (
              <div key={stage} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 14px', marginBottom:'8px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                  <span style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.05em', color:done?'var(--green)':active?'var(--blue)':'var(--text-faint)' }}>
                    {stageIcons[stage]} {stageLabels[stage]}
                  </span>
                  <span style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'ui-monospace,monospace' }}>
                    {checkedCount}/{items.length}
                  </span>
                </div>
                <div style={{ height:'3px', background:'var(--border)', borderRadius:'2px', marginBottom:'8px', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:done?'var(--green)':active?'var(--blue)':'var(--border)', borderRadius:'2px' }} />
                </div>
                {items.map((item: any) => (
                  <div key={item.id} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'4px 5px', borderRadius:'5px' }}>
                    <input
                      type="checkbox"
                      checked={!!checked[item.id]}
                      onChange={(e) => toggleCheck(item.id, e.target.checked)}
                      style={{ width:'14px', height:'14px', flexShrink:0, marginTop:'2px', accentColor:'var(--blue)', cursor:'pointer' }}
                    />
                    <label
                      style={{ fontSize:'12px', flex:1, lineHeight:'1.4', cursor:'pointer', color:checked[item.id]?'var(--text-faint)':'var(--text)', textDecoration:checked[item.id]?'line-through':'none' }}
                      onClick={() => toggleCheck(item.id, !checked[item.id])}
                    >
                      {item.label}
                    </label>
                    {item.is_required && <span style={{ fontSize:'9px', color:'var(--red)', fontFamily:'ui-monospace,monospace', flexShrink:0, marginTop:'3px' }}>req</span>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'log' && (
        <div>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 14px', marginBottom:'10px' }}>
            <textarea
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              placeholder="Add a log entry..."
              style={{ ...inp, minHeight:'70px', resize:'vertical', marginBottom:'8px' }}
            />
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button onClick={addLog} disabled={logSaving || !logText.trim()} style={{ padding:'7px 16px', background:logSaving || !logText.trim()?'var(--border)':'var(--text)', color:'var(--bg)', border:'none', borderRadius:'7px', fontSize:'12px', fontWeight:'600', cursor:logSaving || !logText.trim()?'not-allowed':'pointer' }}>
                {logSaving ? 'Saving...' : 'Add Entry'}
              </button>
            </div>
          </div>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 14px' }}>
            {!logs.length ? (
              <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'20px 0', fontSize:'12px' }}>No log entries yet</div>
            ) : (
              logs.map((log: any) => (
                <div key={log.id} style={{ padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                    <span style={{ fontSize:'11px', fontWeight:'600' }}>{log.profiles?.full_name || 'Unknown'}</span>
                    <span style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'ui-monospace,monospace' }}>
                      {new Date(log.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                    </span>
                  </div>
                  <div style={{ fontSize:'12px', color:'var(--text)', lineHeight:'1.5' }}>{log.body}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'issues' && (
        <div>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 14px', marginBottom:'10px' }}>
            {!showIssueForm ? (
              <button onClick={() => setShowIssueForm(true)} style={{ width:'100%', padding:'8px', background:'var(--bg)', border:'1px dashed var(--border)', borderRadius:'7px', fontSize:'12px', color:'var(--text-muted)', cursor:'pointer' }}>
                + Log Issue
              </button>
            ) : (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
                  <div>
                    <label style={{ display:'block', fontSize:'10px', color:'var(--text-muted)', marginBottom:'3px', textTransform:'uppercase', letterSpacing:'.04em', fontFamily:'ui-monospace,monospace' }}>
                      Severity
                    </label>
                    <select style={inp} value={issueSeverity} onChange={(e) => setIssueSeverity(e.target.value)}>
                      {['Critical','Warning','Info'].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn:'1 / -1' }}>
                    <label style={{ display:'block', fontSize:'10px', color:'var(--text-muted)', marginBottom:'3px', textTransform:'uppercase', letterSpacing:'.04em', fontFamily:'ui-monospace,monospace' }}>
                      Title
                    </label>
                    <input style={inp} value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} placeholder="Brief description" />
                  </div>
                  <div style={{ gridColumn:'1 / -1' }}>
                    <label style={{ display:'block', fontSize:'10px', color:'var(--text-muted)', marginBottom:'3px', textTransform:'uppercase', letterSpacing:'.04em', fontFamily:'ui-monospace,monospace' }}>
                      Detail
                    </label>
                    <textarea style={{ ...inp, minHeight:'60px', resize:'vertical' }} value={issueDetail} onChange={(e) => setIssueDetail(e.target.value)} placeholder="What happened, what's blocked..." />
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px', justifyContent:'flex-end' }}>
                  <button onClick={() => setShowIssueForm(false)} style={{ padding:'6px 12px', border:'1px solid var(--border)', borderRadius:'7px', fontSize:'12px', background:'none', cursor:'pointer', color:'var(--text-muted)' }}>
                    Cancel
                  </button>
                  <button onClick={addIssue} disabled={issueSaving || !issueTitle.trim()} style={{ padding:'6px 12px', background:'var(--text)', color:'var(--bg)', border:'none', borderRadius:'7px', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>
                    Log Issue
                  </button>
                </div>
              </div>
            )}
          </div>
     <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 14px' }}>
  {!issues.length ? (
    <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'20px 0', fontSize:'12px' }}>
      No issues ✓
    </div>
  ) : (
    issues.map((iss: any) => (
      <div
        key={iss.id}
        style={{
          display:'flex',
          alignItems:'flex-start',
          gap:'8px',
          padding:'8px 0',
          borderBottom:'1px solid var(--border)',
        }}
      >
        <span
          style={{
            fontSize:'10px',
            fontWeight:'600',
            padding:'2px 6px',
            borderRadius:'3px',
            flexShrink:0,
            background:statusColors[iss.severity] + '22',
            color:statusColors[iss.severity],
            border:`1px solid ${statusColors[iss.severity]}44`,
          }}
        >
          {iss.severity}
        </span>

        <div style={{ flex:1, minWidth:0 }}>
          <div
            style={{
              fontSize:'12px',
              fontWeight:'600',
              textDecoration:iss.resolved ? 'line-through' : 'none',
              color:iss.resolved ? 'var(--text-faint)' : 'var(--text)',
            }}
          >
            {iss.title}
          </div>

          {iss.detail && (
            <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>
              {iss.detail}
            </div>
          )}
        </div>

        {!iss.resolved ? (
          <button
            onClick={() => resolveIssue(iss.id)}
            style={{
              fontSize:'10px',
              padding:'2px 8px',
              background:'var(--green-bg)',
              color:'var(--green)',
              border:'1px solid var(--green)',
              borderRadius:'4px',
              cursor:'pointer',
              flexShrink:0,
            }}
          >
            Resolve
          </button>
        ) : (
          <span style={{ fontSize:'10px', color:'var(--green)', flexShrink:0 }}>✓</span>
        )}
      </div>
    ))
  )}
</div>