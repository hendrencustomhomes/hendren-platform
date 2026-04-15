'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import { createClient } from '@/utils/supabase/client'
import { createCompany } from '@/lib/companies'

const inputStyle = {
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: '16px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
} as const

const labelStyle = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: '4px',
  display: 'block',
} as const

export default function NewCompanyPage() {
  const supabase = createClient()
  const router = useRouter()

  const [companyName, setCompanyName] = useState('')
  const [isSub, setIsSub] = useState(false)
  const [isVendor, setIsVendor] = useState(false)
  const [isService, setIsService] = useState(false)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [primaryAddress, setPrimaryAddress] = useState('')
  const [billingSameAsPrimary, setBillingSameAsPrimary] = useState(true)
  const [billingAddress, setBillingAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const name = companyName.trim()
    if (!name) {
      setError('Company name is required.')
      return
    }
    if (!isSub && !isVendor && !isService) {
      setError('Select at least one company type.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const id = await createCompany(supabase, {
        company_name: name,
        is_subcontractor: isSub,
        is_vendor: isVendor,
        is_service_company: isService,
        phone: phone.trim() || null,
        email: email.trim() || null,
        primary_address: primaryAddress.trim() || null,
        billing_same_as_primary: billingSameAsPrimary,
        billing_address: billingSameAsPrimary ? null : billingAddress.trim() || null,
        is_active: true,
      })
      router.push(`/more/companies/${id}`)
    } catch (e) {
      console.error('Failed to create company:', e)
      setError(e instanceof Error ? e.message : 'Failed to create company.')
      setSaving(false)
    }
  }

  return (
    <>
      <Nav title="New Company" back="/more/companies" />

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Company name */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '18px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Company
          </div>

          <div>
            <label style={labelStyle} htmlFor="company-name">
              Name *
            </label>
            <input
              id="company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company name"
              style={inputStyle}
            />
          </div>

          {/* Type checkboxes */}
          <div>
            <label style={labelStyle}>Type *</label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {(
                [
                  { key: 'sub', label: 'Subcontractor', val: isSub, set: setIsSub },
                  { key: 'vendor', label: 'Vendor', val: isVendor, set: setIsVendor },
                  { key: 'service', label: 'Service', val: isService, set: setIsService },
                ] as const
              ).map(({ key, label, val, set }) => (
                <label
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={(e) => set(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Contact info */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '18px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Contact
          </div>

          <div>
            <label style={labelStyle} htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
              inputMode="tel"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="office@example.com"
              inputMode="email"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Address */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '18px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Address
          </div>

          <div>
            <label style={labelStyle} htmlFor="primary-address">
              Primary Address
            </label>
            <input
              id="primary-address"
              value={primaryAddress}
              onChange={(e) => setPrimaryAddress(e.target.value)}
              placeholder="123 Main St, City, IN 46000"
              style={inputStyle}
            />
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={billingSameAsPrimary}
              onChange={(e) => setBillingSameAsPrimary(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            Billing same as primary
          </label>

          {!billingSameAsPrimary && (
            <div>
              <label style={labelStyle} htmlFor="billing-address">
                Billing Address
              </label>
              <input
                id="billing-address"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="456 Billing Ave, City, IN 46000"
                style={inputStyle}
              />
            </div>
          )}
        </div>

        {error && (
          <div style={{ fontSize: '13px', color: '#fca5a5', padding: '4px 0' }}>{error}</div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => router.push('/more/companies')}
            disabled={saving}
            style={{
              flex: 1,
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '12px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2,
              background: 'var(--text)',
              color: 'var(--surface)',
              border: 'none',
              borderRadius: '12px',
              padding: '12px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save Company'}
          </button>
        </div>
      </div>
    </>
  )
}
