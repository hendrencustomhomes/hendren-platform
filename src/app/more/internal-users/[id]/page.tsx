'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import { createClient } from '@/utils/supabase/client'
import {
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

export default function InternalUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const id = params.id as string

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [name, setName] = useState('')
  const [role, setRole] = useState('general')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [birthday, setBirthday] = useState('')

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    setLoading(true)

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, phone, address, birthday, internal_access(role, is_active)')
      .eq('id', id)
      .maybeSingle()

    if (!data) {
      setError('User not found')
      setLoading(false)
      return
    }

    const access = Array.isArray(data.internal_access)
      ? data.internal_access[0]
      : data.internal_access

    setUser(data)
    setName(data.full_name || '')
    setRole(access?.role || 'general')
    setPhone(data.phone || '')
    setAddress(data.address || '')
    setBirthday(data.birthday || '')

    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    const res = await updateInternalUser({
      profileId: id,
      fullName: name,
      role,
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
  }

  async function handleDeactivate() {
    const res = await deactivateInternalUser(id)
    if (!res?.error) {
      router.push('/more/internal-users')
    }
  }

  if (loading) {
    return (
      <>
        <Nav title="User" back="/more/internal-users" />
        <div style={{ padding: 16 }}>Loading…</div>
      </>
    )
  }

  return (
    <>
      <Nav title={name || 'User'} back="/more/internal-users" />

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Info</span>
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {error && <div style={{ color: '#fca5a5' }}>{error}</div>}
            {success && <div style={{ color: '#86efac' }}>{success}</div>}

            <div>
              <label style={labelStyle}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Role</label>
              <input value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle} />
            </div>

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
              <input value={birthday} onChange={(e) => setBirthday(e.target.value)} style={inputStyle} />
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
            <button onClick={() => resendResetEmail(user?.email)} style={ghostBtnStyle}>
              Resend Email
            </button>
            <button
              onClick={async () => {
                const res = await generateResetLink(user?.email)
                if (res?.link) navigator.clipboard.writeText(res.link)
              }}
              style={ghostBtnStyle}
            >
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
