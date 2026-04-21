'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import { createClient } from '@/utils/supabase/client'
import {
  fetchPricingCompanies,
  fetchPricingCostCodes,
  fetchPricingTrades,
  getPricingHeader,
  listPricingRowsForHeader,
} from '@/lib/pricing-sources'
import type {
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

function metaPill(text: string) {
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        color: 'var(--text-muted)',
        border: '1px solid var(--border)',
        borderRadius: '999px',
        padding: '2px 8px',
      }}
    >
      {text}
    </span>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '14px', color: 'var(--text)' }}>{value || '—'}</div>
    </div>
  )
}

function formatMoney(value: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export default function PriceSheetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const id = typeof params.id === 'string' ? params.id : ''

  const [header, setHeader] = useState<PricingHeader | null>(null)
  const [rows, setRows] = useState<PricingRow[]>([])
  const [companies, setCompanies] = useState<PricingCompanyOption[]>([])
  const [trades, setTrades] = useState<PricingTradeOption[]>([])
  const [costCodes, setCostCodes] = useState<PricingCostCodeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load price sheet.')
      } finally {
        setLoading(false)
      }
    }

    void loadPage()
  }, [id, supabase])

  const companyMap = useMemo(
    () => new Map(companies.map((row) => [row.id, row.company_name])),
    [companies]
  )
  const tradeMap = useMemo(() => new Map(trades.map((row) => [row.id, row.name])), [trades])
  const costCodeMap = useMemo(
    () => new Map(costCodes.map((row) => [row.id, `${row.cost_code} · ${row.title}`])),
    [costCodes]
  )

  if (loading) {
    return (
      <>
        <Nav title="Price Sheet" back="/more/price-sheets" />
        <div style={{ padding: '20px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Loading…
        </div>
      </>
    )
  }

  if (error || !header) {
    return (
      <>
        <Nav title="Price Sheet" back="/more/price-sheets" />
        <div style={{ padding: '20px 16px' }}>
          <div style={{ fontSize: '13px', color: '#fca5a5', marginBottom: '12px' }}>
            {error ?? 'Price sheet not found.'}
          </div>
          <button
            type="button"
            onClick={() => router.push('/more/price-sheets')}
            style={{
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Back to Price Sheets
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <Nav title={header.title} back="/more/price-sheets" />

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Header</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {metaPill(`rev ${header.revision}`)}
              {metaPill(header.status)}
              {metaPill(header.is_active ? 'active' : 'inactive')}
            </div>
          </div>

          <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <Field label="Title" value={header.title} />
            <Field label="Company" value={companyMap.get(header.company_id)} />
            <Field label="Trade" value={tradeMap.get(header.trade_id)} />
            <Field label="Cost Code" value={costCodeMap.get(header.cost_code_id)} />
            <Field label="Effective Date" value={header.effective_date} />
            <Field label="Received At" value={header.received_at} />
            <Field label="Supersedes" value={header.supersedes_header_id} />
            <Field label="Notes" value={header.notes} />
          </div>
        </div>

        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Rows</span>
            {metaPill(`${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`)}
          </div>

          {rows.length === 0 ? (
            <div style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
              No pricing rows yet.
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', display: 'none' }} className="desktop-only" />
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '880px' }}>
                  <thead>
                    <tr>
                      {['Source SKU', 'Catalog SKU', 'Description', 'Vendor SKU', 'Unit', 'Unit Price', 'Lead Days', 'Cost Code'].map((label) => (
                        <th
                          key={label}
                          style={{
                            textAlign: 'left',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '.04em',
                            color: 'var(--text-muted)',
                            padding: '12px 14px',
                            borderBottom: '1px solid var(--border)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 700 }}>{row.source_sku}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>{row.catalog_sku}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>{row.description_snapshot}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>{row.vendor_sku || '—'}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>{row.unit || '—'}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>{formatMoney(row.unit_price)}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>{row.lead_days ?? '—'}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>{costCodeMap.get(row.cost_code_id) ?? '—'}</td>
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
