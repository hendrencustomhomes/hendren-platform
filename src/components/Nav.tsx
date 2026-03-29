'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/', label: 'Dashboard', icon: '📊', exact: true },
  { href: '/schedule', label: 'Schedule', icon: '📅', exact: false },
  { href: '/jobs', label: 'All Jobs', icon: '🏠', exact: false },
  { href: '/jobs/new', label: 'New Job', icon: '➕', exact: true },
]

export default function Nav({ title, back, jobId }: { title: string; back?: string; jobId?: string }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  function isActive(item: typeof NAV[0]) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href) && item.href !== '/'
  }

  return (
    <>
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'11px 16px', display:'flex', alignItems:'center', gap:'10px', position:'sticky', top:0, zIndex:100 }}>
        {back ? (
          <a href={back} style={{ fontSize:'20px', color:'var(--text-muted)', textDecoration:'none', flexShrink:0, lineHeight:1 }}>‹</a>
        ) : (
          <button onClick={() => setOpen(true)} style={{ background:'none', border:'none', cursor:'pointer', padding:'4px', display:'flex', flexDirection:'column', gap:'4px', flexShrink:0 }}>
            <span style={{ display:'block', width:'18px', height:'2px', background:'var(--text)', borderRadius:'2px' }} />
            <span style={{ display:'block', width:'18px', height:'2px', background:'var(--text)', borderRadius:'2px' }} />
            <span style={{ display:'block', width:'18px', height:'2px', background:'var(--text)', borderRadius:'2px' }} />
          </button>
        )}
        <div style={{ fontSize:'15px', fontWeight:'700', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</div>
        {jobId && (
          <div style={{ display:'flex', gap:'4px' }}>
            {[
              { href:`/jobs/${jobId}`, label:'Overview' },
              { href:`/schedule?job=${jobId}`, label:'Schedule' },
            ].map(t => (
              <a key={t.href} href={t.href} style={{ fontSize:'11px', fontWeight:'600', padding:'4px 9px', borderRadius:'6px', textDecoration:'none', background: pathname === t.href || (t.href.includes('schedule') && pathname.includes('schedule')) ? 'var(--border)' : 'transparent', color:'var(--text-muted)' }}>{t.label}</a>
            ))}
          </div>
        )}
      </div>

      {open && <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:300 }} />}

      <div style={{ position:'fixed', top:0, left:0, height:'100vh', width:'260px', background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', zIndex:400, transform: open ? 'translateX(0)' : 'translateX(-100%)', transition:'transform .22s cubic-bezier(.4,0,.2,1)', overflowY:'auto' }}>
        <div style={{ padding:'16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:'13px', fontWeight:'700' }}>Hendren Custom Homes</div>
            <div style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'ui-monospace,monospace', marginTop:'2px' }}>Field Operations</div>
          </div>
          <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'18px', color:'var(--text-muted)', padding:'4px' }}>✕</button>
        </div>
        <div style={{ padding:'8px 6px', flex:1 }}>
          {NAV.map(item => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', borderRadius:'7px', textDecoration:'none', fontSize:'13px', fontWeight:'500', marginBottom:'2px', background: isActive(item) ? 'var(--border)' : 'transparent', color: isActive(item) ? 'var(--text)' : 'var(--text-muted)' }}>
              <span style={{ fontSize:'14px', width:'18px', textAlign:'center' }}>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </div>
        <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', fontSize:'11px', color:'var(--text-muted)', fontFamily:'ui-monospace,monospace' }}>Tim · PM</div>
      </div>
    </>
  )
}
