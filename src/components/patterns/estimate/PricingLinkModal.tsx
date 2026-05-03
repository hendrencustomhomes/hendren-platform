'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/utils/supabase/client'
import { linkRowToPricing } from '@/app/actions/worksheet-pricing-actions'
import type { PricingHeader, PricingRow } from '@/lib/pricing/types'
import { PRICING_HEADER_KIND_CONFIG } from '@/lib/pricing/headerKinds'
import type { JobWorksheetRow } from './JobWorksheetTableAdapter'

type Props = {
  rowId: string
  estimateId: string
  jobId: string
  onClose: () => void
  onLinked: (updatedRow: JobWorksheetRow) => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const dialogStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '20px',
  width: '560px',
  maxWidth: '95vw',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
}

const listStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: '8px',
  overflow: 'auto',
  maxHeight: '220px',
  flex: '1 1 auto',
}

function ListItem({
  label,
  sublabel,
  selected,
  onClick,
}: {
  label: string
  sublabel?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 12px',
        cursor: 'pointer',
        background: selected ? 'var(--blue-subtle, rgba(37,99,235,.08))' : 'transparent',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: selected ? 700 : 400 }}>{label}</div>
      {sublabel && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>
          {sublabel}
        </div>
      )}
    </div>
  )
}

export function PricingLinkModal({ rowId, estimateId, jobId, onClose, onLinked }: Props) {
  const [headers, setHeaders] = useState<PricingHeader[]>([])
  const [selectedHeaderId, setSelectedHeaderId] = useState<string | null>(null)
  const [pricingRows, setPricingRows] = useState<PricingRow[]>([])
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [loadingHeaders, setLoadingHeaders] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('pricing_headers')
      .select('id, kind, title, is_active, company_id, trade_id, cost_code_id, job_id, revision, status, effective_date, received_at, supersedes_header_id, notes, created_at, updated_at')
      .eq('is_active', true)
      .order('kind')
      .order('title')
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setHeaders((data ?? []) as PricingHeader[])
        setLoadingHeaders(false)
      })
  }, [])

  useEffect(() => {
    if (!selectedHeaderId) {
      setPricingRows([])
      setSelectedRowId(null)
      return
    }
    setLoadingRows(true)
    setSelectedRowId(null)
    const supabase = createClient()
    supabase
      .from('pricing_rows')
      .select('id, pricing_header_id, catalog_sku, cost_code_id, source_sku, vendor_sku, description_snapshot, pricing_type, quantity, unit, unit_price, lead_days, notes, sort_order, is_active, created_at, updated_at')
      .eq('pricing_header_id', selectedHeaderId)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setPricingRows((data ?? []) as PricingRow[])
        setLoadingRows(false)
      })
  }, [selectedHeaderId])

  function handleConfirm() {
    if (!selectedRowId) return
    setError(null)
    startTransition(async () => {
      const result = await linkRowToPricing(rowId, estimateId, selectedRowId, jobId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      onLinked(result.row)
      onClose()
    })
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  const priceSheetHeaders = headers.filter((h) => h.kind === 'price_sheet')
  const bidHeaders = headers.filter((h) => h.kind === 'bid')

  function formatRowLabel(row: PricingRow) {
    const parts: string[] = []
    if (row.unit_price != null)
      parts.push(
        `$${Number(row.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${row.unit ? `/${row.unit}` : ''}`,
      )
    if (row.source_sku) parts.push(row.source_sku)
    return parts.join(' · ')
  }

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={dialogStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>Link to Price Source</div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-muted)', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{ fontSize: '12px', color: 'var(--error, #c0392b)', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '8px 10px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', minHeight: 0, flex: 1 }}>
          {/* Step 1: Pick header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)' }}>
              1 · Price Source
            </div>
            <div style={listStyle}>
              {loadingHeaders ? (
                <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>Loading…</div>
              ) : headers.length === 0 ? (
                <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>No active price sources.</div>
              ) : (
                <>
                  {priceSheetHeaders.length > 0 && (
                    <>
                      <div style={{ padding: '6px 12px 4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', background: 'var(--bg)' }}>
                        {PRICING_HEADER_KIND_CONFIG.price_sheet.pluralLabel}
                      </div>
                      {priceSheetHeaders.map((h) => (
                        <ListItem
                          key={h.id}
                          label={h.title}
                          selected={selectedHeaderId === h.id}
                          onClick={() => setSelectedHeaderId(h.id)}
                        />
                      ))}
                    </>
                  )}
                  {bidHeaders.length > 0 && (
                    <>
                      <div style={{ padding: '6px 12px 4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', background: 'var(--bg)' }}>
                        {PRICING_HEADER_KIND_CONFIG.bid.pluralLabel}
                      </div>
                      {bidHeaders.map((h) => (
                        <ListItem
                          key={h.id}
                          label={h.title}
                          selected={selectedHeaderId === h.id}
                          onClick={() => setSelectedHeaderId(h.id)}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Step 2: Pick row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)' }}>
              2 · Line Item
            </div>
            <div style={listStyle}>
              {!selectedHeaderId ? (
                <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>Select a source first.</div>
              ) : loadingRows ? (
                <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>Loading…</div>
              ) : pricingRows.length === 0 ? (
                <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>No active rows in this source.</div>
              ) : (
                pricingRows.map((row) => (
                  <ListItem
                    key={row.id}
                    label={row.description_snapshot || '(no description)'}
                    sublabel={formatRowLabel(row)}
                    selected={selectedRowId === row.id}
                    onClick={() => setSelectedRowId(row.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 600, border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedRowId || isPending}
            style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 700, border: 'none', borderRadius: '8px', background: selectedRowId && !isPending ? 'var(--blue, #2563eb)' : 'var(--border)', color: selectedRowId && !isPending ? '#fff' : 'var(--text-muted)', cursor: selectedRowId && !isPending ? 'pointer' : 'default' }}
          >
            {isPending ? 'Linking…' : 'Link'}
          </button>
        </div>
      </div>
    </div>
  )
}
