'use client'

import { useState, type FormEvent } from 'react'
import { signInWithPassword, requestPasswordReset } from './actions'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    const result = await signInWithPassword(email, password)

    setLoading(false)

    if (result?.error) {
      setError(result.error)
    }
  }

  async function handleReset() {
    setError('')
    setMessage('')

    const result = await requestPasswordReset(email)

    if (result?.error) {
      setError(result.error)
      return
    }

    setMessage('Password reset email sent.')
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
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        <h1 style={{ fontSize: 28 }}>Sign In</h1>

        {error && <div style={{ color: '#ff4d4f' }}>{error}</div>}
        {message && <div style={{ color: '#52c41a' }}>{message}</div>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
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
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
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
          type="submit"
          disabled={loading}
          style={{
            padding: '14px',
            fontSize: 16,
            borderRadius: 8,
            border: 'none',
            background: '#1677ff',
            color: '#fff'
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={!email}
          style={{
            padding: '10px',
            fontSize: 14,
            background: 'transparent',
            color: '#999',
            border: 'none'
          }}
        >
          Forgot password?
        </button>
      </form>
    </div>
  )
}
