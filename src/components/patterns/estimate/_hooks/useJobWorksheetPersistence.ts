'use client'

import { createClient } from '@/utils/supabase/client'
import type { JobWorksheetRow } from '../JobWorksheetTableAdapter'

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
  row_kind: 'line_item'
  description: string
  location: string | null
  quantity: number | string | null
  unit: string | null
  notes: string | null
  scope_status: 'included'
  is_upgrade: false
  pricing_type: 'unpriced'
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

  return { persistRow, createRow }
}
