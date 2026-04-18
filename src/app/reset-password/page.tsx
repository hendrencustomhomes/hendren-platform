'use client'

import { useState, type FormEvent } from 'react'
import { updatePassword } from './actions'

const MIN_LENGTH = 10
const MAX_LENGTH = 64

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`)
      return
    }

    if (password.length > MAX_LENGTH) {
      setError(`Password must be ${MAX_LENGTH} characters or fewer.`)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const result = await updatePassword(password)
    setLoading(false)

    if (result?.error) {
      setError(result.error)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '420px' }}>
        <h2>Reset Password</h2>
        <p>Enter a new password for your account.</p>

        {error && <div style={{ color: 'red', marginBottom: '12px' }}>{error}</div>}

        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="password">New Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={MIN_LENGTH}
            maxLength={MAX_LENGTH}
            autoComplete="new-password"
            required
            style={{ width: '100%', fontSize: '16px' }}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={MIN_LENGTH}
            maxLength={MAX_LENGTH}
            autoComplete="new-password"
            required
            style={{ width: '100%', fontSize: '16px' }}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Password'}
        </button>
      </form>
    </div>
  )
}
