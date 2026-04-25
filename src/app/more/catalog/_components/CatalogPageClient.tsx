'use client'

import Nav from '@/components/Nav'
import Link from 'next/link'
import { useCatalogPage } from '../_hooks/useCatalogPage'

export default function CatalogPageClient() {
  const s = useCatalogPage()

  return (
    <>
      <Nav title="Catalog" back="/more" />

      <div style={{ padding: 16 }}>
        <input
          placeholder="Search catalog..."
          value={s.search}
          onChange={(e) => s.setSearch(e.target.value)}
          style={{ width: '100%', padding: 8 }}
        />

        {s.access?.canManage && (
          <button onClick={() => s.setShowAdd(!s.showAdd)}>
            {s.showAdd ? 'Cancel' : 'Add'}
          </button>
        )}

        {s.showAdd && (
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <input placeholder="Title" value={s.title} onChange={(e) => s.setTitle(e.target.value)} />

            <select value={s.tradeId} onChange={(e) => s.setTradeId(e.target.value)}>
              {s.trades.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            <select value={s.costCodeId} onChange={(e) => s.setCostCodeId(e.target.value)}>
              {s.costCodes.map((c) => (
                <option key={c.id} value={c.id}>{c.cost_code} · {c.title}</option>
              ))}
            </select>

            <input
              placeholder="Default unit"
              value={s.defaultUnit}
              onChange={(e) => s.setDefaultUnit(e.target.value)}
            />

            <button onClick={s.handleCreate} disabled={s.saving}>
              {s.saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        )}

        {s.error && (
          <div style={{ padding: '12px 0', color: 'var(--danger)', fontSize: 14 }}>{s.error}</div>
        )}

        {s.loading ? (
          <div>Loading…</div>
        ) : (
          s.items.map((i) => (
            <Link key={i.catalog_sku} href={`/more/catalog/${i.catalog_sku}`}>
              <div style={{ padding: 12, borderBottom: '1px solid #ddd' }}>
                <div><strong>{i.catalog_sku}</strong></div>
                <div>{i.title}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {s.tradeMap.get(i.trade_id)} · {s.costCodeMap.get(i.cost_code_id)}
                </div>
                <div style={{ fontSize: 12 }}>
                  {i.source_count} sources
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  )
}
