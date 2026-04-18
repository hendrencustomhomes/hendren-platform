'use client'

import { useState } from 'react'
import { createInternalUser } from './actions'

export default function InternalUsersPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<string | null>(null)

  async function handleCreate() {
    setError('')
    setResult(null)
    setLoading(true)

    const res = await createInternalUser(email, name)

    setLoading(false)

    if (res?.error) {
      setError(res.error)
      return
    }

    setResult('User created successfully.')
    setEmail('')
    setName('')
  }

  return (
    <div style={{ padding: 20, maxWidth: 480 }}>
      <h1>Internal Users</h1>

      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: '100%', fontSize: 16, marginBottom: 8 }}
        />

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', fontSize: 16 }}
        />
      </div>

      <button onClick={handleCreate} disabled={loading || !email || !name}>
        {loading ? 'Creating...' : 'Create User'}
      </button>

      {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 12, color: 'green' }}>
          {result}
          <div style={{ fontSize: 12, marginTop: 4 }}>
            A reset email has been sent to the user.
          </div>
        </div>
      )}
    </div>
  )
}
