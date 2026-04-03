'use client'

import { useState } from 'react'
import { checkEmailType, signInWithMagicLink, signInWithPassword } from './actions'

type Step = 'email' | 'password' | 'magic_sent'

function cardStyle() {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '28px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
  }
}

function labelStyle() {
  return {
    display: 'block',
    fontSize: '11px',
    color: 'var(--text-muted)',
    marginBottom: '6px',
    fontFamily: 'ui-monospace,monospace',
    textTransform: 'uppercase' as const,
    letterSpacing: '.04em',
    fontWeight: 700,
  }
}

function inputStyle() {
  return {
    width: '100%',
    padding: '12px',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    fontSize: '16px',
    fontFamily: 'system-ui,-apple-system,sans-serif',
    boxSizing: 'border-box' as const,
    outline: 'none',
    color: 'var(--text)',
    background: 'var(--surface)',
  }
}

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inp = inputStyle()

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const type = await checkEmailType(email)

    setLoading(false)

    if (type === 'internal') {
      setStep('password')
      return
    }

    const result = await signInWithMagicLink(email)

    if (result?.error) {
      setError(result.error)
      return
    }

    setStep('magic_sent')
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signInWithPassword(email, password)

    setLoading(false)

    if (result?.error) {
      setError(result.error)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'system-ui,-apple-system,sans-serif',
        color: 'var(--text)',
      }}
    >
      <div style={cardStyle()}>
        <div style={{ marginBottom: '28px' }}>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.01em',
            }}
          >
            Hendren Custom Homes
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '4px',
              fontFamily: 'ui-monospace,monospace',
            }}
          >
            Field Operations Platform
          </div>
        </div>

        {step === 'email' && (
          <form onSubmit={handleEmailSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle()}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                style={inp}
              />
            </div>

            {error && (
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--red)',
                  marginBottom: '12px',
                  background: 'var(--red-bg)',
                  border: '1px solid var(--red)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              style={{
                width: '100%',
                padding: '12px',
                background: loading || !email ? 'var(--border)' : 'var(--text)',
                color: 'var(--bg)',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading || !email ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Checking...' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit}>
            <div
              style={{
                marginBottom: '6px',
                fontSize: '14px',
                color: 'var(--text-muted)',
              }}
            >
              Signing in as <strong style={{ color: 'var(--text)' }}>{email}</strong>
            </div>

            <button
              type="button"
              onClick={() => {
                setStep('email')
                setError('')
                setPassword('')
              }}
              style={{
                fontSize: '12px',
                color: 'var(--blue)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 0 16px',
                fontFamily: 'ui-monospace,monospace',
              }}
            >
              ← Change email
            </button>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle()}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoFocus
                style={inp}
              />
            </div>

            {error && (
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--red)',
                  marginBottom: '12px',
                  background: 'var(--red-bg)',
                  border: '1px solid var(--red)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              style={{
                width: '100%',
                padding: '12px',
                background: loading || !password ? 'var(--border)' : 'var(--text)',
                color: 'var(--bg)',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading || !password ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {step === 'magic_sent' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '30px', marginBottom: '12px' }}>📬</div>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 600,
                marginBottom: '8px',
                color: 'var(--text)',
              }}
            >
              Check your email
            </div>
            <div
              style={{
                fontSize: '14px',
                color: 'var(--text-muted)',
                lineHeight: 1.6,
                marginBottom: '20px',
              }}
            >
              We sent a sign-in link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
              Click the link to continue.
            </div>
            <button
              onClick={() => {
                setStep('email')
                setError('')
              }}
              style={{
                fontSize: '12px',
                color: 'var(--blue)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'ui-monospace,monospace',
              }}
            >
              ← Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  )
}