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
          <div>
            <input value={s.title} onChange={(e) => s.setTitle(e.target.value)} />
            <button onClick={s.handleCreate}>Create</button>
          </div>
        )}

        {s.loading ? (
          <div>Loading…</div>
        ) : (
          s.items.map((i) => (
            <Link key={i.catalog_sku} href={`/more/catalog/${i.catalog_sku}`}>
              <div style={{ padding: 12, borderBottom: '1px solid #ddd' }}>
                <div>{i.catalog_sku}</div>
                <div>{i.title}</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  )
}
