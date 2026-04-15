'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import TakeoffWorkspace from './TakeoffWorkspace'
import type {
  CostCodeOption,
  ScopeContextItem,
  TakeoffEditablePatch,
  TakeoffItem,
  TradeOption,
} from './takeoffTypes'
import { parseNumberOrNull, parsePositiveNumber } from './takeoffUtils'

type TakeoffDraft = {
  trade: string
  description: string
  cost_code: string
  qty: string
  unit: string
  unit_cost: string
  notes: string
}

const DRAFT_INITIAL: TakeoffDraft = {
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

  async function addItem() {
    if (!draft.trade.trim() || !draft.description.trim()) return

    setSaving(true)
    setError(null)

    const payload = {
      job_id: jobId,
      trade: draft.trade.trim(),
      description: draft.description.trim(),
      cost_code: draft.cost_code || null,
      qty: parsePositiveNumber(draft.qty),
      unit: draft.unit.trim() || null,
      unit_cost: parseNumberOrNull(draft.unit_cost),
      notes: draft.notes.trim() || null,
      sort_order: 0,
    }

    const { data, error: insertError } = await supabase
      .from('takeoff_items')
      .insert(payload)
      .select('id, trade, description, cost_code, qty, unit, unit_cost, extended_cost, notes, sort_order, created_at')
      .single()

    setSaving(false)

    if (insertError || !data) {
      setError('Failed to save takeoff item. Please try again.')
      return
    }

    setItems((current) => [data, ...current])
    setDraft(DRAFT_INITIAL)
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
      setError('Failed to update takeoff item. Please try again.')
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
