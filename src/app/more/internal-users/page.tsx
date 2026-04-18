'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createInternalUser } from './actions'
import { createClient } from '@/utils/supabase/client'

export default function InternalUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [warning, setWarning] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    const supabase = createClient()

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, internal_access(role, is_active), email')

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
    }

    setSuccess(true)
    setEmail('')
    setName('')

    loadUsers()
  }

  return (
    <div style={{ padding: 20, background: '#0a0a0a', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 28 }}>Internal Users</h1>

      {error && <div style={{ color: '#ff4d4f' }}>{error}</div>}
      {success && <div style={{ color: '#52c41a' }}>User created</div>}
      {warning && <div style={{ color: '#faad14' }}>{warning}</div>}

      <div style={{ marginTop: 20, marginBottom: 20 }}>
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
          {loading ? 'Creating...' : 'Add User'}
        </button>
      </div>

      <div>
        {users.map((u) => (
          <Link key={u.id} href={`/more/internal-users/${u.id}`}>
            <div style={{ padding: 12, borderBottom: '1px solid #333' }}>
              <div>{u.full_name}</div>
              <div>{u.email}</div>
              <div>{u.internal_access?.role}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
