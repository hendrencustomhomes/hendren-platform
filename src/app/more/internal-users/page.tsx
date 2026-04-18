'use client'

import { useState } from 'react'
import { createInternalUser } from './actions'

export default function InternalUsersPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleCreate() {
    setError('')
    setSuccess(false)
    setLoading(true)

    const res = await createInternalUser(email, name)

    setLoading(false)

    if (res?.error) {
      setError(res.error)
      return
    }

    setSuccess(true)
    setEmail('')
    setName('')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      background: '#0a0a0a'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}>
        <h1 style={{ fontSize: 28 }}>Add Internal User</h1>

        {error && <div style={{ color: '#ff4d4f' }}>{error}</div>}
        {success && (
          <div style={{ color: '#52c41a' }}>
            User created. Password setup email sent.
          </div>
        )}

        <input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            padding: '14px',
            fontSize: 16,
            borderRadius: 8,
            border: '1px solid #333',
            background: '#111',
            color: '#fff'
          }}
        />

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: '14px',
            fontSize: 16,
            borderRadius: 8,
            border: '1px solid #333',
            background: '#111',
            color: '#fff'
          }}
        />

        <button
          onClick={handleCreate}
          disabled={loading || !email || !name}
          style={{
            padding: '14px',
            fontSize: 16,
            borderRadius: 8,
            border: 'none',
            background: '#1677ff',
            color: '#fff'
          }}
        >
          {loading ? 'Creating...' : 'Create User'}
        </button>
      </div>
    </div>
  )
}
