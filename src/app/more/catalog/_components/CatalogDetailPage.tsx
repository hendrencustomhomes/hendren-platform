'use client'

import Nav from '@/components/Nav'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getCatalogItemBySku } from '@/lib/pricing/catalog'

export default function CatalogDetailPage({ catalogSku }: { catalogSku: string }) {
  const supabase = createClient()

  const [item, setItem] = useState<any>(null)
  const [sources, setSources] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const i = await getCatalogItemBySku(supabase, catalogSku)
      setItem(i)

      const { data: rows } = await supabase
        .from('pricing_rows')
        .select('source_sku, pricing_type, unit_price')
        .eq('catalog_sku', catalogSku)

      setSources(rows || [])
    }

    void load()
  }, [catalogSku])

  if (!item) return <div>Loading…</div>

  return (
    <>
      <Nav title={item.title} back="/more/catalog" />

      <div style={{ padding: 16 }}>
        <div><strong>SKU:</strong> {item.catalog_sku}</div>
        <div><strong>Trade:</strong> {item.trade_id}</div>
        <div><strong>Cost Code:</strong> {item.cost_code_id}</div>

        <h3>Source Pricing</h3>

        {sources.map((s, i) => (
          <div key={i} style={{ borderBottom: '1px solid #ddd', padding: 8 }}>
            <div>{s.source_sku}</div>
            <div>{s.pricing_type}</div>
            <div>{s.unit_price}</div>
          </div>
        ))}
      </div>
    </>
  )
}
