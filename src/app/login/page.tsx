'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type Step = 'email' | 'password' | 'magic_sent'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Check if this email belongs to an internal user
    const { data, error: fnError } = await supabase
      .rpc('is_internal_email', { p_email: email.toLowerCase().trim() })

    setLoading(false)

    if (fnError) {
      // RPC doesn't exist yet or network error — default to magic link
      await sendMagicLink()
      return
    }

    if (data === true) {
      setStep('password')
    } else {
      await sendMagicLink()
    }
  }

  async function sendMagicLink() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: {
        shouldCreateUser: false, // external users must be invited first
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setStep('magic_sent')
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      window.location.href = '/'
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f7f6f3',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: '#fff',
        border: '1px solid #e2dfd8',
        borderRadius: '12px',
        padding: '36px 32px',
        width: '100%',
        maxWidth: '380px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        {/* Logo / Brand */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#1a1a18',
            letterSpacing: '-0.01em',
          }}>
            Hendren Custom Homes
          </div>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '3px', fontFamily: 'ui-monospace, monospace' }}>
            Field Operations Platform
          </div>
        </div>

        {/* Step: Email */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#777', marginBottom: '5px', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '9px 11px',
                  border: '1px solid #ccc',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontFamily: 'ui-monospace, monospace',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
            {error && <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '12px' }}>{error}</div>}
            <button
              type="submit"
              disabled={loading || !email}
              style={{
                width: '100%',
                padding: '10px',
                background: loading ? '#ccc' : '#1a1a18',
                color: '#fff',
                border: 'none',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Checking...' : 'Continue →'}
            </button>
          </form>
        )}

        {/* Step: Password (internal users) */}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit}>
            <div style={{ marginBottom: '6px', fontSize: '13px', color: '#555' }}>
              Signing in as <strong>{email}</strong>
            </div>
            <button
              type="button"
              onClick={() => { setStep('email'); setError(''); setPassword('') }}
              style={{ fontSize: '11px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 16px', fontFamily: 'ui-monospace, monospace' }}
            >
              ← Change email
            </button>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#777', marginBottom: '5px', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '9px 11px',
                  border: '1px solid #ccc',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontFamily: 'ui-monospace, monospace',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
            {error && <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '12px' }}>{error}</div>}
            <button
              type="submit"
              disabled={loading || !password}
              style={{
                width: '100%',
                padding: '10px',
                background: loading ? '#ccc' : '#1a1a18',
                color: '#fff',
                border: 'none',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        )}

        {/* Step: Magic link sent */}
        {step === 'magic_sent' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>📬</div>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Check your email</div>
            <div style={{ fontSize: '12px', color: '#777', lineHeight: '1.6', marginBottom: '20px' }}>
              We sent a sign-in link to <strong>{email}</strong>. Click the link in that email to continue.
            </div>
            <button
              onClick={() => { setStep('email'); setError('') }}
              style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'ui-monospace, monospace' }}
            >
              ← Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
