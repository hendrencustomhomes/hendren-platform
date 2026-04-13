'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type ScopeItem = {
  id: string
  scope_type?: string | null
  label: string
  value_text?: string | null
  value_number?: number | null
  notes?: string | null
  sort_order?: number | null
  created_at?: string | null
}

type ScopeTabProps = {
  jobId: string
  scopeItems: ScopeItem[]
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

function valueLabel(item: ScopeItem) {
  if (item.value_text?.trim()) return item.value_text.trim()
  if (item.value_number !== null && item.value_number !== undefined) return String(item.value_number)
  return '—'
}

export default function ScopeTab({ jobId, scopeItems }: ScopeTabProps) {
  const supabase = createClient()
  const inp = inputStyle()

  const [items, setItems] = useState<ScopeItem[]>(scopeItems)
  const [label, setLabel] = useState('')
  const [valueText, setValueText] = useState('')
  const [valueNumber, setValueNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [items]
  )

  function parseNumberOrNull(value: string) {
    if (!value.trim()) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  async function addItem() {
    if (!label.trim()) return

    setSaving(true)
    setError(null)

    const payload = {
      job_id: jobId,
      label: label.trim(),
      value_text: valueText.trim() || null,
      value_number: parseNumberOrNull(valueNumber),
      sort_order: 0,
    }

    const { data, error: insertError } = await supabase
      .from('job_scope_items')
      .insert(payload)
      .select('id, scope_type, label, value_text, value_number, notes, sort_order, created_at')
      .single()

    setSaving(false)

    if (insertError || !data) {
      setError('Failed to save scope item. Please try again.')
      return
    }

    setItems((current) => [data, ...current])
    setLabel('')
    setValueText('')
    setValueNumber('')
  }

  async function updateItem(
    id: string,
    patch: Partial<Pick<ScopeItem, 'label' | 'value_text' | 'value_number' | 'notes'>>
  ) {
    setEditingId(id)
    setError(null)

    const { error: updateError } = await supabase
      .from('job_scope_items')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)

    setEditingId(null)

    if (updateError) {
      setError('Failed to update scope item. Please try again.')
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
          Add Scope Item
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1fr auto',
            gap: '8px',
            alignItems: 'end',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Label
            </div>
            <input value={label} onChange={(e) => setLabel(e.target.value)} style={inp} />
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Text Value
            </div>
            <input value={valueText} onChange={(e) => setValueText(e.target.value)} style={inp} />
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Number
            </div>
            <input
              value={valueNumber}
              onChange={(e) => setValueNumber(e.target.value)}
              inputMode="decimal"
              style={inp}
            />
          </div>

          <button
            onClick={addItem}
            disabled={saving || !label.trim()}
            style={{
              padding: '10px 12px',
              border: 'none',
              borderRadius: '7px',
              background: 'var(--text)',
              color: 'var(--bg)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: saving || !label.trim() ? 'not-allowed' : 'pointer',
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
          Scope
        </div>

        {sortedItems.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            No scope items yet.
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
                      gridTemplateColumns: '2fr 1.5fr 1fr',
                      gap: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Label
                      </div>
                      <input
                        defaultValue={item.label}
                        disabled={disabled}
                        style={inp}
                        onBlur={(e) => {
                          const next = e.target.value.trim()
                          if (next && next !== item.label) updateItem(item.id, { label: next })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        }}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Text Value
                      </div>
                      <input
                        defaultValue={item.value_text ?? ''}
                        disabled={disabled}
                        style={inp}
                        onBlur={(e) => {
                          const next = e.target.value.trim() || null
                          if (next !== (item.value_text ?? null)) updateItem(item.id, { value_text: next })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        }}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Number
                      </div>
                      <input
                        defaultValue={item.value_number ?? ''}
                        disabled={disabled}
                        inputMode="decimal"
                        style={inp}
                        onBlur={(e) => {
                          const next = parseNumberOrNull(e.target.value)
                          if (next !== (item.value_number ?? null)) updateItem(item.id, { value_number: next })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
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

                  <div
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      fontFamily: 'ui-monospace,monospace',
                    }}
                  >
                    Current value: {valueLabel(item)}
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