'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import { createClient } from '@/utils/supabase/client'
import {
  createPricingHeaderRevision,
  createPricingRow,
  fetchPricingCompanies,
  fetchPricingCostCodes,
  fetchPricingTrades,
  getPricingHeader,
  listCatalogItems,
  listPricingRowsForHeader,
  updatePricingHeader,
  updatePricingRow,
} from '@/lib/pricing-sources'
import type {
  CatalogItem,
  PricingCompanyOption,
  PricingCostCodeOption,
  PricingHeader,
  PricingRow,
  PricingTradeOption,
} from '@/lib/pricing-sources-types'

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
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
} as const

const inputStyle = {
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
} as const

const cellInputStyle = {
  width: '100%',
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '8px 10px',
  color: 'var(--text)',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box' as const,
} as const

function metaPill(text: string, tone: 'default' | 'active' | 'warning' = 'default') {
  const color = tone === 'active' ? 'var(--blue)' : tone === 'warning' ? '#fbbf24' : 'var(--text-muted)'
  return (
    <span style={{ fontSize: '11px', fontWeight: 700, color, border: '1px solid var(--border)', borderRadius: '999px', padding: '2px 8px' }}>
      {text}
    </span>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '14px', color: 'var(--text)' }}>{value || '—'}</div>
    </div>
  )
}

