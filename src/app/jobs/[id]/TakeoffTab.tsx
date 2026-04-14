'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type TakeoffItem = {
  id: string
  trade: string
  description: string
  qty?: number | null
  unit?: string | null
  notes?: string | null
  sort_order?: number | null
  created_at?: string | null
}

type TakeoffTabProps = {
  jobId: string
  takeoffItems: TakeoffItem[]
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
    fontSize: '14px',
    fontFamily: 'ui-monospace,monospace',
    boxSizing: 'border-box' as const,
    outline: 'none',
    background: 'var(--surface)',
    color: 'var(--text)',
  }
}

export default function TakeoffTab({ jobId, takeoffItems }: TakeoffTabProps) {
  const supabase = createClient()
  const inp = inputStyle()

  const [items, setItems] = useState<TakeoffItem[]>(takeoffItems)
  const [name, setName] = useState('')
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
    if (!name.trim()) return

    setSaving(true)
    setError(null)

    const payload = {
      job_id: jobId,
      name: name.trim(),
      quantity: parseQuantity(quantity),
      unit: unit.trim() || null,
      sort_order: 0,
    }

    const { data, error: insertError } = await supabase
      .from('takeoff_items')
      .insert(payload)
      .select('id, name, quantity, unit, notes, sort_order, created_at')
      .single()

    setSaving(false)

    if (insertError || !data) {
      setError('Failed to save takeoff item. Please try again.')
      return
    }

    setItems((current) => [data, ...current])
    setName('')
    setQuantity('1')
    setUnit('')
  }

  async function updateItem(
    id: string,
    patch: Partial<Pick<TakeoffItem, 'name' | 'quantity' | 'unit' | 'notes'>>
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
            gridTemplateColumns: '2fr 1fr 1fr auto',
            gap: '8px',
            alignItems: 'end',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Name
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inp} />
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Quantity
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
            disabled={saving || !name.trim()}
            style={{
              padding: '10px 12px',
              border: 'none',
              borderRadius: '7px',
              background: 'var(--text)',
              color: 'var(--bg)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
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
                      gridTemplateColumns: '2fr 1fr 1fr',
                      gap: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Name
                      </div>
                      <input
                        defaultValue={item.name}
                        disabled={disabled}
                        style={inp}
                        onBlur={(e) => {
                          const next = e.target.value.trim()
                          if (next && next !== item.name) updateItem(item.id, { name: next })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        }}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Quantity
                      </div>
                      <input
                        defaultValue={item.quantity}
                        disabled={disabled}
                        inputMode="decimal"
                        style={inp}
                        onBlur={(e) => {
                          const next = parseQuantity(e.target.value)
                          if (next !== item.quantity) updateItem(item.id, { quantity: next })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        }}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
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