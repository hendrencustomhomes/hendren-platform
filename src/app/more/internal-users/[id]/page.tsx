'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import {
  getInternalUser,
  updateInternalUser,
  deactivateInternalUser,
  activateInternalUser,
  archiveInternalUser,
  restoreInternalUser,
  resendResetEmail,
  generateResetLink,
} from '../actions'
import { APP_ROLES, APP_ROLE_LABELS, type AppRole } from '@/lib/permissions'

const STATE_ABBREV: Record<string, string> = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
  'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
  'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA',
  'Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD',
  'Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO',
  'Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ',
  'New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH',
  'Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
  'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
  'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
}

const NW_IN_ZIP_CITY: Record<string, string> = {
  '46301':'Dyer','46303':'Griffith','46304':'Chesterton','46307':'Crown Point',
  '46310':'Demotte','46311':'Dyer','46312':'East Chicago','46319':'Griffith',
  '46320':'Hammond','46321':'Munster','46322':'Highland','46323':'Hammond',
  '46324':'Hammond','46325':'Hammond','46327':'Hammond','46340':'Hammond',
  '46341':'Highland','46356':'Lowell','46368':'Portage','46373':'St. John',
  '46375':'Schererville','46383':'Valparaiso','46384':'Valparaiso','46385':'Valparaiso',
  '46390':'Wanatah','46391':'Westville','46392':'Wheatfield',
  '46401':'Gary','46402':'Gary','46403':'Gary','46404':'Gary','46405':'Gary',
  '46406':'Gary','46407':'Gary','46408':'Gary','46409':'Gary',
  '46410':'Merrillville','46411':'Merrillville',
}

function localityLabel(a: any): string {
  const zip5 = (a.postcode || '').split('-')[0]
  return a.city || a.town || a.municipality || a.village || a.suburb || a.hamlet
    || NW_IN_ZIP_CITY[zip5] || a.county || ''
}

function rankResult(x: any, typedRoadPrefix: string): number {
  let score = 0
  const zip = x.address?.postcode || ''
  if (zip === '46383' || zip === '46384' || zip === '46385') score += 40
  else if (zip.startsWith('463')) score += 30
  else if (zip.startsWith('464')) score += 20
  else if (zip.startsWith('46')) score += 10
  const road = (x.address?.road || '').toLowerCase()
  if (typedRoadPrefix && road.startsWith(typedRoadPrefix)) score += 25
  else if (typedRoadPrefix && road.includes(typedRoadPrefix)) score += 10
  if (x.address?.house_number) score += 15
  return score
}

function formatSuggestion(s: any): string {
  const a = s.address || {}
  const street = [a.house_number, a.road].filter(Boolean).join(' ')
  const city = localityLabel(a)
  const state = STATE_ABBREV[a.state] || a.state || ''
  const zip = (a.postcode || '').split('-')[0]
  return [street, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function copyText(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

const inputStyle = {
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: '15px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
} as const

const readOnlyInputStyle = {
  ...inputStyle,
  color: 'var(--text-muted)',
} as const

const labelStyle = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: '4px',
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
} as const

const sectionCardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '18px',
  overflow: 'hidden',
} as const

const sectionHeaderStyle = {
  padding: '12px 14px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
} as const

const sectionTitleStyle = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--text)',
  textTransform: 'uppercase',
} as const

const ghostBtnStyle = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '7px 10px',
  fontSize: '12px',
  cursor: 'pointer',
} as const

const solidBtnStyle = {
  background: 'var(--text)',
  color: 'var(--surface)',
  border: 'none',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '12px',
  cursor: 'pointer',
} as const

type InternalUser = {
  id: string
  email: string | null
  fullName: string | null
  phone: string | null
  address: string | null
  addressParts?: { street: string; city: string; state: string; zip: string }
  birthday: string | null
  roles: AppRole[]
  isActive: boolean
  archivedAt: string | null
}

