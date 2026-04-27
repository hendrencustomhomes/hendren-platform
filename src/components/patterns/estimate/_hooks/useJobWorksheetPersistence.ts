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

  return { persistRow }
}
