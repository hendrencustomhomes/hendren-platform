'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type TakeoffItem = {
  id: string
  trade: string
  description: string
  cost_code?: string | null
  qty?: number | null
  unit?: string | null
  notes?: string | null
  sort_order?: number | null
  created_at?: string | null
}

type TradeOption = {
  id: string
  name: string
  sort_order?: number | null
}

type CostCodeOption = {
  id: string
  trade_id?: string | null
  cost_code: string
  title: string
  sort_order?: number | null
}

type TakeoffTabProps = {
  jobId: string
  takeoffItems: TakeoffItem[]
  trades: TradeOption[]
  costCodes: CostCodeOption[]
}

function cardStyle() {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '12px 14px',
  }
}

function inputStyle() {
  return {
    width: '100%',
    padding: '9px 10px',
    border: '1px solid var(--border)',
    borderRadius: '7px',
    fontSize: '16px',
    fontFamily: 'ui-monospace,monospace',
    boxSizing: 'border-box' as const,
    outline: 'none',
    background: 'var(--surface)',
    color: 'var(--text)',
  }
}

function costCodeLabel(item: CostCodeOption) {
  return `${item.cost_code} - ${item.title}`
}

export default function TakeoffTab({
  jobId,
  takeoffItems,
  trades,
  costCodes,
}: TakeoffTabProps) {
  const supabase = createClient()
  const inp = inputStyle()

  const [items, setItems] = useState<TakeoffItem[]>(takeoffItems)
  const [trade, setTrade] = useState('')
  const [description, setDescription] = useState('')
  const [costCode, setCostCode] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [items]
  )

  function parseQuantity(value: string) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return 1
    return parsed
  }

  async function addItem() {
    if (!trade.trim() || !description.trim()) return

    setSaving(true)
    setError(null)

    const payload = {
      job_id: jobId,
      trade: trade.trim(),
      description: description.trim(),
      cost_code: costCode || null,
      qty: parseQuantity(quantity),
      unit: unit.trim() || null,
      sort_order: 0,
    }

    const { data, error: insertError } = await supabase
      .from('takeoff_items')
      .insert(payload)
      .select('id, trade, description, cost_code, qty, unit, notes, sort_order, created_at')
      .single()

    setSaving(false)

    if (insertError || !data) {
      setError('Failed to save takeoff item. Please try again.')
      return
    }

    setItems((current) => [data, ...current])
    setTrade('')
    setDescription('')
    setCostCode('')
    setQuantity('1')
    setUnit('')
  }

  async function updateItem(
    id: string,
    patch: Partial<
      Pick<TakeoffItem, 'trade' | 'description' | 'cost_code' | 'qty' | 'unit' | 'notes'>
    >
  ) {
    setEditingId(id)
    setError(null)

    const { error: updateError } = await supabase
      .from('takeoff_items')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)

    setEditingId(null)

    if (updateError) {
      setError('Failed to update takeoff item. Please try again.')
      return
    }

    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  const tradeReady = trades.length > 0
  const costCodeReady = costCodes.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {error && (
        <div
          style={{
            background: 'var(--red-bg)',
            border: '1px solid var(--red)',
            color: 'var(--red)',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '12px',
          }}
        >
          {error}
        </div>
      )}

      {(!tradeReady || !costCodeReady) && (
        <div
          style={{
            background: 'var(--amber-bg, #fff7ed)',
            border: '1px solid var(--amber, #b45309)',
            color: 'var(--amber, #b45309)',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '12px',
          }}
        >
          {!tradeReady && !costCodeReady
            ? 'Trades and cost codes are not loading yet.'
            : !tradeReady
              ? 'Trades are not loading yet.'
              : 'Cost codes are not loading yet.'}
        </div>
      )}

      <div style={cardStyle()}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '.05em',
            marginBottom: '10px',
          }}
        >
          Add Takeoff Item
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2fr 1.5fr 1fr 1fr auto',
            gap: '8px',
            alignItems: 'end',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Trade
            </div>
            <select value={trade} onChange={(e) => setTrade(e.target.value)} style={inp}>
              <option value="">Select trade</option>
              {trades.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Description
            </div>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={inp}
            />
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Cost Code
            </div>
            <select value={costCode} onChange={(e) => setCostCode(e.target.value)} style={inp}>
              <option value="">None</option>
              {costCodes.map((item) => (
                <option key={item.id} value={item.cost_code}>
                  {costCodeLabel(item)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Qty
            </div>
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="decimal"
              style={inp}
            />
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Unit
            </div>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} style={inp} />
          </div>

          <button
            onClick={addItem}
            disabled={saving || !tradeReady || !trade.trim() || !description.trim()}
            style={{
              padding: '10px 12px',
              border: 'none',
              borderRadius: '7px',
              background: 'var(--text)',
              color: 'var(--bg)',
              fontSize: '12px',
              fontWeight: '700',
              cursor:
                saving || !tradeReady || !trade.trim() || !description.trim()
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Add'}
          </button>
        </div>
      </div>

      <div style={cardStyle()}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '.05em',
            marginBottom: '10px',
          }}
        >
          Takeoff
        </div>

        {sortedItems.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            No takeoff items yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedItems.map((item) => {
              const disabled = editingId === item.id
              return (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '10px',
                    background: 'var(--bg)',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 2fr 1.5fr 1fr 1fr',
                      gap: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <div>
                      <div
                        style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}
                      >
                        Trade
                      </div>
                      <select
                        defaultValue={item.trade}
                        disabled={disabled || !tradeReady}
                        style={inp}
                        onBlur={(e) => {
                          const next = e.target.value.trim()
                          if (next && next !== item.trade) updateItem(item.id, { trade: next })
                        }}
                      >
                        <option value="">Select trade</option>
                        {trades.map((tradeItem) => (
                          <option key={tradeItem.id} value={tradeItem.name}>
                            {tradeItem.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div
                        style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}
                      >
                        Description
                      </div>
                      <input
                        defaultValue={item.description}
                        disabled={disabled}
                        style={inp}
                        onBlur={(e) => {
                          const next = e.target.value.trim()
                          if (next && next !== item.description) {
                            updateItem(item.id, { description: next })
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        }}
                      />
                    </div>

                    <div>
                      <div
                        style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}
                      >
                        Cost Code
                      </div>
                      <select
                        defaultValue={item.cost_code ?? ''}
                        disabled={disabled || !costCodeReady}
                        style={inp}
                        onBlur={(e) => {
                          const next = e.target.value || null
                          if (next !== (item.cost_code ?? null)) {
                            updateItem(item.id, { cost_code: next })
                          }
                        }}
                      >
                        <option value="">None</option>
                        {costCodes.map((codeItem) => (
                          <option key={codeItem.id} value={codeItem.cost_code}>
                            {costCodeLabel(codeItem)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div
                        style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}
                      >
                        Qty
                      </div>
                      <input
                        defaultValue={item.qty ?? 1}
                        disabled={disabled}
                        inputMode="decimal"
                        style={inp}
                        onBlur={(e) => {
                          const next = parseQuantity(e.target.value)
                          if (next !== (item.qty ?? 1)) updateItem(item.id, { qty: next })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        }}
                      />
                    </div>

                    <div>
                      <div
                        style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}
                      >
                        Unit
                      </div>
                      <input
                        defaultValue={item.unit ?? ''}
                        disabled={disabled}
                        style={inp}
                        onBlur={(e) => {
                          const next = e.target.value.trim() || null
                          if (next !== (item.unit ?? null)) updateItem(item.id, { unit: next })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Notes
                    </div>
                    <textarea
                      defaultValue={item.notes ?? ''}
                      disabled={disabled}
                      rows={2}
                      style={{ ...inp, resize: 'vertical' as const }}
                      onBlur={(e) => {
                        const next = e.target.value.trim() || null
                        if (next !== (item.notes ?? null)) updateItem(item.id, { notes: next })
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}