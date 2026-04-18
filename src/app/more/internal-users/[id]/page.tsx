'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import {
  getInternalUser,
  updateInternalUser,
  deactivateInternalUser,
  resendResetEmail,
  generateResetLink,
} from '../actions'

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
  padding: '6px 10px',
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
  birthday: string | null
  role: string
  isActive: boolean
  isAdmin: boolean
}

export default function InternalUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [user, setUser] = useState<InternalUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [name, setName] = useState('')
  const [role, setRole] = useState('general')
  const [isAdmin, setIsAdmin] = useState(false)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [birthday, setBirthday] = useState('')

  useEffect(() => {
    load()
  }, [id])

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
    setUser(nextUser)
    setName(nextUser.fullName || '')
    setRole(nextUser.role || 'general')
    setIsAdmin(nextUser.isAdmin)
    setPhone(nextUser.phone || '')
    setAddress(nextUser.address || '')
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
      role,
      isAdmin,
      phone,
      address,
      birthday,
    })

    setSaving(false)

    if (res?.error) {
      setError(res.error)
      return
    }

    setSuccess('Saved')
    await load()
  }

  async function handleDeactivate() {
    const res = await deactivateInternalUser(id)
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
      await navigator.clipboard.writeText(res.link)
      setSuccess('Reset link copied.')
    }
  }

  if (loading) {
    return (
      <>
        <Nav title="User" back="/more/internal-users" />
        <div style={{ padding: 16, fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</div>
      </>
    )
  }

  return (
    <>
      <Nav title={name || user?.email || 'User'} back="/more/internal-users" />

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Profile</span>
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {error && <div style={{ color: '#fca5a5', fontSize: '13px' }}>{error}</div>}
            {success && <div style={{ color: '#86efac', fontSize: '13px' }}>{success}</div>}

            <div>
              <label style={labelStyle}>Email</label>
              <input value={user?.email || ''} readOnly style={{ ...inputStyle, color: 'var(--text-muted)' }} />
            </div>

            <div>
              <label style={labelStyle}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Role</label>
              <input value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '14px', color: 'var(--text)', fontWeight: 600 }}>
              <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
              Admin
            </label>

            <div>
              <label style={labelStyle}>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Birthday</label>
              <input type="date" value={birthday || ''} onChange={(e) => setBirthday(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: isAdmin ? '#93c5fd' : 'var(--text-muted)',
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                }}
              >
                {isAdmin ? 'Admin' : 'User'}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: user?.isActive ? '#86efac' : '#fcd34d',
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                }}
              >
                {user?.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <button onClick={handleSave} style={solidBtnStyle} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Account</span>
          </div>

          <div style={{ padding: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleResend} style={ghostBtnStyle}>
              Resend Email
            </button>
            <button onClick={handleCopy} style={ghostBtnStyle}>
              Copy Reset Link
            </button>
            <button onClick={handleDeactivate} style={{ ...ghostBtnStyle, color: '#f87171' }}>
              Deactivate
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
