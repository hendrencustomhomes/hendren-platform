'use server'

import { createClient } from '@/utils/supabase/server'
import { isEstimateEditable } from '@/lib/estimateTypes'
import { requireModuleAccess } from '@/lib/access-control-server'
import type { JobWorksheetRow } from '@/components/patterns/estimate/JobWorksheetTableAdapter'
import type {
  CreateJobWorksheetRowInput,
  UpdateJobWorksheetRowPatch,
  WorksheetSortOrderUpdate,
} from '@/components/patterns/estimate/_hooks/useJobWorksheetPersistence'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  return { supabase, user }
}

// Returns { error } if the estimate is not found or not editable; null if editable.
async function requireEditableEstimate(
  supabase: SupabaseServerClient,
  estimateId: string,
): Promise<{ error: string } | null> {
  const { data, error } = await supabase
    .from('estimates')
    .select('status, locked_at')
    .eq('id', estimateId)
    .single()
  if (error || !data) return { error: error?.message ?? 'Estimate not found' }
  if (!isEstimateEditable(data)) return { error: 'Estimate is locked and cannot be modified' }
  return null
}

export async function persistWorksheetRow(
  estimateId: string,
  rowId: string,
  patch: UpdateJobWorksheetRowPatch,
): Promise<JobWorksheetRow | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  const guard = await requireEditableEstimate(auth.supabase, estimateId)
  if (guard) return guard

  const { data, error } = await auth.supabase
    .from('job_worksheet_items')
    .update(patch)
    .eq('id', rowId)
    .eq('estimate_id', estimateId)
    .select('*')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to save worksheet row' }
  return data as JobWorksheetRow
}

export async function createWorksheetRow(
  input: CreateJobWorksheetRowInput,
): Promise<JobWorksheetRow | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  const guard = await requireEditableEstimate(auth.supabase, input.estimate_id)
  if (guard) return guard

  const { data, error } = await auth.supabase
    .from('job_worksheet_items')
    .insert(input)
    .select('*')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to create worksheet row' }
  return data as JobWorksheetRow
}

export async function restoreWorksheetRows(
  estimateId: string,
  rows: JobWorksheetRow[],
): Promise<JobWorksheetRow[] | { error: string }> {
  if (rows.length === 0) return []

  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  const guard = await requireEditableEstimate(auth.supabase, estimateId)
  if (guard) return guard

  const { data, error } = await auth.supabase
    .from('job_worksheet_items')
    .insert(rows as any[])
    .select('*')

  if (error || !data) return { error: error?.message ?? 'Failed to restore worksheet rows' }
  return data as JobWorksheetRow[]
}

export async function deleteWorksheetRow(
  estimateId: string,
  rowId: string,
): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  const guard = await requireEditableEstimate(auth.supabase, estimateId)
  if (guard) return guard

  const { error } = await auth.supabase
    .from('job_worksheet_items')
    .delete()
    .eq('id', rowId)
    .eq('estimate_id', estimateId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function persistWorksheetSortOrders(
  estimateId: string,
  updates: WorksheetSortOrderUpdate[],
): Promise<{ success: true } | { error: string }> {
  if (updates.length === 0) return { success: true }

  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  const guard = await requireEditableEstimate(auth.supabase, estimateId)
  if (guard) return guard

  const results = await Promise.all(
    updates.map((update) =>
      auth.supabase
        .from('job_worksheet_items')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id)
        .eq('estimate_id', estimateId)
        .select('id, sort_order')
        .single(),
    ),
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) return { error: failed.error.message }
  return { success: true }
}
