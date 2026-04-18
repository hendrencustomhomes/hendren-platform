'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  createInternalUser,
  resendResetEmail,
  generateResetLink,
} from './actions'
import { createClient } from '@/utils/supabase/client'

export default function InternalUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [warning, setWarning] = useState('')
  const [lastEmail, setLastEmail] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    const supabase = createClient()

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, internal_access(role, is_active)')

    setUsers(data || [])
  }

  async function handleCreate() {
    setError('')
    setSuccess(false)
    setWarning('')
    setLoading(true)

    const res = await createInternalUser(email, name)

    setLoading(false)

    if (res?.error) {
      setError(res.error)
      return
    }

    if (res?.warning) {
      setWarning(res.warning)
      setLastEmail(res.email)
    }

    setSuccess(true)
    setEmail('')
    setName('')
    setShowForm(false)

    loadUsers()
  }

  async function handleResend() {
    if (!lastEmail) return
    await resendResetEmail(lastEmail)
  }

  async function handleCopy() {
    if (!lastEmail) return
    const res = await generateResetLink(lastEmail)
    if (res?.link) {
      navigator.clipboard.writeText(res.link)
    }
  }

  return (
    <div style={{ padding: 20, background: '#0a0a0a', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 28 }}>Internal Users</h1>

      {error && <div style={{ color: '#ff4d4f' }}>{error}</div>}
      {success && <div style={{ color: '#52c41a' }}>User created</div>}
      {warning && (
        <div style={{ color: '#faad14' }}>
          {warning}
          <div style={{ marginTop: 6, display: 'flex', gap: 10 }}>
            <button onClick={handleResend}>Resend Email</button>
            <button onClick={handleCopy}>Copy Reset Link</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showForm && (
        <div style={{ marginTop: 12 }}>
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {users.map((u) => (
          <Link key={u.id} href={`/more/internal-users/${u.id}`}>
            <div style={{ padding: 12, borderBottom: '1px solid #333' }}>
              <div>{u.full_name}</div>
              <div>{u.internal_access?.role}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
