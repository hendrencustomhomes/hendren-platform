'use client'

import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { createClient } from '@/utils/supabase/client'
import { fetchActiveTrades, type TradeOption } from '@/lib/trades'

type CostCode = {
  id: string
  trade_id: string | null
  cost_code: string
  title: string
  description: string | null
  is_active: boolean
  sort_order: number
  trades: { name: string } | null
}

const inp: React.CSSProperties = {
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '10px 10px',
  color: 'var(--text)',
  fontSize: '16px',
  outline: 'none',
  minWidth: 0,
  width: '100%',
  boxSizing: 'border-box',
}

export default function CostCodesPage() {
  const supabase = createClient()

  const [costCodes, setCostCodes] = useState<CostCode[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trades, setTrades] = useState<TradeOption[]>([])

  const [newTradeId, setNewTradeId] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newSortOrder, setNewSortOrder] = useState('100')
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadCostCodes() {
    const { data, error } = await supabase
      .from('cost_codes')
      .select('id, trade_id, cost_code, title, description, is_active, sort_order, trades(name)')
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true })

    if (error) {
      console.error('Failed to load cost codes:', error)
      setError('Failed to load cost codes')
      setCostCodes([])
      return
    }

    setCostCodes((data || []) as CostCode[])
  }

  async function loadAdminStatus() {
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id

    if (!userId) {
      setIsAdmin(false)
      return
    }

    const { data, error } = await supabase
      .from('internal_access')
      .select('is_admin, is_active')
      .eq('profile_id', userId)
      .maybeSingle()

    if (error) {
      setIsAdmin(false)
      return
    }

    setIsAdmin(Boolean(data?.is_admin && data?.is_active))
  }

  useEffect(() => {
    async function loadPage() {
      setLoading(true)
      await Promise.all([
        loadAdminStatus(),
        loadCostCodes(),
        fetchActiveTrades(supabase).then(setTrades),
      ])
      setLoading(false)
    }
    loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build the trade list for an edit-mode row.
  // If the row's current trade is inactive, prepend it so it still displays.
  function editTradesFor(cc: CostCode): Array<{ id: string; name: string }> {
    const base = trades.map((t) => ({ id: t.id, name: t.name }))
    if (cc.trade_id && !base.some((t) => t.id === cc.trade_id) && cc.trades?.name) {
      return [{ id: cc.trade_id, name: `${cc.trades.name} (inactive)` }, ...base]
    }
    return base
  }

  function handleFieldChange(id: string, field: string, value: string) {
    setCostCodes((current) =>
      current.map((cc) => {
        if (cc.id !== id) return cc
        if (field === 'sort_order') {
          return { ...cc, sort_order: value === '' ? 0 : Number(value) }
        }
        if (field === 'trade_id') {
          return { ...cc, trade_id: value === '' ? null : value }
        }
        return { ...cc, [field]: value }
      })
    )
  }

  async function handleCreate() {
    const trimmedCode = newCode.trim()
    const trimmedTitle = newTitle.trim()

    if (!trimmedCode) {
      setError('Cost code is required')
      return
    }
    if (!trimmedTitle) {
      setError('Title is required')
      return
    }

    setCreating(true)
    setError(null)

    const { error } = await supabase.from('cost_codes').insert({
      trade_id: newTradeId || null,
      cost_code: trimmedCode,
      title: trimmedTitle,
      description: newDescription.trim() || null,
      sort_order: Number(newSortOrder) || 100,
      is_active: true,
    })

    if (error) {
      console.error('Failed to create cost code:', error)
      setError(error.message || 'Failed to create cost code')
      setCreating(false)
      return
    }

    setNewTradeId('')
    setNewCode('')
    setNewTitle('')
    setNewDescription('')
    setNewSortOrder('100')
    setShowAddForm(false)
    setCreating(false)
    await loadCostCodes()
  }

  async function handleToggleActive(cc: CostCode) {
    setSaving(true)
    setError(null)

    const { error } = await supabase
      .from('cost_codes')
      .update({ is_active: !cc.is_active, updated_at: new Date().toISOString() })
      .eq('id', cc.id)

    if (error) {
      console.error('Failed to update cost code:', error)
      setError(error.message || 'Failed to update cost code')
      setSaving(false)
      return
    }

    await loadCostCodes()
    setSaving(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    for (const cc of costCodes) {
      if (!cc.cost_code.trim()) {
        setError('Cost code is required')
        setSaving(false)
        return
      }
      if (!cc.title.trim()) {
        setError('Title is required')
        setSaving(false)
        return
      }

      const { error } = await supabase
        .from('cost_codes')
        .update({
          trade_id: cc.trade_id || null,
          cost_code: cc.cost_code.trim(),
          title: cc.title.trim(),
          description: cc.description?.trim() || null,
          sort_order: Number(cc.sort_order),
          updated_at: new Date().toISOString(),
        })
        .eq('id', cc.id)

      if (error) {
        console.error('Failed to save cost code:', error)
        setError(error.message || 'Failed to save cost code')
        setSaving(false)
        return
      }
    }

    await loadCostCodes()
    setIsEditing(false)
    setSaving(false)
  }

  async function handleCancelEdit() {
    setIsEditing(false)
    setError(null)
    await loadCostCodes()
  }

  return (
    <>
      <Nav title="Cost Codes" />

      <div style={{ padding: '16px' }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '18px',
            overflow: 'hidden',
          }}
        >
          {/* Admin toolbar */}
          {isAdmin && (
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowAddForm((v) => !v)
                  setError(null)
                }}
                style={{
                  background: 'transparent',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '8px 10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {showAddForm ? 'Hide Add' : 'Add'}
              </button>

              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true)
                    setError(null)
                  }}
                  style={{
                    background: 'transparent',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      background: 'var(--text)',
                      color: 'var(--surface)',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: saving ? 'default' : 'pointer',
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={saving}
                    style={{
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: saving ? 'default' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}

          {/* Add form */}
          {showAddForm && isAdmin && (
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                display: 'grid',
                gap: '8px',
              }}
            >
              <select
                value={newTradeId}
                onChange={(e) => setNewTradeId(e.target.value)}
                style={inp}
              >
                <option value="">— No trade —</option>
                {trades.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <div
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}
              >
                <input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Cost code (e.g. plumbing_labor)"
                  style={inp}
                />
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title"
                  style={inp}
                />
              </div>

              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                style={inp}
              />

              <input
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(e.target.value)}
                inputMode="numeric"
                placeholder="Sort order"
                style={{ ...inp, width: '120px' }}
              />

              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                style={{
                  background: 'var(--text)',
                  color: 'var(--surface)',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: creating ? 'default' : 'pointer',
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? 'Adding...' : 'Add Cost Code'}
              </button>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                color: '#fca5a5',
                fontSize: '12px',
              }}
            >
              {error}
            </div>
          )}

          {/* List */}
          {loading ? (
            <div
              style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}
            >
              Loading...
            </div>
          ) : costCodes.length === 0 ? (
            <div
              style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}
            >
              No cost codes found
            </div>
          ) : (
            <div>
              {costCodes.map((cc, index) => (
                <div
                  key={cc.id}
                  style={{
                    padding: '10px 12px',
                    borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                    display: 'grid',
                    gap: '8px',
                  }}
                >
                  {isEditing ? (
                    <>
                      {/* Row 1: trade select + sort order + toggle */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 72px 28px',
                          gap: '8px',
                          alignItems: 'center',
                        }}
                      >
                        <select
                          value={cc.trade_id || ''}
                          onChange={(e) =>
                            handleFieldChange(cc.id, 'trade_id', e.target.value)
                          }
                          style={inp}
                        >
                          <option value="">— No trade —</option>
                          {editTradesFor(cc).map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>

                        <input
                          value={String(cc.sort_order)}
                          onChange={(e) =>
                            handleFieldChange(cc.id, 'sort_order', e.target.value)
                          }
                          inputMode="numeric"
                          style={{
                            ...inp,
                            width: '72px',
                            textAlign: 'center',
                            padding: '10px 8px',
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => handleToggleActive(cc)}
                          disabled={saving || creating}
                          aria-label={
                            cc.is_active
                              ? `Deactivate ${cc.title}`
                              : `Activate ${cc.title}`
                          }
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: cc.is_active ? '#fca5a5' : 'var(--text-muted)',
                            fontSize: '18px',
                            lineHeight: 1,
                            padding: '6px 4px',
                            cursor: saving || creating ? 'default' : 'pointer',
                            opacity: saving || creating ? 0.6 : 1,
                          }}
                        >
                          ✕
                        </button>
                      </div>

                      {/* Row 2: code + title */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '8px',
                        }}
                      >
                        <input
                          value={cc.cost_code}
                          onChange={(e) =>
                            handleFieldChange(cc.id, 'cost_code', e.target.value)
                          }
                          placeholder="Cost code"
                          style={{
                            ...inp,
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: '14px',
                          }}
                        />
                        <input
                          value={cc.title}
                          onChange={(e) =>
                            handleFieldChange(cc.id, 'title', e.target.value)
                          }
                          placeholder="Title"
                          style={{ ...inp, fontWeight: 600 }}
                        />
                      </div>

                      {/* Row 3: description */}
                      <input
                        value={cc.description || ''}
                        onChange={(e) =>
                          handleFieldChange(cc.id, 'description', e.target.value)
                        }
                        placeholder="Description (optional)"
                        style={inp}
                      />
                    </>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        alignItems: 'start',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: '15px',
                            fontWeight: 600,
                            color: cc.is_active ? 'var(--text)' : 'var(--text-muted)',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'ui-monospace, monospace',
                              fontSize: '13px',
                              color: 'var(--text-muted)',
                              marginRight: '6px',
                            }}
                          >
                            {cc.cost_code}
                          </span>
                          {cc.title}
                        </div>

                        {(cc.trades?.name || cc.description) && (
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--text-muted)',
                              marginTop: '2px',
                            }}
                          >
                            {cc.trades?.name && <span>{cc.trades.name}</span>}
                            {cc.trades?.name && cc.description && (
                              <span> · </span>
                            )}
                            {cc.description && <span>{cc.description}</span>}
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: '12px',
                          color: cc.is_active ? 'var(--text-muted)' : '#fbbf24',
                          whiteSpace: 'nowrap',
                          paddingTop: '3px',
                        }}
                      >
                        {cc.is_active ? `#${cc.sort_order}` : 'Inactive'}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