export default function InternalUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const roleMenuRef = useRef<HTMLDivElement | null>(null)
  const addrTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [user, setUser] = useState<InternalUser | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)
  const [addrSuggestions, setAddrSuggestions] = useState<any[]>([])

  const [name, setName] = useState('')
  const [roles, setRoles] = useState<AppRole[]>(['viewer'])
  const [phone, setPhone] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [birthday, setBirthday] = useState('')

  const nonAdminRoleSummary = useMemo(() => {
    const filtered = roles.filter((role) => role !== 'admin')
    if (filtered.length === 0) return 'No roles selected'
    return filtered.map((role) => APP_ROLE_LABELS[role]).join(', ')
  }, [roles])

  useEffect(() => {
    load()
  }, [id])

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!roleMenuRef.current?.contains(event.target as Node)) {
        setRoleMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  async function load() {
    setLoading(true)
    setError('')

    const res = await getInternalUser(id)

    if (res?.error || !res?.user) {
      setError(res?.error || 'User not found')
      setLoading(false)
      return
    }

    const nextUser = res.user as InternalUser
    setCanManage(res?.canManage === true)
    setUser(nextUser)
    setName(nextUser.fullName || '')
    setRoles(nextUser.roles?.length ? nextUser.roles : ['viewer'])
    setPhone(nextUser.phone || '')
    setStreet(nextUser.addressParts?.street || '')
    setCity(nextUser.addressParts?.city || '')
    setState(nextUser.addressParts?.state || '')
    setZip(nextUser.addressParts?.zip || '')
    setBirthday(nextUser.birthday || '')
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess('')

    const res = await updateInternalUser({
      profileId: id,
      fullName: name,
      roles,
      phone,
      street,
      city,
      state,
      zip,
      birthday,
    })

    setSaving(false)

    if (res?.error) {
      setError(res.error)
      return
    }

    router.push('/more/internal-users')
  }

  async function handleDeactivate() {
    const res = await deactivateInternalUser(id)
    if (res?.error) {
      setError(res.error)
      return
    }
    router.push('/more/internal-users')
  }

  async function handleActivate() {
    const res = await activateInternalUser(id)
    if (res?.error) {
      setError(res.error)
      return
    }
    router.push('/more/internal-users')
  }

  async function handleArchive() {
    const res = await archiveInternalUser(id)
    if (res?.error) {
      setError(res.error)
      return
    }
    router.push('/more/internal-users')
  }

  async function handleRestore() {
    const res = await restoreInternalUser(id)
    if (res?.error) {
      setError(res.error)
      return
    }
    router.push('/more/internal-users')
  }

  async function handleResend() {
    if (!user?.email) {
      setError('No email found for this user')
      return
    }
    const res = await resendResetEmail(user.email)
    if (res?.error) {
      setError(res.error)
      return
    }
    setSuccess('Password reset email sent.')
  }

  async function handleCopy() {
    if (!user?.email) {
      setError('No email found for this user')
      return
    }
    const res = await generateResetLink(user.email)
    if (res?.error) {
      setError(res.error)
      return
    }
    if (res?.link) {
      try {
        await navigator.clipboard.writeText(res.link)
      } catch {
        copyText(res.link)
      }
      setSuccess('Reset link copied.')
    }
  }

  function toggleRole(role: AppRole) {
    setRoles((current) => {
      const exists = current.includes(role)
      if (exists) {
        const next = current.filter((value) => value !== role)
        return next.length > 0 ? next : ['viewer']
      }
      const next = [...current, role]
      return Array.from(new Set(next))
    })
  }

  function handlePhoneChange(value: string) {
    setPhone(formatPhoneNumber(value))
  }

  function handleStreetChange(val: string) {
    setStreet(val)
    if (addrTimer.current) clearTimeout(addrTimer.current)
    if (val.trim().length < 4) {
      setAddrSuggestions([])
      return
    }

    addrTimer.current = setTimeout(async () => {
      try {
        const base = 'https://nominatim.openstreetmap.org/search'
        const common = 'format=json&addressdetails=1&countrycodes=us&limit=6&viewbox=-87.41,41.72,-86.81,41.22'
        const startsWithNum = /^\d/.test(val.trim())
        const [cityCtx, structured] = await Promise.all([
          startsWithNum
            ? fetch(`${base}?q=${encodeURIComponent(val + ', Valparaiso, IN')}&${common}`, { headers: { 'Accept-Language': 'en' } }).then(r => r.json()).catch(() => [])
            : Promise.resolve([]),
          fetch(
            startsWithNum
              ? `${base}?street=${encodeURIComponent(val)}&state=Indiana&${common}`
              : `${base}?q=${encodeURIComponent(val)}&${common}`,
            { headers: { 'Accept-Language': 'en' } }
          ).then(r => r.json()).catch(() => []),
        ])

        const seen = new Set<string>()
        const merged: any[] = []
        for (const r of [...cityCtx, ...structured]) {
          const key = String(r.osm_id ?? r.place_id)
          if (r.address?.road && !seen.has(key)) { seen.add(key); merged.push(r) }
        }
        const typedWords = val.trim().split(/\s+/)
        const typedRoadPrefix = (startsWithNum ? typedWords.slice(1) : typedWords).join(' ').toLowerCase()
        merged.sort((a, b) => rankResult(b, typedRoadPrefix) - rankResult(a, typedRoadPrefix))
        setAddrSuggestions(merged.slice(0, 5))
      } catch {
        setAddrSuggestions([])
      }
    }, 500)
  }

  function applyAddrSuggestion(s: any) {
    const a = s.address || {}
    setStreet([a.house_number, a.road].filter(Boolean).join(' '))
    setCity(localityLabel(a))
    setState(STATE_ABBREV[a.state] || a.state || '')
    setZip((a.postcode || '').split('-')[0])
    setAddrSuggestions([])
  }

  if (loading) {
    return (
      <>
        <Nav title="User" />
        <div style={{ padding: 16, fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</div>
      </>
    )
  }

  const isArchived = !!user?.archivedAt

  return (
    <>
      <Nav title={name || user?.email || 'User'} />

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Profile</span>
          </div>

          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {error && <div style={{ color: '#fca5a5', fontSize: '13px' }}>{error}</div>}
            {success && <div style={{ color: '#86efac', fontSize: '13px' }}>{success}</div>}

            <div>
              <label style={labelStyle}>Email</label>
              <input value={user?.email || ''} readOnly style={readOnlyInputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={canManage ? inputStyle : readOnlyInputStyle} readOnly={!canManage} />
            </div>

            <div ref={roleMenuRef} style={{ position: 'relative' }}>
              <label style={labelStyle}>Roles</label>
              {canManage ? (
                <>
                  <button
                    type="button"
                    onClick={() => setRoleMenuOpen((v) => !v)}
                    style={{ ...inputStyle, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  >
                    <span>{nonAdminRoleSummary}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{roleMenuOpen ? '▴' : '▾'}</span>
                  </button>
                  {roleMenuOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, zIndex: 20, overflow: 'hidden' }}>
                      {APP_ROLES.map((role) => (
                        <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: role === APP_ROLES[0] ? 'none' : '1px solid var(--border)', fontSize: '14px', color: 'var(--text)' }}>
                          <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} />
                          {APP_ROLE_LABELS[role]}
                        </label>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <input value={nonAdminRoleSummary} readOnly style={readOnlyInputStyle} />
              )}
            </div>

            <div>
              <label style={labelStyle}>Phone</label>
              <input value={phone} onChange={(e) => handlePhoneChange(e.target.value)} style={canManage ? inputStyle : readOnlyInputStyle} readOnly={!canManage} inputMode="numeric" type="tel" placeholder="(555) 555-1234" />
            </div>

            <div>
              <label style={labelStyle}>Street</label>
              <div style={{ position: 'relative' }}>
                <input value={street} onChange={(e) => handleStreetChange(e.target.value)} onBlur={() => setTimeout(() => setAddrSuggestions([]), 150)} style={canManage ? inputStyle : readOnlyInputStyle} readOnly={!canManage} autoComplete="address-line1" />
                {canManage && addrSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', marginTop: '4px', boxShadow: '0 4px 16px rgba(0,0,0,0.14)', overflow: 'hidden' }}>
                    {addrSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={() => applyAddrSuggestion(s)}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: i < addrSuggestions.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text)' }}
                      >
                        {formatSuggestion(s)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 84px 110px', gap: 10 }}>
              <div>
                <label style={labelStyle}>City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} style={canManage ? inputStyle : readOnlyInputStyle} readOnly={!canManage} autoComplete="address-level2" />
              </div>
              <div>
                <label style={labelStyle}>State</label>
                <input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} style={canManage ? inputStyle : readOnlyInputStyle} readOnly={!canManage} autoComplete="address-level1" maxLength={2} />
              </div>
              <div>
                <label style={labelStyle}>ZIP</label>
                <input value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))} style={canManage ? inputStyle : readOnlyInputStyle} readOnly={!canManage} inputMode="numeric" autoComplete="postal-code" />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Birthday</label>
              <input type="date" value={birthday || ''} onChange={(e) => setBirthday(e.target.value)} style={canManage ? inputStyle : readOnlyInputStyle} readOnly={!canManage} />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: roles.includes('admin') ? '#93c5fd' : 'var(--text-muted)', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '999px', padding: '2px 8px' }}>
                {roles.includes('admin') ? 'Admin' : 'User'}
              </span>
              {canManage && (
                <>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: user?.isActive ? '#86efac' : '#fcd34d', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '999px', padding: '2px 8px' }}>
                    {user?.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {isArchived && (
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#fca5a5', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '999px', padding: '2px 8px' }}>
                      Archived
                    </span>
                  )}
                </>
              )}
            </div>

            {canManage && (
              <button onClick={handleSave} style={solidBtnStyle} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        </div>

        {canManage && (
          <div style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <span style={sectionTitleStyle}>Account</span>
            </div>

            <div style={{ padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={handleResend} style={ghostBtnStyle}>
                Resend Email
              </button>
              <button onClick={handleCopy} style={ghostBtnStyle}>
                Copy Reset Link
              </button>
              <button onClick={user?.isActive ? handleDeactivate : handleActivate} style={{ ...ghostBtnStyle, color: user?.isActive ? '#f87171' : '#86efac' }}>
                {user?.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={isArchived ? handleRestore : handleArchive} style={{ ...ghostBtnStyle, color: isArchived ? '#86efac' : '#f87171' }}>
                {isArchived ? 'Restore' : 'Archive'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
