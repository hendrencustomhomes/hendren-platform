'use client'

import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { createClient } from '@/utils/supabase/client'

type Trade = {
  id: string
  name: string
  is_active: boolean
  sort_order: number
}

export default function TradesPage() {
  const supabase = createClient()

  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newSortOrder, setNewSortOrder] = useState('100')
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadTrades() {
    setError(null)

    const { data, error } = await supabase
      .from('trades')
      .select('id, name, is_active, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('Failed to load trades:', error)
      setError('Failed to load trades')
      setTrades([])
      return
    }

    setTrades(data || [])
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
      console.error('Failed to load admin status:', error)
      setIsAdmin(false)
      return
    }

    setIsAdmin(Boolean(data?.is_admin && data?.is_active))
  }

  async function loadPage() {
    setLoading(true)
    await Promise.all([loadAdminStatus(), loadTrades()])
    setLoading(false)
  }

  useEffect(() => {
    loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleTradeFieldChange(
    tradeId: string,
    field: 'name' | 'sort_order',
    value: string
  ) {
    setTrades((current) =>
      current.map((trade) => {
        if (trade.id !== tradeId) return trade

        if (field === 'name') {
          return { ...trade, name: value }
        }

        return {
          ...trade,
          sort_order: value === '' ? 0 : Number(value),
        }
      })
    )
  }

  async function handleCreate() {
    const trimmedName = newName.trim()
    const parsedSortOrder = Number(newSortOrder)

    if (!trimmedName) {
      setError('Trade name is required')
      return
    }

    if (!Number.isFinite(parsedSortOrder)) {
      setError('Sort order must be a number')
      return
    }

    setCreating(true)
    setError(null)

    const { error } = await supabase.from('trades').insert({
      name: trimmedName,
      sort_order: parsedSortOrder,
      is_active: true,
    })

    if (error) {
      console.error('Failed to create trade:', error)
      setError(error.message || 'Failed to create trade')
      setCreating(false)
      return
    }

    setNewName('')
    setNewSortOrder('100')
    setShowAddForm(false)
    setCreating(false)
    await loadTrades()
  }

  async function handleToggleActive(trade: Trade) {
    setSaving(true)
    setError(null)

    const { error } = await supabase
      .from('trades')
      .update({
        is_active: !trade.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trade.id)

    if (error) {
      console.error('Failed to update trade status:', error)
      setError(error.message || 'Failed to update trade status')
      setSaving(false)
      return
    }

    await loadTrades()
    setSaving(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    for (const trade of trades) {
      const trimmedName = trade.name.trim()

      if (!trimmedName) {
        setError('Trade name is required')
        setSaving(false)
        return
      }

      if (!Number.isFinite(Number(trade.sort_order))) {
        setError('Sort order must be a number')
        setSaving(false)
        return
      }

      const { error } = await supabase
        .from('trades')
        .update({
          name: trimmedName,
          sort_order: Number(trade.sort_order),
          updated_at: new Date().toISOString(),
        })
        .eq('id', trade.id)

      if (error) {
        console.error('Failed to save trade:', error)
        setError(error.message || 'Failed to save trade')
        setSaving(false)
        return
      }
    }

    await loadTrades()
    setIsEditing(false)
    setSaving(false)
  }

  return (
    <>
      <Nav title="Trades" />

      <div style={{ padding: '16px' }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '18px',
            overflow: 'hidden',
          }}
        >
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
                  setShowAddForm((current) => !current)
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
              )}
            </div>
          )}

          {showAddForm && isAdmin && (
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                display: 'grid',
                gap: '8px',
              }}
            >
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Trade name"
                style={{
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  color: 'var(--text)',
                  fontSize: '16px',
                  outline: 'none',
                }}
              />

              <input
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(e.target.value)}
                inputMode="numeric"
                placeholder="Sort order"
                style={{
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  color: 'var(--text)',
                  fontSize: '16px',
                  outline: 'none',
                }}
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
                {creating ? 'Adding...' : 'Add Trade'}
              </button>
            </div>
          )}

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

          {loading ? (
            <div
              style={{
                padding: '12px',
                fontSize: '13px',
                color: 'var(--text-muted)',
              }}
            >
              Loading...
            </div>
          ) : trades.length === 0 ? (
            <div
              style={{
                padding: '12px',
                fontSize: '13px',
                color: 'var(--text-muted)',
              }}
            >
              No trades found
            </div>
          ) : (
            <div>
              {trades.map((trade, index) => (
                <div
                  key={trade.id}
                  style={{
                    padding: '10px 12px',
                    borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                    display: 'grid',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isEditing ? '1fr 72px 28px' : '1fr auto',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {isEditing ? (
                      <>
                        <input
                          value={trade.name}
                          onChange={(e) =>
                            handleTradeFieldChange(trade.id, 'name', e.target.value)
                          }
                          style={{
                            background: 'var(--background)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '10px 10px',
                            color: 'var(--text)',
                            fontSize: '16px',
                            fontWeight: 600,
                            outline: 'none',
                            minWidth: 0,
                          }}
                        />

                        <input
                          value={String(trade.sort_order)}
                          onChange={(e) =>
                            handleTradeFieldChange(
                              trade.id,
                              'sort_order',
                              e.target.value
                            )
                          }
                          inputMode="numeric"
                          style={{
                            background: 'var(--background)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '10px 8px',
                            color: 'var(--text)',
                            fontSize: '16px',
                            textAlign: 'center',
                            outline: 'none',
                            width: '72px',
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => handleToggleActive(trade)}
                          disabled={saving || creating}
                          aria-label={
                            trade.is_active ? `Deactivate ${trade.name}` : `Activate ${trade.name}`
                          }
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: trade.is_active ? '#fca5a5' : 'var(--text-muted)',
                            fontSize: '18px',
                            lineHeight: 1,
                            padding: '6px 4px',
                            cursor: saving || creating ? 'default' : 'pointer',
                            opacity: saving || creating ? 0.6 : 1,
                          }}
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <div
                          style={{
                            fontSize: '15px',
                            fontWeight: 600,
                            color: trade.is_active ? 'var(--text)' : 'var(--text-muted)',
                            minWidth: 0,
                          }}
                        >
                          {trade.name}
                        </div>

                        <div
                          style={{
                            fontSize: '12px',
                            color: trade.is_active ? 'var(--text-muted)' : '#fbbf24',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {trade.is_active ? `#${trade.sort_order}` : 'Inactive'}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}