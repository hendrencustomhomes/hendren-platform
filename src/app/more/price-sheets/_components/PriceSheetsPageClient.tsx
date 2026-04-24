'use client'

import Nav from '@/components/Nav'
import { useRouter } from 'next/navigation'
import { usePriceSheetsPage } from '../_hooks/usePriceSheetsPage'
import {
  inputStyle,
  labelStyle,
  pageStackStyle,
  searchRowStyle,
  addButtonStyle,
  panelHeaderStyle,
  panelGridStyle,
  fullWidthGridItemStyle,
  errorTextStyle,
  mutedMessageStyle,
  footerCountStyle,
  cardStyle,
  pillStyle,
} from '../_lib/priceSheetStyles'

export default function PriceSheetsPageClient() {
  const router = useRouter()
  const state = usePriceSheetsPage()

  const filters: Array<'all' | 'active' | 'inactive'> = ['all', 'active', 'inactive']

  if (!state.loading && state.access && !state.access.canView) {
    return (
      <>
        <Nav title="Price Sheets" back="/more" />
        <div style={{ padding: '16px' }}>
          <div style={{ ...cardStyle(), padding: '20px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
            Pricing Sources access required.
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Nav title="Price Sheets" back="/more" />

      <div style={pageStackStyle}>
        <div style={searchRowStyle}>
          <input
            value={state.search}
            onChange={(e) => state.setSearch(e.target.value)}
            placeholder="Search price sheets…"
            style={inputStyle}
          />

          {state.access?.canManage && (
            <button
              type="button"
              onClick={() => state.setShowAdd(!state.showAdd)}
              style={addButtonStyle}
            >
              {state.showAdd ? 'Cancel' : 'Add'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {filters.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => state.setStatusFilter(key)}
              style={pillStyle(state.statusFilter === key)}
            >
              {key}
            </button>
          ))}
        </div>

        {state.showAdd && state.access?.canManage && (
          <div style={cardStyle()}>
            <div style={panelHeaderStyle}>New Price Sheet</div>

            <div style={panelGridStyle}>
              <div>
                <div style={labelStyle}>Company</div>
                <select value={state.companyId} onChange={(e) => state.setCompanyId(e.target.value)} style={inputStyle}>
                  <option value="">Select company</option>
                  {state.companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={labelStyle}>Trade</div>
                <select value={state.tradeId} onChange={(e) => state.setTradeId(e.target.value)} style={inputStyle}>
                  <option value="">Select trade</option>
                  {state.trades.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={labelStyle}>Cost Code</div>
                <select value={state.costCodeId} onChange={(e) => state.setCostCodeId(e.target.value)} style={inputStyle}>
                  <option value="">Select cost code</option>
                  {state.costCodes.map((c) => (
                    <option key={c.id} value={c.id}>{c.cost_code} · {c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={labelStyle}>Status</div>
                <select value={state.status} onChange={(e) => state.setStatus(e.target.value)} style={inputStyle}>
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="superseded">superseded</option>
                  <option value="archived">archived</option>
                </select>
              </div>

              <div style={fullWidthGridItemStyle}>
                <div style={labelStyle}>Title</div>
                <input value={state.title} onChange={(e) => state.setTitle(e.target.value)} style={inputStyle} />
              </div>

              <div style={fullWidthGridItemStyle}>
                <div style={labelStyle}>Notes</div>
                <textarea value={state.notes} onChange={(e) => state.setNotes(e.target.value)} style={inputStyle} />
              </div>

              <div style={{ ...fullWidthGridItemStyle, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={state.handleCreate} disabled={state.saving} style={addButtonStyle}>
                  {state.saving ? 'Creating…' : 'Create Price Sheet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {state.error && <div style={errorTextStyle}>{state.error}</div>}

        <div style={cardStyle()}>
          {state.loading ? (
            <div style={mutedMessageStyle}>Loading…</div>
          ) : state.headers.length === 0 ? (
            <div style={mutedMessageStyle}>No price sheets.</div>
          ) : (
            state.headers.map((h, i) => (
              <button
                key={h.id}
                onClick={() => router.push(`/more/price-sheets/${h.id}`)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  padding: '14px 16px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{h.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {state.companyMap.get(h.company_id)} · {state.tradeMap.get(h.trade_id)} · {state.costCodeMap.get(h.cost_code_id)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span>{h.status}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {!state.loading && (
          <div style={footerCountStyle}>
            {state.headers.length} price sheets
          </div>
        )}
      </div>
    </>
  )
}
