'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import {
  createInternalUser,
  resendResetEmail,
  generateResetLink,
  getInternalUsers,
} from './actions'
import { rolesSummary, type AppRole } from '@/lib/permissions'

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
  gap: '8px',
} as const

const sectionTitleStyle = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--text)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
} as const

const ghostBtnStyle = {
  background: 'transparent',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '7px 10px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
} as const

const solidBtnStyle = {
  background: 'var(--text)',
  color: 'var(--surface)',
  border: 'none',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
} as const

type InternalUser = {
  id: string
  email: string | null
  fullName: string | null
  phone: string | null
  address: string | null
  birthday: string | null
  roles: AppRole[]
  isActive: boolean
}

function badgeStyle(color: string) {
  return {
    fontSize: '11px',
    fontWeight: 600,
    color,
    background: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: '999px',
    padding: '2px 8px',
    whiteSpace: 'nowrap' as const,
  }
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

export default function InternalUsersPage() {
  const [users, setUsers] = useState<InternalUser[]>([])
  const [canManage, setCanManage] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [warning, setWarning] = useState('')
  const [lastEmail, setLastEmail] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setListLoading(true)
    const res = await getInternalUsers()
    if (res?.error) {
      setError(res.error)
      setUsers([])
      setListLoading(false)
      return
    }

    setUsers((res?.users || []) as InternalUser[])
    setCanManage(res?.canManage === true)
    setListLoading(false)
  }

  async function handleCreate() {
    setError('')
    setSuccess('')
    setWarning('')
    setLoading(true)

    const res = await createInternalUser(email, name)

    setLoading(false)

    if (res?.error) {
      setError(res.error)
      return
    }

    if (res?.warning) {
      setWarning('User created. Email was not sent.')
      setLastEmail(res.email)
    } else {
      setSuccess('User created. Password setup email sent.')
      setLastEmail('')
    }

    setEmail('')
    setName('')
    setShowForm(false)

    loadUsers()
  }

  async function handleResend() {
    if (!lastEmail) return
    const res = await resendResetEmail(lastEmail)
    if (res?.error) {
      setError(res.error)
      return
    }
    setSuccess('Password reset email sent.')
    setWarning('')
  }

  async function handleCopy() {
    if (!lastEmail) return
    const res = await generateResetLink(lastEmail)
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

  return (
    <>
      <Nav title="Internal Users" />

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {canManage && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" style={ghostBtnStyle} onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cancel' : '+ Add User'}
            </button>
          </div>
        )}

        {((canManage && showForm) || error || success || warning) && (
          <div style={sectionCardStyle}>
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {error && <div style={{ fontSize: '13px', color: '#fca5a5' }}>{error}</div>}
              {success && <div style={{ fontSize: '13px', color: '#86efac' }}>{success}</div>}
              {warning && canManage && (
                <div style={{ fontSize: '13px', color: '#fcd34d' }}>
                  {warning}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <button type="button" style={ghostBtnStyle} onClick={handleResend}>Resend Email</button>
                    <button type="button" style={ghostBtnStyle} onClick={handleCopy}>Copy Reset Link</button>
                  </div>
                </div>
              )}

              {canManage && showForm && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle} htmlFor="user-name">Full Name</label>
                    <input id="user-name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="user-email">Email</label>
                    <input id="user-email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} inputMode="email" />
                  </div>
                  <div>
                    <button type="button" style={{ ...solidBtnStyle, opacity: loading ? 0.7 : 1 }} onClick={handleCreate} disabled={loading || !email || !name}>
                      {loading ? 'Creating…' : 'Create User'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Users</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{users.length}</span>
          </div>

          {listLoading ? (
            <div style={{ padding: '14px', fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</div>
          ) : users.length === 0 ? (
            <div style={{ padding: '14px', fontSize: '13px', color: 'var(--text-muted)' }}>No internal users found.</div>
          ) : (
            users.map((u, index) => {
              const isAdmin = u.roles.includes('admin')
              return (
                <Link key={u.id} href={`/more/internal-users/${u.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div
                    style={{
                      padding: '12px 14px',
                      borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                        {u.fullName || u.email || 'Unnamed User'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email || 'No email'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {rolesSummary(u.roles.filter((role) => role !== 'admin')) || 'Viewer'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <span style={badgeStyle(isAdmin ? '#93c5fd' : 'var(--text-muted)')}>
                          {isAdmin ? 'Admin' : 'User'}
                        </span>
                        {canManage && (
                          <span style={badgeStyle(u.isActive ? '#86efac' : '#fcd34d')}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '16px', color: 'var(--text-muted)', lineHeight: 1 }}>›</span>
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
