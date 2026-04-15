'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type SelectionItem = {
  id: string
  item_label: string
  status: 'required' | 'in_progress' | 'selected' | 'approved' | string
  chosen_value?: string | null
  notes?: string | null
  sort_order?: number | null
  created_at?: string | null
}

type SelectionsTabProps = {
  jobId: string
  selections: SelectionItem[]
}

const STATUS_OPTIONS = ['required', 'in_progress', 'selected', 'approved'] as const

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
    padding: '10px 12px',
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

function statusColor(status: string) {
  if (status === 'approved') return 'var(--green)'
  if (status === 'selected') return 'var(--blue)'
  if (status === 'in_progress') return 'var(--amber)'
  return 'var(--text-muted)'
}

export default function SelectionsTab({ jobId, selections }: SelectionsTabProps) {
  const supabase = createClient()
  const inp = inputStyle()

  const [items, setItems] = useState<SelectionItem[]>(selections)
  const [itemLabel, setItemLabel] = useState('')
  const [status, setStatus] =
    useState<SelectionItem['status']>('required')
  const [chosenValue, setChosenValue] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0)
        if (orderDiff !== 0) return orderDiff
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      }),
    [items]
  )

  function setLocalItem(id: string, patch: Partial<SelectionItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  async function addItem() {
    if (!itemLabel.trim()) return

    setSaving(true)
    setError(null)

    const payload = {
      job_id: jobId,
      item_label: itemLabel.trim(),
      status,
      chosen_value: chosenValue.trim() || null,
      notes: notes.trim() || null,
      sort_order: 0,
    }

    const { data, error: insertError } = await supabase
      .from('job_selections')
      .insert(payload)
      .select('id, item_label, status, chosen_value, notes, sort_order, created_at')
      .single()

    setSaving(false)

    if (insertError || !data) {
      setError('Failed to save selection. Please try again.')
      return
    }

    setItems((current) => [data, ...current])
    setItemLabel('')
    setStatus('required')
    setChosenValue('')
    setNotes('')
  }

  async function updateItem(
    id: string,
    patch: Partial<Pick<SelectionItem, 'item_label' | 'status' | 'chosen_value' | 'notes'>>
  ) {
    setSavingId(id)
    setError(null)

    const { error: updateError } = await supabase
      .from('job_selections')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)

    setSavingId(null)

    if (updateError) {
      setError('Failed to update selection. Please try again.')
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
          Add Selection
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '8px',
            alignItems: 'end',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Item
            </div>
            <input
              value={itemLabel}
              onChange={(e) => setItemLabel(e.target.value)}
              style={inp}
              placeholder="Tile, vanity, lighting, appliance package..."
            />
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Status
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as SelectionItem['status'])}
              style={inp}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Chosen Value
            </div>
            <input
              value={chosenValue}
              onChange={(e) => setChosenValue(e.target.value)}
              style={inp}
              placeholder="Optional"
            />
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Notes
            </div>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={inp}
              placeholder="Optional"
            />
          </div>

          <button
            onClick={addItem}
            disabled={saving || !itemLabel.trim()}
            style={{
              padding: '10px 12px',
              border: 'none',
              borderRadius: '7px',
              background: 'var(--text)',
              color: 'var(--bg)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: saving || !itemLabel.trim() ? 'not-allowed' : 'pointer',
              minHeight: '42px',
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
          Selections
        </div>

        {sortedItems.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            No selections yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedItems.map((item) => {
              const disabled = savingId === item.id

              return (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '8px',
                      alignItems: 'start',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Item
                      </div>
                      <input
                        value={item.item_label ?? ''}
                        disabled={disabled}
                        onChange={(e) => setLocalItem(item.id, { item_label: e.target.value })}
                        onBlur={() => updateItem(item.id, { item_label: item.item_label?.trim() || '' })}
                        style={inp}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Status
                      </div>
                      <select
                        value={item.status}
                        disabled={disabled}
                        onChange={(e) => {
                          const nextStatus = e.target.value
                          setLocalItem(item.id, { status: nextStatus })
                          void updateItem(item.id, { status: nextStatus })
                        }}
                        style={inp}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Chosen Value
                      </div>
                      <input
                        value={item.chosen_value ?? ''}
                        disabled={disabled}
                        onChange={(e) => setLocalItem(item.id, { chosen_value: e.target.value })}
                        onBlur={() =>
                          updateItem(item.id, {
                            chosen_value: item.chosen_value?.trim() || null,
                          })
                        }
                        style={inp}
                      />
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        marginBottom: '4px',
                      }}
                    >
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Notes</div>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          border: `1px solid ${statusColor(item.status)}`,
                          color: statusColor(item.status),
                        }}
                      >
                        {item.status}
                      </span>
                    </div>

                    <textarea
                      value={item.notes ?? ''}
                      disabled={disabled}
                      onChange={(e) => setLocalItem(item.id, { notes: e.target.value })}
                      onBlur={() =>
                        updateItem(item.id, {
                          notes: item.notes?.trim() || null,
                        })
                      }
                      style={{
                        ...inp,
                        minHeight: '72px',
                        resize: 'vertical',
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