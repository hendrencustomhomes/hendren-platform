'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import { createClient } from '@/utils/supabase/client'
import { fetchActiveTrades, type TradeOption } from '@/lib/trades'
import {
  getCompany,
  updateCompany,
  getCompanyContacts,
  createCompanyContact,
  updateCompanyContact,
  deleteCompanyContact,
  getCompanyTradeIds,
  setCompanyTrades,
  getCompanyComplianceDocs,
  companyTypeTags,
  complianceDocStatus,
  DOC_TYPE_LABELS,
  type Company,
  type CompanyContact,
  type CompanyComplianceDocument,
} from '@/lib/companies'

// ─── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle = {
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: '15px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
} as const

const labelStyle = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: '4px',
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
} as const

const sectionCardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '18px',
  overflow: 'hidden',
} as const

const sectionHeaderStyle = {
  padding: '14px 16px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
} as const

const sectionTitleStyle = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--text)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
} as const

const ghostBtnStyle = {
  background: 'transparent',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '5px 10px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
} as const

const solidBtnStyle = {
  background: 'var(--text)',
  color: 'var(--surface)',
  border: 'none',
  borderRadius: '8px',
  padding: '5px 10px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
} as const

const DOC_TYPES = ['coi_gl', 'coi_wc', 'w9', 'general_contract'] as const

function statusDot(status: 'ok' | 'expiring' | 'expired' | 'missing') {
  const color =
    status === 'ok'
      ? '#4ade80'
      : status === 'expiring'
        ? '#fbbf24'
        : '#f87171'
  return (
    <span
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  )
}

// ─── Info section ──────────────────────────────────────────────────────────────

