import FilesTab from '@/components/FilesTab'
'use client'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

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
  selections,
  takeoffItems,
  estimates,
  files,
  stages,
  stageLabels,
  stageIcons,
  statusColors,
  userId,
} = props
  const fmtDate = (d: string|null) => d ? new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "—"

  const [tab, setTab] = useState('checklist')
  const [checked, setChecked] = useState<Record<string,boolean>>(initChecked)
  const [stateMap, setStateMap] = useState<Record<string,string>>(initState)
  const [issues, setIssues] = useState<any[]>(initIssues)
  const [logs, setLogs] = useState<any[]>(initLogs)
  const [logText, setLogText] = useState('')
  const [logSaving, setLogSaving] = useState(false)
  const [issueTitle, setIssueTitle] = useState('')
  const [issueSeverity, setIssueSeverity] = useState('Warning')
  const [issueDetail, setIssueDetail] = useState('')
  const [issueSaving, setIssueSaving] = useState(false)
  const [showIssueForm, setShowIssueForm] = useState(false)

  const supabase = createClient()
  const curIdx = stages.indexOf(job.current_stage)

  async function toggleCheck(itemId: string, val: boolean) {
    setChecked(c => ({...c,[itemId]:val}))
    const existingId = stateMap[itemId]
    if (existingId) {
      await supabase.from('job_checklist_state').update({is_checked:val}).eq('id',existingId)
    } else {
      const {data} = await supabase.from('job_checklist_state').insert({job_id:jobId,checklist_item_id:itemId,is_checked:val}).select().single()
      if (data) setStateMap(m => ({...m,[itemId]:data.id}))
    }
  }

  async function addLog() {
    if (!logText.trim()) return
    setLogSaving(true)
    const {data} = await supabase.from('job_logs').insert({job_id:jobId,body:logText.trim(),author_id:userId}).select('*, profiles(full_name)').single()
    setLogSaving(false)
    if (data) { setLogs(l=>[data,...l]); setLogText('') }
  }

  async function addIssue() {
    if (!issueTitle.trim()) return
    setIssueSaving(true)
    const {data} = await supabase.from('issues').insert({job_id:jobId,title:issueTitle.trim(),severity:issueSeverity,detail:issueDetail.trim()||null,stage:job.current_stage}).select().single()
    setIssueSaving(false)
    if (data) { setIssues(i=>[data,...i]); setIssueTitle(''); setIssueDetail(''); setShowIssueForm(false) }
  }

  async function resolveIssue(issueId: string) {
    await supabase.from('issues').update({resolved:true,resolved_at:new Date().toISOString()}).eq('id',issueId)
    setIssues(i=>i.map(x=>x.id===issueId?{...x,resolved:true}:x))
  }

  const TABS = ['checklist','log','issues','subs','orders','files']
  const TAB_LABELS: Record<string,string> = {checklist:'Checklist',log:'Log',issues:`Issues${issues.filter(i=>!i.resolved).length?' ('+issues.filter(i=>!i.resolved).length+')':''}`,subs:'Subs',orders:'Orders',files:'Files'}

  const inp = {width:'100%',padding:'8px 10px',border:'1px solid var(--border)',borderRadius:'7px',fontSize:'12px',fontFamily:'ui-monospace,monospace',boxSizing:'border-box' as const,outline:'none',background:'var(--surface)',color:'var(--text)'}

  return (
    <div>
      {/* Tab bar */}
      <div style={{display:'flex',gap:'2px',borderBottom:'1px solid var(--border)',marginBottom:'12px',overflowX:'auto'}}>
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'8px 14px',border:'none',background:'none',cursor:'pointer',fontSize:'12px',fontWeight:'600',color:tab===t?'var(--text)':'var(--text-muted)',borderBottom:`2px solid ${tab===t?'var(--text)':'transparent'}`,fontFamily:'system-ui,-apple-system,sans-serif',whiteSpace:'nowrap'}}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* CHECKLIST */}
      {tab==='checklist' && (
        <div>
          {stages.map(stage=>{
            const items = stageItems[stage]||[]
            if (!items.length) return null
            const i = stages.indexOf(stage)
            const done=i<curIdx, active=i===curIdx
            const checkedCount = items.filter((it:any)=>checked[it.id]).length
            const pct = items.length ? Math.round(checkedCount/items.length*100) : 0
            return (
              <div key={stage} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px 14px',marginBottom:'8px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px'}}>
                  <span style={{fontSize:'11px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'.05em',color:done?'var(--green)':active?'var(--blue)':'var(--text-faint)'}}>
                    {stageIcons[stage]} {stageLabels[stage]}
                  </span>
                  <span style={{fontSize:'10px',color:'var(--text-muted)',fontFamily:'ui-monospace,monospace'}}>{checkedCount}/{items.length}</span>
                </div>
                <div style={{height:'3px',background:'var(--border)',borderRadius:'2px',marginBottom:'8px',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pct}%`,background:done?'var(--green)':active?'var(--blue)':'var(--border)',borderRadius:'2px'}}/>
                </div>
                {items.map((item:any)=>(
                  <div key={item.id} style={{display:'flex',alignItems:'flex-start',gap:'8px',padding:'4px 5px',borderRadius:'5px'}}>
                    <input type="checkbox" checked={!!checked[item.id]} onChange={e=>toggleCheck(item.id,e.target.checked)}
                      style={{width:'14px',height:'14px',flexShrink:0,marginTop:'2px',accentColor:'var(--blue)',cursor:'pointer'}} />
                    <label style={{fontSize:'12px',flex:1,lineHeight:'1.4',cursor:'pointer',color:checked[item.id]?'var(--text-faint)':'var(--text)',textDecoration:checked[item.id]?'line-through':'none'}}
                      onClick={()=>toggleCheck(item.id,!checked[item.id])}>
                      {item.label}
                    </label>
                    {item.is_required&&<span style={{fontSize:'9px',color:'var(--red)',fontFamily:'ui-monospace,monospace',flexShrink:0,marginTop:'3px'}}>req</span>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* LOG */}
      {tab==='log' && (
        <div>
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px 14px',marginBottom:'10px'}}>
            <textarea value={logText} onChange={e=>setLogText(e.target.value)} placeholder="Add a log entry..." style={{...inp,minHeight:'70px',resize:'vertical',marginBottom:'8px'}} />
            <div style={{display:'flex',justifyContent:'flex-end'}}>
              <button onClick={addLog} disabled={logSaving||!logText.trim()} style={{padding:'7px 16px',background:logSaving||!logText.trim()?'var(--border)':'var(--text)',color:'var(--bg)',border:'none',borderRadius:'7px',fontSize:'12px',fontWeight:'600',cursor:logSaving||!logText.trim()?'not-allowed':'pointer'}}>
                {logSaving?'Saving...':'Add Entry'}
              </button>
            </div>
          </div>
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px 14px'}}>
            {!logs.length?<div style={{textAlign:'center',color:'var(--text-muted)',padding:'20px 0',fontSize:'12px'}}>No log entries yet</div>:
            logs.map((log:any)=>(
              <div key={log.id} style={{padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                  <span style={{fontSize:'11px',fontWeight:'600'}}>{log.profiles?.full_name||'Unknown'}</span>
                  <span style={{fontSize:'10px',color:'var(--text-muted)',fontFamily:'ui-monospace,monospace'}}>{new Date(log.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                </div>
                <div style={{fontSize:'12px',color:'var(--text)',lineHeight:'1.5'}}>{log.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ISSUES */}
      {tab==='issues' && (
        <div>
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px 14px',marginBottom:'10px'}}>
            {!showIssueForm?(
              <button onClick={()=>setShowIssueForm(true)} style={{width:'100%',padding:'8px',background:'var(--bg)',border:'1px dashed var(--border)',borderRadius:'7px',fontSize:'12px',color:'var(--text-muted)',cursor:'pointer'}}>+ Log Issue</button>
            ):(
              <div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
                  <div>
                    <label style={{display:'block',fontSize:'10px',color:'var(--text-muted)',marginBottom:'3px',textTransform:'uppercase',letterSpacing:'.04em',fontFamily:'ui-monospace,monospace'}}>Severity</label>
                    <select style={inp} value={issueSeverity} onChange={e=>setIssueSeverity(e.target.value)}>
                      {['Critical','Warning','Info'].map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{gridColumn:'1 / -1'}}>
                    <label style={{display:'block',fontSize:'10px',color:'var(--text-muted)',marginBottom:'3px',textTransform:'uppercase',letterSpacing:'.04em',fontFamily:'ui-monospace,monospace'}}>Title</label>
                    <input style={inp} value={issueTitle} onChange={e=>setIssueTitle(e.target.value)} placeholder="Brief description" />
                  </div>
                  <div style={{gridColumn:'1 / -1'}}>
                    <label style={{display:'block',fontSize:'10px',color:'var(--text-muted)',marginBottom:'3px',textTransform:'uppercase',letterSpacing:'.04em',fontFamily:'ui-monospace,monospace'}}>Detail</label>
                    <textarea style={{...inp,minHeight:'60px',resize:'vertical'}} value={issueDetail} onChange={e=>setIssueDetail(e.target.value)} placeholder="What happened, what's blocked..." />
                  </div>
                </div>
                <div style={{display:'flex',gap:'6px',justifyContent:'flex-end'}}>
                  <button onClick={()=>setShowIssueForm(false)} style={{padding:'6px 12px',border:'1px solid var(--border)',borderRadius:'7px',fontSize:'12px',background:'none',cursor:'pointer',color:'var(--text-muted)'}}>Cancel</button>
                  <button onClick={addIssue} disabled={issueSaving||!issueTitle.trim()} style={{padding:'6px 12px',background:'var(--text)',color:'var(--bg)',border:'none',borderRadius:'7px',fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>Log Issue</button>
                </div>
              </div>
            )}
          </div>
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px 14px'}}>
            {!issues.length?<div style={{textAlign:'center',color:'var(--text-muted)',padding:'20px 0',fontSize:'12px'}}>No issues ✓</div>:
            issues.map((iss:any)=>(
              <div key={iss.id} style={{display:'flex',alignItems:'flex-start',gap:'8px',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:'10px',fontWeight:'600',padding:'2px 6px',borderRadius:'3px',flexShrink:0,background:statusColors[iss.severity]+'22',color:statusColors[iss.severity],border:`1px solid ${statusColors[iss.severity]}44`}}>{iss.severity}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'12px',fontWeight:'600',textDecoration:iss.resolved?'line-through':'none',color:iss.resolved?'var(--text-faint)':'var(--text)'}}>{iss.title}</div>
                  {iss.detail&&<div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'2px'}}>{iss.detail}</div>}
                </div>
                {!iss.resolved&&<button onClick={()=>resolveIssue(iss.id)} style={{fontSize:'10px',padding:'2px 8px',background:'var(--green-bg)',color:'var(--green)',border:'1px solid var(--green)',borderRadius:'4px',cursor:'pointer',flexShrink:0}}>Resolve</button>}
                {iss.resolved&&<span style={{fontSize:'10px',color:'var(--green)',flexShrink:0}}>✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBS */}
      {tab==='subs' && (
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px'}}>
          <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:'12px',fontWeight:'700'}}>Sub Schedule</span>
            <a href={`/schedule/sub/new?job=${jobId}`} style={{fontSize:'11px',fontWeight:'600',padding:'4px 10px',background:'var(--text)',color:'var(--bg)',borderRadius:'5px',textDecoration:'none'}}>+ Sub</a>
          </div>
          {!subs.length?<div style={{padding:'30px',textAlign:'center',color:'var(--text-muted)',fontSize:'12px'}}>No subs scheduled yet</div>:
          subs.map((sub:any)=>(
            <div key={sub.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'9px 14px',borderBottom:'1px solid var(--border)'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:'12px',fontWeight:'600'}}>{sub.trade}</div>
                <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{sub.sub_name||'TBD'}{sub.trade_contact?` · ${sub.trade_contact}`:''}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <span style={{fontSize:'10px',fontWeight:'600',padding:'2px 7px',borderRadius:'10px',background:statusColors[sub.status]+'22',color:statusColors[sub.status],border:`1px solid ${statusColors[sub.status]}44`}}>{sub.status}</span>
                <div style={{fontSize:'10px',color:'var(--text-muted)',marginTop:'2px',fontFamily:'ui-monospace,monospace'}}>{fmtDate(sub.start_date)} → {fmtDate(sub.end_date)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ORDERS */}
      {tab==='orders' && (
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px'}}>
          <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:'12px',fontWeight:'700'}}>Material Orders</span>
            <a href={`/schedule/order/new?job=${jobId}`} style={{fontSize:'11px',fontWeight:'600',padding:'4px 10px',background:'var(--text)',color:'var(--bg)',borderRadius:'5px',textDecoration:'none'}}>+ Order</a>
          </div>
          {!orders.length?<div style={{padding:'30px',textAlign:'center',color:'var(--text-muted)',fontSize:'12px'}}>No orders yet</div>:
          orders.map((order:any)=>{
            const daysToOrderBy = order.order_by_date ? Math.round((new Date(order.order_by_date).getTime()-Date.now())/86400000) : null
            const flag = daysToOrderBy!==null&&order.status==='Pending' ? (daysToOrderBy<0?'overdue':daysToOrderBy<=7?'soon':'ok') : 'none'
            return (
              <div key={order.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'9px 14px',borderBottom:'1px solid var(--border)'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'12px',fontWeight:'600'}}>{order.description}</div>
                  <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{order.trade}{order.vendor?` · ${order.vendor}`:''}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <span style={{fontSize:'10px',fontWeight:'600',padding:'2px 7px',borderRadius:'10px',background:statusColors[order.status]+'22',color:statusColors[order.status],border:`1px solid ${statusColors[order.status]}44`}}>{order.status}</span>
                  {order.order_by_date&&<div style={{fontSize:'10px',marginTop:'2px',fontFamily:'ui-monospace,monospace',color:flag==='overdue'?'var(--red)':flag==='soon'?'var(--amber)':'var(--text-muted)'}}>
                    {flag==='overdue'?'🔴 ':flag==='soon'?'⚠️ ':''}Order by {fmtDate(order.order_by_date)}
                  </div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {tab==='files' && <FilesTab jobId={jobId} />}
    </div>
  )
}
