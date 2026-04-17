'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import TakeoffWorkspace from './TakeoffWorkspace'
import type {
  CostCodeOption,
  ScopeContextItem,
  TakeoffEditablePatch,
  TakeoffItem,
  TakeoffItemKind,
  TakeoffRowKind,
  TradeOption,
} from './takeoffTypes'
import { parseNumberOrNull, parsePositiveNumber } from './takeoffUtils'

type TakeoffDraft = {
  row_kind: TakeoffRowKind
  item_kind: TakeoffItemKind
  parent_id: string
  trade: string
  description: string
  cost_code: string
  qty: string
  unit: string
  unit_cost: string
  notes: string
}

const DRAFT_INITIAL: TakeoffDraft = {
  row_kind: 'item',
  item_kind: 'cost',
  parent_id: '',
  trade: '',
  description: '',
  cost_code: '',
  qty: '1',
  unit: '',
  unit_cost: '',
  notes: '',
}

type TakeoffTabProps = {
  jobId: string
  takeoffItems: TakeoffItem[]
  trades: TradeOption[]
  costCodes: CostCodeOption[]
  scopeItems: ScopeContextItem[]
}

function normalizeDraftTrade(draft: TakeoffDraft) {
  const next = draft.trade.trim()
  if (next) return next
  if (draft.row_kind === 'assembly') return 'Assembly'
  if (draft.item_kind === 'scope') return 'Scope'
  return ''
}

export default function TakeoffTab({
  jobId,
  takeoffItems,
  trades,
  costCodes,
  scopeItems,
}: TakeoffTabProps) {
  const supabase = createClient()

  const [items, setItems] = useState<TakeoffItem[]>(takeoffItems)
  const [draft, setDraft] = useState<TakeoffDraft>(DRAFT_INITIAL)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function refreshTakeoffItems() {
      const { data, error: refreshError } = await supabase
        .from('takeoff_items')
        .select(
          'id, trade, description, cost_code, qty, unit, unit_cost, extended_cost, notes, sort_order, created_at, row_kind, item_kind, parent_id'
        )
        .eq('job_id', jobId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (ignore || refreshError || !data) return
      setItems(data)
    }

    refreshTakeoffItems()

    return () => {
      ignore = true
    }
  }, [jobId, supabase])

  async function addItem() {
    const normalizedTrade = normalizeDraftTrade(draft)
    const requiresManagedTrade = draft.row_kind === 'item' && draft.item_kind === 'cost'

    if (!draft.description.trim()) return
    if (requiresManagedTrade && !normalizedTrade) return

    setSaving(true)
    setError(null)

    const payload = {
      job_id: jobId,
      row_kind: draft.row_kind,
      item_kind: draft.row_kind === 'assembly' ? null : draft.item_kind,
      parent_id: draft.row_kind === 'item' && draft.parent_id ? draft.parent_id : null,
      trade: normalizedTrade,
      description: draft.description.trim(),
      cost_code: draft.row_kind === 'assembly' ? null : draft.cost_code || null,
      qty: draft.row_kind === 'assembly' ? null : parsePositiveNumber(draft.qty),
      unit: draft.row_kind === 'assembly' ? null : draft.unit.trim() || null,
      unit_cost: draft.row_kind === 'assembly' ? null : parseNumberOrNull(draft.unit_cost),
      notes: draft.notes.trim() || null,
      sort_order: 0,
    }

    const { data, error: insertError } = await supabase
      .from('takeoff_items')
      .insert(payload)
      .select(
        'id, trade, description, cost_code, qty, unit, unit_cost, extended_cost, notes, sort_order, created_at, row_kind, item_kind, parent_id'
      )
      .single()

    setSaving(false)

    if (insertError || !data) {
      setError('Failed to save takeoff row. Please try again.')
      return
    }

    setItems((current) => [data, ...current])
    setDraft((current) => ({
      ...DRAFT_INITIAL,
      row_kind: current.row_kind,
      item_kind: current.item_kind,
      parent_id: current.parent_id,
      trade: current.row_kind === 'assembly' ? current.trade : '',
    }))
  }

  async function updateItem(id: string, patch: TakeoffEditablePatch) {
    setEditingId(id)
    setError(null)

    const { error: updateError } = await supabase
      .from('takeoff_items')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)

    setEditingId(null)

    if (updateError) {
      setError('Failed to update takeoff row. Please try again.')
      return
    }

    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  return (
    <TakeoffWorkspace
      items={items}
      trades={trades}
      costCodes={costCodes}
      scopeItems={scopeItems}
      draft={draft}
      setDraft={setDraft}
      saving={saving}
      editingId={editingId}
      error={error}
      onAddItem={addItem}
      onUpdateItem={updateItem}
    />
  )
}
