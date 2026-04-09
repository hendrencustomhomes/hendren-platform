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
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function loadTrades() {
      const { data, error } = await supabase
        .from('trades')
        .select('id, name, is_active, sort_order')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (error) {
        console.error('Failed to load trades:', error)
      } else {
        setTrades(data || [])
      }

      setLoading(false)
    }

    loadTrades()
  }, [])

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
          <div
            style={{
              padding: '18px 18px 16px',
              borderBottom: '1px solid var(--border)',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            Trades
          </div>

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
              {trades.map((trade, index) => (
                <div
                  key={trade.id}
                  style={{
                    padding: '16px 18px',
                    borderTop:
                      index === 0 ? 'none' : '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: trade.is_active
                        ? 'var(--text)'
                        : 'var(--text-muted)',
                    }}
                  >
                    {trade.name}
                  </div>

                  {!trade.is_active && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      inactive
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