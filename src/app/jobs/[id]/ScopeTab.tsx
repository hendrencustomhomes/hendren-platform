'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  SCOPE_STARTER_DEFINITIONS,
  isStarterScopeType,
  buildDefaultScopeItems,
  type ScopeStarterSection,
} from '@/lib/scope'

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

const SECTION_LABELS: Record<ScopeStarterSection, string> = {
  project: 'Project',
  layout: 'Layout',
  features: 'Features',
}

const SECTIONS: ScopeStarterSection[] = ['project', 'layout', 'features']

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
    fontFamily: 'system-ui,-apple-system,sans-serif',
    boxSizing: 'border-box' as const,
    outline: 'none',
    background: 'var(--surface)',
    color: 'var(--text)',
  }
}

function parseNumberOrNull(value: string): number | null {
  if (!value.trim()) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export default function ScopeTab({ jobId, scopeItems: initialItems }: ScopeTabProps) {
  const supabase = createClient()
  const inp = inputStyle()

  const [items, setItems] = useState<ScopeItem[]>(initialItems)
  const [initializing, setInitializing] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addingCustom, setAddingCustom] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const [customValue, setCustomValue] = useState('')
  const [savingCustom, setSavingCustom] = useState(false)

  const starterItems = useMemo(
    () => items.filter((item) => isStarterScopeType(item.scope_type)),
    [items]
  )

  const customItems = useMemo(
    () => items.filter((item) => !isStarterScopeType(item.scope_type)),
    [items]
  )

  async function initializeStarters() {
    setInitializing(true)
    setError(null)
    const payload = buildDefaultScopeItems(jobId)
    const { data, error: err } = await supabase
      .from('job_scope_items')
      .insert(payload)
      .select('id, scope_type, label, value_text, value_number, notes, sort_order, created_at')
    setInitializing(false)
    if (err || !data) {
      setError('Failed to initialize scope. Please try again.')
      return
    }
    setItems((cur) => [...cur, ...data])
  }

  async function saveItem(id: string, patch: Partial<Pick<ScopeItem, 'value_text' | 'value_number'>>) {
    setSavingId(id)
    const { error: err } = await supabase.from('job_scope_items').update(patch).eq('id', id)
    setSavingId(null)
    if (err) setError('Failed to save. Please try again.')
  }

  function updateLocalAndSave(id: string, patch: Partial<Pick<ScopeItem, 'value_text' | 'value_number'>>) {
    setItems((cur) => cur.map((it) => it.id === id ? { ...it, ...patch } : it))
    saveItem(id, patch)
  }

  async function addCustomItem() {
    if (!customLabel.trim()) return
    setSavingCustom(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('job_scope_items')
      .insert({ job_id: jobId, label: customLabel.trim(), value_text: customValue.trim() || null, sort_order: 0 })
      .select('id, scope_type, label, value_text, value_number, notes, sort_order, created_at')
      .single()
    setSavingCustom(false)
    if (err || !data) {
      setError('Failed to add item. Please try again.')
      return
    }
    setItems((cur) => [data, ...cur])
    setCustomLabel('')
    setCustomValue('')
    setAddingCustom(false)
  }

  function renderStarterInput(item: ScopeItem) {
    const def = SCOPE_STARTER_DEFINITIONS.find((d) => d.scope_type === item.scope_type)
    if (!def) return null
    const busy = savingId === item.id

    if (def.kind === 'select' && def.options) {
      return (
        <select
          style={inp}
          disabled={busy}
          value={item.value_text ?? ''}
          onChange={(e) => updateLocalAndSave(item.id, { value_text: e.target.value || null })}
        >
          <option value="">— select —</option>
          {def.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }

    if (def.kind === 'number') {
      return (
        <input
          style={inp}
          type="text"
          inputMode="decimal"
          disabled={busy}
          defaultValue={item.value_number ?? ''}
          placeholder={def.placeholder}
          onBlur={(e) => {
            const next = parseNumberOrNull(e.target.value)
            if (next !== (item.value_number ?? null)) saveItem(item.id, { value_number: next })
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        />
      )
    }

    if (def.kind === 'multiline') {
      return (
        <textarea
          style={{ ...inp, minHeight: '72px', resize: 'vertical' as const }}
          disabled={busy}
          defaultValue={item.value_text ?? ''}
          placeholder={def.placeholder}
          onBlur={(e) => {
            const next = e.target.value.trim() || null
            if (next !== (item.value_text ?? null)) saveItem(item.id, { value_text: next })
          }}
        />
      )
    }

    // text
    return (
      <input
        style={inp}
        disabled={busy}
        defaultValue={item.value_text ?? ''}
        placeholder={def.placeholder}
        onBlur={(e) => {
          const next = e.target.value.trim() || null
          if (next !== (item.value_text ?? null)) saveItem(item.id, { value_text: next })
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {error && (
        <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px' }}>
          {error}
        </div>
      )}

      {starterItems.length === 0 && (
        <div style={{ ...cardStyle(), textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            No scope fields yet. Initialize to begin structured scope intake.
          </div>
          <button
            onClick={initializeStarters}
            disabled={initializing}
            style={{ padding: '10px 20px', background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: initializing ? 'not-allowed' : 'pointer' }}
          >
            {initializing ? 'Initializing...' : 'Initialize Scope'}
          </button>
        </div>
      )}

      {starterItems.length > 0 && SECTIONS.map((section) => {
        const defs = SCOPE_STARTER_DEFINITIONS.filter((d) => d.section === section)
        const sectionItems = defs
          .map((d) => starterItems.find((it) => it.scope_type === d.scope_type))
          .filter(Boolean) as ScopeItem[]
        if (!sectionItems.length) return null
        return (
          <div key={section} style={cardStyle()}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px', color: 'var(--text-muted)' }}>
              {SECTION_LABELS[section]}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sectionItems.map((item) => {
                const def = SCOPE_STARTER_DEFINITIONS.find((d) => d.scope_type === item.scope_type)
                return (
                  <div key={item.id}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>{item.label}</div>
                    {def?.helpText && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', lineHeight: 1.4 }}>
                        {def.helpText}
                      </div>
                    )}
                    {renderStarterInput(item)}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {customItems.length > 0 && (
        <div style={cardStyle()}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px', color: 'var(--text-muted)' }}>
            Additional Notes
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {customItems.map((item) => (
              <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: '7px', padding: '8px 10px', background: 'var(--bg)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-muted)' }}>
                  {item.label}
                </div>
                <input
                  style={inp}
                  disabled={savingId === item.id}
                  defaultValue={item.value_text ?? ''}
                  onBlur={(e) => {
                    const next = e.target.value.trim() || null
                    if (next !== (item.value_text ?? null)) saveItem(item.id, { value_text: next })
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={cardStyle()}>
        {!addingCustom ? (
          <button
            onClick={() => setAddingCustom(true)}
            style={{ width: '100%', padding: '8px', background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: '7px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            + Add Custom Scope Item
          </button>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Label</div>
                <input
                  style={inp}
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g. Special Condition"
                />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Value</div>
                <input
                  style={inp}
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setAddingCustom(false); setCustomLabel(''); setCustomValue('') }}
                style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '12px', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={addCustomItem}
                disabled={savingCustom || !customLabel.trim()}
                style={{ padding: '7px 12px', background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: savingCustom || !customLabel.trim() ? 'not-allowed' : 'pointer' }}
              >
                {savingCustom ? 'Saving...' : 'Add'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
