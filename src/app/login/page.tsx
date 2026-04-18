'use client'

import { useState, type FormEvent } from 'react'
import { signInWithPassword, requestPasswordReset } from './actions'
import { useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const searchParams = useSearchParams()

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

  const queryError = searchParams.get('error')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} style={{ width: 320 }}>
        <h2>Sign In</h2>

        {queryError && <div style={{ color: 'red' }}>Invalid or expired link</div>}
        {error && <div style={{ color: 'red' }}>{error}</div>}
        {message && <div style={{ color: 'green' }}>{message}</div>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <button type="button" onClick={handleReset} disabled={!email}>
          Forgot password?
        </button>
      </form>
    </div>
  )
}
