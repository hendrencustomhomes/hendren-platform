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
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newSortOrder, setNewSortOrder] = useState('100')
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSortOrder, setEditSortOrder] = useState('100')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  function startEdit(trade: Trade) {
    setEditingId(trade.id)
    setEditName(trade.name)
    setEditSortOrder(String(trade.sort_order))
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditSortOrder('100')
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
    setCreating(false)
    await loadTrades()
  }

  async function handleSaveEdit(tradeId: string) {
    const trimmedName = editName.trim()
    const parsedSortOrder = Number(editSortOrder)

    if (!trimmedName) {
      setError('Trade name is required')
      return
    }

    if (!Number.isFinite(parsedSortOrder)) {
      setError('Sort order must be a number')
      return
    }

    setSavingId(tradeId)
    setError(null)

    const { error } = await supabase
      .from('trades')
      .update({
        name: trimmedName,
        sort_order: parsedSortOrder,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tradeId)

    if (error) {
      console.error('Failed to update trade:', error)
      setError(error.message || 'Failed to update trade')
      setSavingId(null)
      return
    }

    setSavingId(null)
    cancelEdit()
    await loadTrades()
  }

  async function handleToggleActive(trade: Trade) {
    setSavingId(trade.id)
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
      setSavingId(null)
      return
    }

    setSavingId(null)
    await loadTrades()
  }

  async function handleDelete(trade: Trade) {
    const confirmed = window.confirm(
      `Delete trade "${trade.name}"? This cannot be undone.`
    )

    if (!confirmed) return

    setDeletingId(trade.id)
    setError(null)

    const { error } = await supabase.from('trades').delete().eq('id', trade.id)

    if (error) {
      console.error('Failed to delete trade:', error)
      setError(error.message || 'Failed to delete trade')
      setDeletingId(null)
      return
    }

    if (editingId === trade.id) {
      cancelEdit()
    }

    setDeletingId(null)
    await loadTrades()
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
                padding: '16px 18px',
                borderBottom: '1px solid var(--border)',
                display: 'grid',
                gap: '10px',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--text)',
                }}
              >
                Add Trade
              </div>

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
                  fontSize: '14px',
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
                  fontSize: '14px',
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
                  fontSize: '14px',
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
                padding: '14px 18px',
                borderBottom: '1px solid var(--border)',
                color: '#fca5a5',
                fontSize: '13px',
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div
              style={{
                padding: '16px 18px',
                fontSize: '14px',
                color: 'var(--text-muted)',
              }}
            >
              Loading...
            </div>
          ) : trades.length === 0 ? (
            <div
              style={{
                padding: '16px 18px',
                fontSize: '14px',
                color: 'var(--text-muted)',
              }}
            >
              No trades found
            </div>
          ) : (
            <div>
              {trades.map((trade, index) => {
                const isEditing = editingId === trade.id
                const isSavingThisRow = savingId === trade.id
                const isDeletingThisRow = deletingId === trade.id

                return (
                  <div
                    key={trade.id}
                    style={{
                      padding: '16px 18px',
                      borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                      display: 'grid',
                      gap: '12px',
                    }}
                  >
                    {isEditing ? (
                      <>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Trade name"
                          style={{
                            background: 'var(--background)',
                            border: '1px solid var(--border)',
                            borderRadius: '10px',
                            padding: '10px 12px',
                            color: 'var(--text)',
                            fontSize: '14px',
                            outline: 'none',
                          }}
                        />

                        <input
                          value={editSortOrder}
                          onChange={(e) => setEditSortOrder(e.target.value)}
                          inputMode="numeric"
                          placeholder="Sort order"
                          style={{
                            background: 'var(--background)',
                            border: '1px solid var(--border)',
                            borderRadius: '10px',
                            padding: '10px 12px',
                            color: 'var(--text)',
                            fontSize: '14px',
                            outline: 'none',
                          }}
                        />

                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(trade.id)}
                            disabled={isSavingThisRow}
                            style={{
                              background: 'var(--text)',
                              color: 'var(--surface)',
                              border: 'none',
                              borderRadius: '10px',
                              padding: '10px 12px',
                              fontSize: '13px',
                              fontWeight: 700,
                              cursor: isSavingThisRow ? 'default' : 'pointer',
                              opacity: isSavingThisRow ? 0.7 : 1,
                            }}
                          >
                            {isSavingThisRow ? 'Saving...' : 'Save'}
                          </button>

                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={isSavingThisRow}
                            style={{
                              background: 'transparent',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border)',
                              borderRadius: '10px',
                              padding: '10px 12px',
                              fontSize: '13px',
                              fontWeight: 700,
                              cursor: isSavingThisRow ? 'default' : 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '15px',
                              fontWeight: 700,
                              color: trade.is_active
                                ? 'var(--text)'
                                : 'var(--text-muted)',
                            }}
                          >
                            {trade.name}
                          </div>

                          <div
                            style={{
                              fontSize: '12px',
                              color: trade.is_active
                                ? 'var(--text-muted)'
                                : '#fbbf24',
                              flexShrink: 0,
                            }}
                          >
                            {trade.is_active ? `#${trade.sort_order}` : 'Inactive'}
                          </div>
                        </div>

                        {isAdmin && (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '8px',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => startEdit(trade)}
                              style={{
                                background: 'transparent',
                                color: 'var(--text)',
                                border: '1px solid var(--border)',
                                borderRadius: '10px',
                                padding: '8px 10px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleActive(trade)}
                              disabled={isSavingThisRow}
                              style={{
                                background: 'transparent',
                                color: 'var(--text)',
                                border: '1px solid var(--border)',
                                borderRadius: '10px',
                                padding: '8px 10px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: isSavingThisRow ? 'default' : 'pointer',
                                opacity: isSavingThisRow ? 0.7 : 1,
                              }}
                            >
                              {isSavingThisRow
                                ? 'Saving...'
                                : trade.is_active
                                  ? 'Deactivate'
                                  : 'Activate'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(trade)}
                              disabled={isDeletingThisRow}
                              style={{
                                background: 'transparent',
                                color: '#fca5a5',
                                border: '1px solid rgba(252, 165, 165, 0.35)',
                                borderRadius: '10px',
                                padding: '8px 10px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: isDeletingThisRow ? 'default' : 'pointer',
                                opacity: isDeletingThisRow ? 0.7 : 1,
                              }}
                            >
                              {isDeletingThisRow ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}