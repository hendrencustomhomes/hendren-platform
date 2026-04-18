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
  padding: '14px 16px',
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
  role: string
  isActive: boolean
  isAdmin: boolean
}

export default function InternalUsersPage() {
  const [users, setUsers] = useState<InternalUser[]>([])
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

    setUsers(res?.users || [])
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
      await navigator.clipboard.writeText(res.link)
      setSuccess('Reset link copied.')
    }
  }

  return (
    <>
      <Nav title="Internal Users" back="/more" />

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Internal Users</span>
            <button type="button" style={ghostBtnStyle} onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cancel' : '+ Add User'}
            </button>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {error && <div style={{ fontSize: '13px', color: '#fca5a5' }}>{error}</div>}
            {success && <div style={{ fontSize: '13px', color: '#86efac' }}>{success}</div>}
            {warning && (
              <div style={{ fontSize: '13px', color: '#fcd34d' }}>
                {warning}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  <button type="button" style={ghostBtnStyle} onClick={handleResend}>Resend Email</button>
                  <button type="button" style={ghostBtnStyle} onClick={handleCopy}>Copy Reset Link</button>
                </div>
              </div>
            )}

            {showForm && (
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

        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Users</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{users.length}</span>
          </div>

          {listLoading ? (
            <div style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</div>
          ) : users.length === 0 ? (
            <div style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>No internal users found.</div>
          ) : (
            users.map((u, index) => (
              <Link key={u.id} href={`/more/internal-users/${u.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div
                  style={{
                    padding: '14px 16px',
                    borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                      {u.fullName || u.email || 'Unnamed User'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.email || 'No email'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {u.role}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: u.isAdmin ? '#93c5fd' : 'var(--text-muted)',
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '2px 8px',
                      }}
                    >
                      {u.isAdmin ? 'Admin' : 'User'}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: u.isActive ? '#86efac' : '#fcd34d',
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '2px 8px',
                      }}
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>›</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  )
}
