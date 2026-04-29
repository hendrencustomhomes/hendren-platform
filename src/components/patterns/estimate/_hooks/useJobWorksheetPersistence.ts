'use client'

import { createClient } from '@/utils/supabase/client'
import type { JobWorksheetRow, JobWorksheetRowKind } from '../JobWorksheetTableAdapter'

export type UpdateJobWorksheetRowPatch = {
  description: string
  location: string | null
  quantity: number | string | null
  unit: string | null
  notes: string | null
}

export type CreateJobWorksheetRowInput = {
  job_id: string
  parent_id: string | null
  sort_order: number
  row_kind: JobWorksheetRowKind
  description: string
  location: string | null
  quantity: number | string | null
  unit: string | null
  notes: string | null
  scope_status: 'included'
  is_upgrade: false
  pricing_type: 'unpriced'
}

export type WorksheetSortOrderUpdate = {
  id: string
  sort_order: number
}

export function useJobWorksheetPersistence() {
  const supabase = createClient()

  async function persistRow(rowId: string, patch: UpdateJobWorksheetRowPatch) {
    const { data, error } = await supabase
      .from('job_worksheet_items')
      .update(patch)
      .eq('id', rowId)
      .select('*')
      .single()

    if (error || !data) {
      throw error ?? new Error('Failed to save worksheet row.')
    }

    return data as JobWorksheetRow
  }

  async function createRow(input: CreateJobWorksheetRowInput) {
    const { data, error } = await supabase
      .from('job_worksheet_items')
      .insert(input)
      .select('*')
      .single()

    if (error || !data) {
      throw error ?? new Error('Failed to create worksheet row.')
    }

    return data as JobWorksheetRow
  }

  async function deleteRow(rowId: string) {
    const { error } = await supabase
      .from('job_worksheet_items')
      .delete()
      .eq('id', rowId)

    if (error) {
      throw error
    }
  }

  async function persistSortOrders(updates: WorksheetSortOrderUpdate[]) {
    if (updates.length === 0) return

    const results = await Promise.all(
      updates.map((update) =>
        supabase
          .from('job_worksheet_items')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id)
          .select('id, sort_order')
          .single()
      )
    )

    const failed = results.find((result) => result.error)
    if (failed?.error) throw failed.error
  }

  return { persistRow, createRow, deleteRow, persistSortOrders }
}