function formatMoney(value: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

function parseNullableNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export default function PriceSheetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const id = typeof params.id === 'string' ? params.id : ''

  const [header, setHeader] = useState<PricingHeader | null>(null)
  const [rows, setRows] = useState<PricingRow[]>([])
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [companies, setCompanies] = useState<PricingCompanyOption[]>([])
  const [trades, setTrades] = useState<PricingTradeOption[]>([])
  const [costCodes, setCostCodes] = useState<PricingCostCodeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingHeader, setSavingHeader] = useState(false)
  const [creatingRow, setCreatingRow] = useState(false)
  const [creatingRevision, setCreatingRevision] = useState(false)
  const [savingRowIds, setSavingRowIds] = useState<string[]>([])

  const [headerTitle, setHeaderTitle] = useState('')
  const [headerStatus, setHeaderStatus] = useState('draft')
  const [headerEffectiveDate, setHeaderEffectiveDate] = useState('')
  const [headerNotes, setHeaderNotes] = useState('')
  const [headerIsActive, setHeaderIsActive] = useState(true)

  const [newCatalogSku, setNewCatalogSku] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newVendorSku, setNewVendorSku] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newUnitPrice, setNewUnitPrice] = useState('')
  const [newLeadDays, setNewLeadDays] = useState('')
  const [newNotes, setNewNotes] = useState('')

  async function loadPage() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [headerRow, rowRows, companyRows, tradeRows, costCodeRows] = await Promise.all([
        getPricingHeader(supabase, id),
        listPricingRowsForHeader(supabase, id),
        fetchPricingCompanies(supabase),
        fetchPricingTrades(supabase),
        fetchPricingCostCodes(supabase),
      ])
      setHeader(headerRow)
      setRows(rowRows)
      setCompanies(companyRows)
      setTrades(tradeRows)
      setCostCodes(costCodeRows)

      if (headerRow) {
        const catalogRows = await listCatalogItems(supabase, { cost_code_id: headerRow.cost_code_id, is_active: true })
        setCatalogItems(catalogRows)
        setHeaderTitle(headerRow.title)
        setHeaderStatus(headerRow.status)
        setHeaderEffectiveDate(headerRow.effective_date ?? '')
        setHeaderNotes(headerRow.notes ?? '')
        setHeaderIsActive(headerRow.is_active)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load price sheet.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const companyMap = useMemo(() => new Map(companies.map((row) => [row.id, row.company_name])), [companies])
  const tradeMap = useMemo(() => new Map(trades.map((row) => [row.id, row.name])), [trades])
  const costCodeMap = useMemo(() => new Map(costCodes.map((row) => [row.id, `${row.cost_code} · ${row.title}`])), [costCodes])
  const catalogMap = useMemo(() => new Map(catalogItems.map((row) => [row.catalog_sku, row])), [catalogItems])

  function updateLocalRow(rowId: string, patch: Partial<PricingRow>) {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)))
  }

  async function commitRow(rowId: string) {
    const row = rows.find((item) => item.id === rowId)
    if (!row) return
    setSavingRowIds((current) => Array.from(new Set([...current, rowId])))
    try {
      const updated = await updatePricingRow(supabase, row.id, {
        description_snapshot: row.description_snapshot,
        vendor_sku: row.vendor_sku,
        unit: row.unit,
        unit_price: row.unit_price,
        lead_days: row.lead_days,
        notes: row.notes,
        is_active: row.is_active,
      })
      updateLocalRow(row.id, updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save row.')
      await loadPage()
    } finally {
      setSavingRowIds((current) => current.filter((value) => value !== rowId))
    }
  }

  function handleCellKeyDown(
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    onCommit?: () => void
  ) {
    if (event.key === 'Enter') {
      event.preventDefault()
      onCommit?.()
      event.currentTarget.blur()
    }
  }

  function applyCatalogDefaults(catalogSku: string) {
    setNewCatalogSku(catalogSku)
    const item = catalogMap.get(catalogSku)
    if (!item) return
    setNewDescription(item.title)
    setNewUnit(item.default_unit ?? '')
  }

  async function handleSaveHeader() {
    if (!header) return
    setSavingHeader(true)
    setError(null)
    try {
      const updated = await updatePricingHeader(supabase, header.id, {
        title: headerTitle,
        status: headerStatus,
        effective_date: headerEffectiveDate || null,
        notes: headerNotes || null,
        is_active: headerIsActive,
      })
      setHeader(updated)
      setHeaderTitle(updated.title)
      setHeaderStatus(updated.status)
      setHeaderEffectiveDate(updated.effective_date ?? '')
      setHeaderNotes(updated.notes ?? '')
      setHeaderIsActive(updated.is_active)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save header.')
    } finally {
      setSavingHeader(false)
    }
  }

  async function handleCreateRevision() {
    if (!header) return
    setCreatingRevision(true)
    setError(null)
    try {
      const result = await createPricingHeaderRevision(supabase, header.id)
      router.push(`/more/price-sheets/${result.header.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create revision.')
    } finally {
      setCreatingRevision(false)
    }
  }

  async function handleCreateRow() {
    if (!header) return
    if (!newCatalogSku) {
      setError('Catalog item is required.')
      return
    }
    setCreatingRow(true)
    setError(null)
    try {
      const created = await createPricingRow(supabase, {
        pricing_header_id: header.id,
        catalog_sku: newCatalogSku,
        description_snapshot: newDescription || null,
        vendor_sku: newVendorSku || null,
        unit: newUnit || null,
        unit_price: parseNullableNumber(newUnitPrice),
        lead_days: parseNullableNumber(newLeadDays),
        notes: newNotes || null,
      })
      setRows((current) => [...current, created])
      setNewCatalogSku('')
      setNewDescription('')
      setNewVendorSku('')
      setNewUnit('')
      setNewUnitPrice('')
      setNewLeadDays('')
      setNewNotes('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add row.')
    } finally {
      setCreatingRow(false)
    }
  }

  if (loading) {
    return (
      <>
        <Nav title="Price Sheet" back="/more/price-sheets" />
        <div style={{ padding: '20px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</div>
      </>
    )
  }

  if (error && !header) {
    return (
      <>
        <Nav title="Price Sheet" back="/more/price-sheets" />
        <div style={{ padding: '20px 16px' }}>
          <div style={{ fontSize: '13px', color: '#fca5a5', marginBottom: '12px' }}>{error}</div>
          <button type="button" onClick={() => router.push('/more/price-sheets')} style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Back to Price Sheets</button>
        </div>
      </>
    )
  }

  if (!header) {
    return (
      <>
        <Nav title="Price Sheet" back="/more/price-sheets" />
        <div style={{ padding: '20px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>Price sheet not found.</div>
      </>
    )
  }

  return (
    <>
      <Nav title={header.title} back="/more/price-sheets" />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {error && <div style={{ fontSize: '13px', color: '#fca5a5' }}>{error}</div>}

        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Header</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {metaPill(`rev ${header.revision}`)}
              {metaPill(header.status)}
              {metaPill(header.is_active ? 'active' : 'inactive', header.is_active ? 'active' : 'warning')}
            </div>
          </div>

          <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Title</div>
              <input value={headerTitle} onChange={(e) => setHeaderTitle(e.target.value)} style={inputStyle} />
            </div>
            <Field label="Company" value={companyMap.get(header.company_id)} />
            <Field label="Trade" value={tradeMap.get(header.trade_id)} />
            <Field label="Cost Code" value={costCodeMap.get(header.cost_code_id)} />
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Status</div>
              <select value={headerStatus} onChange={(e) => setHeaderStatus(e.target.value)} style={inputStyle}>
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="superseded">superseded</option>
                <option value="archived">archived</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Effective Date</div>
              <input type="date" value={headerEffectiveDate} onChange={(e) => setHeaderEffectiveDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                <input type="checkbox" checked={headerIsActive} onChange={(e) => setHeaderIsActive(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                Active
              </label>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Notes</div>
              <textarea value={headerNotes} onChange={(e) => setHeaderNotes(e.target.value)} style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleCreateRevision} disabled={creatingRevision} style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', fontWeight: 700, cursor: creatingRevision ? 'not-allowed' : 'pointer', opacity: creatingRevision ? 0.7 : 1 }}>{creatingRevision ? 'Creating Revision…' : 'Create Revision'}</button>
              <button type="button" onClick={handleSaveHeader} disabled={savingHeader} style={{ background: 'var(--text)', color: 'var(--surface)', border: 'none', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', fontWeight: 700, cursor: savingHeader ? 'not-allowed' : 'pointer', opacity: savingHeader ? 0.7 : 1 }}>{savingHeader ? 'Saving…' : 'Save Header'}</button>
            </div>
          </div>
        </div>

        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Worksheet</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {metaPill(`${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`)}
              {savingRowIds.length > 0 ? metaPill('saving…') : null}
            </div>
          </div>

          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'minmax(180px, 1.2fr) repeat(6, minmax(110px, 1fr))', gap: '8px', overflowX: 'auto' }}>
            <select value={newCatalogSku} onChange={(e) => applyCatalogDefaults(e.target.value)} onKeyDown={(e) => handleCellKeyDown(e)} style={cellInputStyle}>
              <option value="">Select catalog item</option>
              {catalogItems.map((item) => <option key={item.catalog_sku} value={item.catalog_sku}>{item.catalog_sku} · {item.title}</option>)}
            </select>
            <input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} onKeyDown={(e) => handleCellKeyDown(e)} placeholder="Description" style={cellInputStyle} />
            <input value={newVendorSku} onChange={(e) => setNewVendorSku(e.target.value)} onKeyDown={(e) => handleCellKeyDown(e)} placeholder="Vendor SKU" style={cellInputStyle} />
            <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} onKeyDown={(e) => handleCellKeyDown(e)} placeholder="Unit" style={cellInputStyle} />
            <input value={newUnitPrice} onChange={(e) => setNewUnitPrice(e.target.value)} onKeyDown={(e) => handleCellKeyDown(e)} inputMode="decimal" placeholder="Unit price" style={cellInputStyle} />
            <input value={newLeadDays} onChange={(e) => setNewLeadDays(e.target.value)} onKeyDown={(e) => handleCellKeyDown(e)} inputMode="numeric" placeholder="Lead days" style={cellInputStyle} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, () => { void handleCreateRow() })} placeholder="Notes" style={cellInputStyle} />
              <button type="button" onClick={() => void handleCreateRow()} disabled={creatingRow} style={{ background: 'var(--text)', color: 'var(--surface)', border: 'none', borderRadius: '8px', padding: '0 12px', fontSize: '12px', fontWeight: 700, cursor: creatingRow ? 'not-allowed' : 'pointer', opacity: creatingRow ? 0.7 : 1, whiteSpace: 'nowrap' }}>{creatingRow ? 'Adding…' : 'Add'}</button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>No pricing rows yet.</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1180px' }}>
                  <thead>
                    <tr>
                      {['Source SKU', 'Catalog SKU', 'Description', 'Vendor SKU', 'Unit', 'Unit Price', 'Lead Days', 'Active', 'Notes', 'Cost Code'].map((label) => <th key={label} style={{ textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', padding: '12px 14px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' }}>{row.source_sku}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '13px', whiteSpace: 'nowrap' }}>{row.catalog_sku}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}><input value={row.description_snapshot} onChange={(e) => updateLocalRow(row.id, { description_snapshot: e.target.value })} onBlur={() => void commitRow(row.id)} onKeyDown={(e) => handleCellKeyDown(e, () => { void commitRow(row.id) })} style={cellInputStyle} /></td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}><input value={row.vendor_sku ?? ''} onChange={(e) => updateLocalRow(row.id, { vendor_sku: e.target.value || null })} onBlur={() => void commitRow(row.id)} onKeyDown={(e) => handleCellKeyDown(e, () => { void commitRow(row.id) })} style={cellInputStyle} /></td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}><input value={row.unit ?? ''} onChange={(e) => updateLocalRow(row.id, { unit: e.target.value || null })} onBlur={() => void commitRow(row.id)} onKeyDown={(e) => handleCellKeyDown(e, () => { void commitRow(row.id) })} style={cellInputStyle} /></td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}><input value={row.unit_price == null ? '' : String(row.unit_price)} onChange={(e) => updateLocalRow(row.id, { unit_price: parseNullableNumber(e.target.value) })} onBlur={() => void commitRow(row.id)} onKeyDown={(e) => handleCellKeyDown(e, () => { void commitRow(row.id) })} inputMode="decimal" style={cellInputStyle} /></td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}><input value={row.lead_days == null ? '' : String(row.lead_days)} onChange={(e) => updateLocalRow(row.id, { lead_days: parseNullableNumber(e.target.value) })} onBlur={() => void commitRow(row.id)} onKeyDown={(e) => handleCellKeyDown(e, () => { void commitRow(row.id) })} inputMode="numeric" style={cellInputStyle} /></td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}><label style={{ display: 'flex', justifyContent: 'center', cursor: 'pointer' }}><input type="checkbox" checked={row.is_active} onChange={(e) => { const next = e.target.checked; updateLocalRow(row.id, { is_active: next }); void commitRow(row.id) }} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /></label></td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}><input value={row.notes ?? ''} onChange={(e) => updateLocalRow(row.id, { notes: e.target.value || null })} onBlur={() => void commitRow(row.id)} onKeyDown={(e) => handleCellKeyDown(e, () => { void commitRow(row.id) })} style={cellInputStyle} /></td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '13px', whiteSpace: 'nowrap' }}>{costCodeMap.get(row.cost_code_id) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', paddingTop: '14px' }}>
                {rows.map((row) => (
                  <div key={`${row.id}-mobile`} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{row.source_sku}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.catalog_sku}</div>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text)' }}>{row.description_snapshot}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                      <Field label="Vendor SKU" value={row.vendor_sku} />
                      <Field label="Unit" value={row.unit} />
                      <Field label="Unit Price" value={formatMoney(row.unit_price)} />
                      <Field label="Lead Days" value={row.lead_days == null ? '—' : String(row.lead_days)} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