function InfoSection({
  company,
  isAdmin,
  onUpdated,
}: {
  company: Company
  isAdmin: boolean
  onUpdated: (updated: Company) => void
}) {
  const supabase = createClient()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [companyName, setCompanyName] = useState(company.company_name)
  const [isSub, setIsSub] = useState(company.is_subcontractor)
  const [isVendor, setIsVendor] = useState(company.is_vendor)
  const [isService, setIsService] = useState(company.is_service_company)
  const [phone, setPhone] = useState(company.phone ?? '')
  const [email, setEmail] = useState(company.email ?? '')
  const [primaryAddress, setPrimaryAddress] = useState(company.primary_address ?? '')
  const [billingSame, setBillingSame] = useState(company.billing_same_as_primary)
  const [billingAddress, setBillingAddress] = useState(company.billing_address ?? '')
  const [isActive, setIsActive] = useState(company.is_active)

  function handleCancel() {
    setCompanyName(company.company_name)
    setIsSub(company.is_subcontractor)
    setIsVendor(company.is_vendor)
    setIsService(company.is_service_company)
    setPhone(company.phone ?? '')
    setEmail(company.email ?? '')
    setPrimaryAddress(company.primary_address ?? '')
    setBillingSame(company.billing_same_as_primary)
    setBillingAddress(company.billing_address ?? '')
    setIsActive(company.is_active)
    setError(null)
    setEditing(false)
  }

  async function handleSave() {
    const name = companyName.trim()
    if (!name) { setError('Company name is required.'); return }
    if (!isSub && !isVendor && !isService) { setError('Select at least one type.'); return }

    setSaving(true)
    setError(null)
    try {
      const payload = {
        company_name: name,
        is_subcontractor: isSub,
        is_vendor: isVendor,
        is_service_company: isService,
        phone: phone.trim() || null,
        email: email.trim() || null,
        primary_address: primaryAddress.trim() || null,
        billing_same_as_primary: billingSame,
        billing_address: billingSame ? null : billingAddress.trim() || null,
        is_active: isActive,
      }
      await updateCompany(supabase, company.id, payload)
      onUpdated({ ...company, ...payload })
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const tags = companyTypeTags(company)

  return (
    <div style={sectionCardStyle}>
      <div style={sectionHeaderStyle}>
        <span style={sectionTitleStyle}>Info</span>
        {isAdmin && !editing && (
          <button type="button" style={ghostBtnStyle} onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
        {isAdmin && editing && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" style={ghostBtnStyle} onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              style={{ ...solidBtnStyle, opacity: saving ? 0.7 : 1 }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {editing ? (
          <>
            <div>
              <label style={labelStyle} htmlFor="info-name">Name *</label>
              <input id="info-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Type *</label>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                {([
                  { label: 'Subcontractor', val: isSub, set: setIsSub },
                  { label: 'Vendor', val: isVendor, set: setIsVendor },
                  { label: 'Service', val: isService, set: setIsService },
                ] as const).map(({ label, val, set }) => (
                  <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle} htmlFor="info-phone">Phone</label>
              <input id="info-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" style={inputStyle} placeholder="(555) 000-0000" />
            </div>

            <div>
              <label style={labelStyle} htmlFor="info-email">Email</label>
              <input id="info-email" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" style={inputStyle} placeholder="office@example.com" />
            </div>

            <div>
              <label style={labelStyle} htmlFor="info-addr">Primary Address</label>
              <input id="info-addr" value={primaryAddress} onChange={(e) => setPrimaryAddress(e.target.value)} style={inputStyle} placeholder="123 Main St, City, IN 46000" />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              Billing same as primary
            </label>

            {!billingSame && (
              <div>
                <label style={labelStyle} htmlFor="info-billing">Billing Address</label>
                <input id="info-billing" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} style={inputStyle} placeholder="456 Billing Ave, City, IN 46000" />
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              Active
            </label>

            {error && <div style={{ fontSize: '13px', color: '#fca5a5' }}>{error}</div>}
          </>
        ) : (
          <>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
                {company.company_name}
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                {tags.map((t) => (
                  <span key={t} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 8px' }}>
                    {t}
                  </span>
                ))}
                {!company.is_active && (
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#fbbf24', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 8px' }}>
                    Inactive
                  </span>
                )}
              </div>
            </div>

            {(company.phone || company.email) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {company.phone && <Field label="Phone" value={company.phone} />}
                {company.email && <Field label="Email" value={company.email} />}
              </div>
            )}

            {(company.primary_address || (!company.billing_same_as_primary && company.billing_address)) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {company.primary_address && <Field label="Primary Address" value={company.primary_address} />}
                {!company.billing_same_as_primary && company.billing_address && (
                  <Field label="Billing Address" value={company.billing_address} />
                )}
                {company.billing_same_as_primary && company.primary_address && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Billing same as primary</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '14px', color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

// ─── Contacts section ──────────────────────────────────────────────────────────

function ContactsSection({
  companyId,
  isAdmin,
}: {
  companyId: string
  isAdmin: boolean
}) {
  const supabase = createClient()
  const [contacts, setContacts] = useState<CompanyContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit state: contactId → partial
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<CompanyContact>>({})

  // New contact form
  const [showAdd, setShowAdd] = useState(false)
  const [newContact, setNewContact] = useState({ full_name: '', title: '', phone: '', email: '' })
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setContacts(await getCompanyContacts(supabase, companyId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contacts.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    const full_name = newContact.full_name.trim()
    if (!full_name) { setError('Contact name is required.'); return }
    setCreating(true)
    setError(null)
    try {
      await createCompanyContact(supabase, {
        company_id: companyId,
        full_name,
        title: newContact.title.trim() || null,
        phone: newContact.phone.trim() || null,
        email: newContact.email.trim() || null,
      })
      setNewContact({ full_name: '', title: '', phone: '', email: '' })
      setShowAdd(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add contact.')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveEdit(id: string) {
    setSaving(true)
    setError(null)
    try {
      await updateCompanyContact(supabase, id, {
        full_name: editDraft.full_name?.trim() || undefined,
        title: editDraft.title?.trim() || null,
        phone: editDraft.phone?.trim() || null,
        email: editDraft.email?.trim() || null,
      })
      setEditingId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    setError(null)
    try {
      await deleteCompanyContact(supabase, id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={sectionCardStyle}>
      <div style={sectionHeaderStyle}>
        <span style={sectionTitleStyle}>Contacts</span>
        {isAdmin && (
          <button
            type="button"
            style={ghostBtnStyle}
            onClick={() => { setShowAdd((v) => !v); setError(null) }}
          >
            {showAdd ? 'Cancel' : 'Add'}
          </button>
        )}
      </div>

      {isAdmin && showAdd && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle} htmlFor="nc-name">Name *</label>
              <input id="nc-name" value={newContact.full_name} onChange={(e) => setNewContact((p) => ({ ...p, full_name: e.target.value }))} style={inputStyle} placeholder="Full name" />
            </div>
            <div>
              <label style={labelStyle} htmlFor="nc-pos">Position</label>
              <input id="nc-pos" value={newContact.title} onChange={(e) => setNewContact((p) => ({ ...p, title: e.target.value }))} style={inputStyle} placeholder="Project Manager" />
            </div>
            <div>
              <label style={labelStyle} htmlFor="nc-phone">Phone</label>
              <input id="nc-phone" value={newContact.phone} onChange={(e) => setNewContact((p) => ({ ...p, phone: e.target.value }))} inputMode="tel" style={inputStyle} placeholder="(555) 000-0000" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle} htmlFor="nc-email">Email</label>
              <input id="nc-email" value={newContact.email} onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))} inputMode="email" style={inputStyle} placeholder="name@example.com" />
            </div>
          </div>
          <button type="button" style={{ ...solidBtnStyle, padding: '9px 12px', fontSize: '13px', opacity: creating ? 0.7 : 1 }} onClick={handleCreate} disabled={creating}>
            {creating ? 'Adding…' : 'Add Contact'}
          </button>
        </div>
      )}

      {error && (
        <div style={{ padding: '8px 16px', fontSize: '12px', color: '#fca5a5', borderBottom: '1px solid var(--border)' }}>{error}</div>
      )}

      {loading ? (
        <div style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</div>
      ) : contacts.length === 0 ? (
        <div style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>No contacts added.</div>
      ) : (
        contacts.map((contact, index) => (
          <div
            key={contact.id}
            style={{ borderTop: index === 0 ? 'none' : '1px solid var(--border)', padding: '12px 16px' }}
          >
            {editingId === contact.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Name</label>
                    <input value={editDraft.full_name ?? contact.full_name} onChange={(e) => setEditDraft((p) => ({ ...p, full_name: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Position</label>
                    <input value={editDraft.title ?? contact.title ?? ''} onChange={(e) => setEditDraft((p) => ({ ...p, title: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input value={editDraft.phone ?? contact.phone ?? ''} onChange={(e) => setEditDraft((p) => ({ ...p, phone: e.target.value }))} inputMode="tel" style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Email</label>
                    <input value={editDraft.email ?? contact.email ?? ''} onChange={(e) => setEditDraft((p) => ({ ...p, email: e.target.value }))} inputMode="email" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" style={ghostBtnStyle} onClick={() => setEditingId(null)} disabled={saving}>Cancel</button>
                  <button type="button" style={{ ...solidBtnStyle, opacity: saving ? 0.7 : 1 }} onClick={() => handleSaveEdit(contact.id)} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{contact.full_name}</div>
                  {contact.title && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{contact.title}</div>}
                  {contact.phone && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{contact.phone}</div>}
                  {contact.email && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{contact.email}</div>}
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      type="button"
                      style={ghostBtnStyle}
                      onClick={() => { setEditingId(contact.id); setEditDraft({}) }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      style={{ ...ghostBtnStyle, color: '#f87171', borderColor: '#f87171' }}
                      onClick={() => handleDelete(contact.id)}
                      disabled={saving}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ─── Trades section ────────────────────────────────────────────────────────────

function TradesSection({
  companyId,
  isAdmin,
}: {
  companyId: string
  isAdmin: boolean
}) {
  const supabase = createClient()
  const [allTrades, setAllTrades] = useState<TradeOption[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [draft, setDraft] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [trades, ids] = await Promise.all([
        fetchActiveTrades(supabase),
        getCompanyTradeIds(supabase, companyId),
      ])
      setAllTrades(trades)
      setAssignedIds(new Set(ids))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trades.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleEdit() {
    setDraft(new Set(assignedIds))
    setEditing(true)
    setError(null)
  }

  function handleCancel() {
    setEditing(false)
    setError(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await setCompanyTrades(supabase, companyId, Array.from(draft))
      setAssignedIds(new Set(draft))
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save trades.')
    } finally {
      setSaving(false)
    }
  }

  function toggleTrade(id: string) {
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const assignedTrades = allTrades.filter((t) => assignedIds.has(t.id))

  return (
    <div style={sectionCardStyle}>
      <div style={sectionHeaderStyle}>
        <span style={sectionTitleStyle}>Trades</span>
        {isAdmin && !editing && (
          <button type="button" style={ghostBtnStyle} onClick={handleEdit}>Edit</button>
        )}
        {isAdmin && editing && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" style={ghostBtnStyle} onClick={handleCancel} disabled={saving}>Cancel</button>
            <button type="button" style={{ ...solidBtnStyle, opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '8px 16px', fontSize: '12px', color: '#fca5a5', borderBottom: '1px solid var(--border)' }}>{error}</div>
      )}

      <div style={{ padding: '14px 16px' }}>
        {loading ? (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</div>
        ) : editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {allTrades.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No active trades configured.</div>
            ) : (
              allTrades.map((trade) => (
                <label key={trade.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={draft.has(trade.id)}
                    onChange={() => toggleTrade(trade.id)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  {trade.name}
                </label>
              ))
            )}
          </div>
        ) : assignedTrades.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No trades assigned.</div>
        ) : (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {assignedTrades.map((t) => (
              <span
                key={t.id}
                style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 10px' }}
              >
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Compliance section ────────────────────────────────────────────────────────

function ComplianceSection({ companyId }: { companyId: string }) {
  const supabase = createClient()
  const [docs, setDocs] = useState<CompanyComplianceDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCompanyComplianceDocs(supabase, companyId)
      .then(setDocs)
      .catch((e) => { setError('Failed to load compliance docs.'); console.error(e) })
      .finally(() => setLoading(false))
  }, [companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  const docMap = new Map(docs.map((d) => [d.doc_type, d]))

  return (
    <div style={sectionCardStyle}>
      <div style={sectionHeaderStyle}>
        <span style={sectionTitleStyle}>Compliance</span>
      </div>

      {error && (
        <div style={{ padding: '8px 16px', fontSize: '12px', color: '#fca5a5', borderBottom: '1px solid var(--border)' }}>{error}</div>
      )}

      {loading ? (
        <div style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <div>
          {DOC_TYPES.map((docType, index) => {
            const doc = docMap.get(docType)
            const status = complianceDocStatus(doc)
            const hasExpiry = docType === 'coi_gl' || docType === 'coi_wc'

            return (
              <div
                key={docType}
                style={{
                  borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {statusDot(status)}
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                      {DOC_TYPE_LABELS[docType]}
                    </div>
                    {doc ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {hasExpiry && doc.expires_at
                          ? `Expires ${doc.expires_at}`
                          : doc.created_at
                            ? `Received ${doc.created_at.slice(0, 10)}`
                            : 'On file'}
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Not on file</div>
                    )}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color:
                      status === 'ok'
                        ? '#4ade80'
                        : status === 'expiring'
                          ? '#fbbf24'
                          : status === 'expired'
                            ? '#f87171'
                            : 'var(--text-muted)',
                  }}
                >
                  {status === 'ok'
                    ? 'OK'
                    : status === 'expiring'
                      ? 'Expiring'
                      : status === 'expired'
                        ? 'Expired'
                        : 'Missing'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Document upload available in next release.
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CompanyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const id = typeof params.id === 'string' ? params.id : ''

  const [company, setCompany] = useState<Company | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id

      const [co, adminResult] = await Promise.all([
        getCompany(supabase, id).catch((e) => {
          setError('Failed to load company.')
          console.error(e)
          return null
        }),
        userId
          ? supabase
              .from('internal_access')
              .select('is_admin, is_active')
              .eq('profile_id', userId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      setCompany(co)
      if (adminResult && 'data' in adminResult) {
        const d = adminResult.data as { is_admin: boolean; is_active: boolean } | null
        setIsAdmin(Boolean(d?.is_admin && d?.is_active))
      }
      setLoading(false)
    }
    if (id) load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <>
        <Nav title="Company" back="/more/companies" />
        <div style={{ padding: '20px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Loading…
        </div>
      </>
    )
  }

  if (error || !company) {
    return (
      <>
        <Nav title="Company" back="/more/companies" />
        <div style={{ padding: '20px 16px' }}>
          <div style={{ fontSize: '13px', color: '#fca5a5', marginBottom: '12px' }}>
            {error ?? 'Company not found.'}
          </div>
          <button
            type="button"
            style={ghostBtnStyle}
            onClick={() => router.push('/more/companies')}
          >
            Back to Companies
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <Nav title={company.company_name} back="/more/companies" />

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <InfoSection company={company} isAdmin={isAdmin} onUpdated={setCompany} />
        <ContactsSection companyId={company.id} isAdmin={isAdmin} />
        <TradesSection companyId={company.id} isAdmin={isAdmin} />
        <ComplianceSection companyId={company.id} />
      </div>
    </>
  )
}
