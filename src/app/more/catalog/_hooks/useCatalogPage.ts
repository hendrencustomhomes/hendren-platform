'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { listCatalogItems, createCatalogItem } from '@/lib/pricing/catalog'
import { getCurrentPricingAccess } from '@/app/actions/pricing-access-actions'

export function useCatalogPage() {
  const supabase = createClient()

  const [items, setItems] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [access, setAccess] = useState<any>(null)

  async function load() {
    setLoading(true)
    const rows = await listCatalogItems(supabase)
    setItems(rows)
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const accessResult = await getCurrentPricingAccess('catalog')
      setAccess(accessResult)
      if (!accessResult.canView) {
        setError('No access')
        setLoading(false)
        return
      }
      await load()
    }
    void init()
  }, [])

  async function handleCreate() {
    await createCatalogItem(supabase, { title })
    setTitle('')
    setShowAdd(false)
    await load()
  }

  const filtered = items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))

  return {
    items: filtered,
    search,
    setSearch,
    loading,
    error,
    showAdd,
    setShowAdd,
    title,
    setTitle,
    handleCreate,
    access,
  }
}
