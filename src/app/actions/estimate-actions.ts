'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import type { Estimate } from '@/lib/estimateTypes'
import { ESTIMATE_SELECT, isEstimateEditable, NON_ARCHIVABLE_STATUSES } from '@/lib/estimateTypes'
import { parseImportCsv } from '@/lib/worksheetCsv'
import { requireModuleAccess } from '@/lib/access-control-server'
import { resolveUnitCost } from '@/components/patterns/estimate/_lib/unitCostResolver'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  return { supabase, user }
}

function revalidateWorksheet(jobId: string) {
  revalidatePath(`/jobs/${jobId}/worksheet`)
}

export async function getEstimatesForJob(
  jobId: string,
): Promise<{ estimates: Estimate[] } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'view')
  if (permGuard) return permGuard

  const { data, error } = await auth.supabase
    .from('estimates')
    .select(ESTIMATE_SELECT)
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }
  return { estimates: (data ?? []) as Estimate[] }
}

export async function createEstimate(
  jobId: string,
  title = 'New Estimate',
): Promise<{ estimate: Estimate } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  const { data, error } = await auth.supabase
    .from('estimates')
    .insert({ job_id: jobId, title, status: 'draft', created_by: auth.user.id })
    .select(ESTIMATE_SELECT)
    .single()

  if (error) return { error: error.message }
  revalidateWorksheet(jobId)
  return { estimate: data as Estimate }
}

export async function setActiveEstimate(
  estimateId: string,
  jobId: string,
): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  const { data: stagedOther } = await auth.supabase
    .from('estimates')
    .select('id')
    .eq('job_id', jobId)
    .eq('status', 'staged')
    .neq('id', estimateId)
    .limit(1)

  if (stagedOther && stagedOther.length > 0) {
    return { error: 'Cannot activate another estimate while one is staged.' }
  }

  const { error } = await auth.supabase.rpc('set_active_estimate', {
    p_estimate_id: estimateId,
    p_job_id: jobId,
  })

  if (error) return { error: error.message }
  revalidateWorksheet(jobId)
  return { success: true }
}

export async function archiveEstimate(
  estimateId: string,
  jobId: string,
): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  const { data: estimate, error: fetchError } = await auth.supabase
    .from('estimates')
    .select('status')
    .eq('id', estimateId)
    .single()

  if (fetchError || !estimate) return { error: fetchError?.message ?? 'Estimate not found' }
  if (NON_ARCHIVABLE_STATUSES.includes(estimate.status)) {
    return { error: `Cannot archive an estimate with status '${estimate.status}'.` }
  }

  const { error } = await auth.supabase
    .from('estimates')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', estimateId)
    .eq('job_id', jobId)

  if (error) return { error: error.message }
  revalidateWorksheet(jobId)
  return { success: true }
}

export async function duplicateEstimate(
  estimateId: string,
  jobId: string,
): Promise<{ estimate: Estimate } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  const [
    { data: source, error: fetchError },
    { data: sourceRows, error: rowsError },
  ] = await Promise.all([
    auth.supabase
      .from('estimates')
      .select('title, is_change_order')
      .eq('id', estimateId)
      .single(),
    auth.supabase
      .from('job_worksheet_items')
      .select('*')
      .eq('estimate_id', estimateId)
      .order('sort_order', { ascending: true }),
  ])

  if (fetchError || !source) return { error: fetchError?.message ?? 'Estimate not found' }
  if (rowsError) return { error: rowsError.message }

  const { data, error } = await auth.supabase
    .from('estimates')
    .insert({
      job_id: jobId,
      title: `${source.title} (copy)`,
      status: 'draft',
      is_change_order: source.is_change_order,
      created_by: auth.user.id,
    })
    .select(ESTIMATE_SELECT)
    .single()

  if (error) return { error: error.message }

  const rows = sourceRows ?? []
  if (rows.length > 0) {
    // Build old→new id mapping so parent_id references survive the copy
    const idMap = new Map<string, string>()
    for (const row of rows) {
      idMap.set(row.id, crypto.randomUUID())
    }

    // Sever the pricing link on the copy and freeze the source row's resolved unit cost
    // into unit_cost_manual on the new row. The duplicate must be self-contained: it cannot
    // continue resolving through pricing_source_row_id (link is reset) or unit_cost_source
    // (would silently drift if the source is later edited). resolveUnitCost is the single
    // source of truth for the precedence (override → source → manual); using it here keeps
    // the duplicate's resolved truth identical to the source's at duplication time.
    const copiedRows = rows.map((row: any) => ({
      id: idMap.get(row.id)!,
      estimate_id: data.id,
      job_id: jobId,
      parent_id: row.parent_id ? (idMap.get(row.parent_id) ?? null) : null,
      sort_order: row.sort_order,
      row_kind: row.row_kind,
      description: row.description,
      location: row.location,
      quantity: row.quantity,
      unit: row.unit,
      notes: row.notes,
      scope_status: row.scope_status,
      is_upgrade: row.is_upgrade,
      pricing_type: row.pricing_type,
      replaces_item_id: null,
      pricing_source_row_id: null,
      pricing_header_id: null,
      catalog_sku: row.catalog_sku,
      source_sku: row.source_sku,
      unit_cost_manual: resolveUnitCost(row),
      unit_cost_source: null,
      unit_cost_override: null,
      unit_cost_is_overridden: false,
    }))

    const { error: insertError } = await auth.supabase
      .from('job_worksheet_items')
      .insert(copiedRows)

    if (insertError) return { error: insertError.message }
  }

  revalidateWorksheet(jobId)
  return { estimate: data as Estimate }
}

export async function importEstimate(
  jobId: string,
  csvText: string,
): Promise<{ estimateId: string } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  // Import always creates a new draft estimate — it is never locked by definition.
  // (Locking applies to existing estimates, not freshly created ones.)
  const { data: newEstimate, error: createError } = await auth.supabase
    .from('estimates')
    .insert({ job_id: jobId, title: 'Imported Estimate', status: 'draft', created_by: auth.user.id })
    .select('id')
    .single()

  if (createError || !newEstimate) return { error: createError?.message ?? 'Failed to create estimate.' }

  const { rows, errors } = parseImportCsv(csvText, newEstimate.id, jobId)

  if (errors.length > 0) {
    await auth.supabase.from('estimates').delete().eq('id', newEstimate.id)
    return { error: errors[0] }
  }

  const { error: insertError } = await auth.supabase
    .from('job_worksheet_items')
    .insert(rows as any[])

  if (insertError) {
    await auth.supabase.from('estimates').delete().eq('id', newEstimate.id)
    return { error: insertError.message }
  }

  revalidateWorksheet(jobId)
  return { estimateId: newEstimate.id }
}

export async function restoreEstimate(
  estimateId: string,
  jobId: string,
): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  const { data: estimate, error: fetchError } = await auth.supabase
    .from('estimates')
    .select('status')
    .eq('id', estimateId)
    .single()

  if (fetchError || !estimate) return { error: fetchError?.message ?? 'Estimate not found' }
  if (estimate.status !== 'archived') {
    return { error: `Cannot restore an estimate with status '${estimate.status}'. Only archived estimates can be restored.` }
  }

  const { error } = await auth.supabase
    .from('estimates')
    .update({ status: 'draft', updated_at: new Date().toISOString() })
    .eq('id', estimateId)
    .eq('job_id', jobId)

  if (error) return { error: error.message }
  revalidateWorksheet(jobId)
  return { success: true }
}

export async function stageEstimate(
  estimateId: string,
  jobId: string,
): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  const { data: estimate, error: fetchError } = await auth.supabase
    .from('estimates')
    .select('status, locked_at')
    .eq('id', estimateId)
    .single()

  if (fetchError || !estimate) return { error: fetchError?.message ?? 'Estimate not found' }
  if (estimate.status !== 'active') {
    return { error: `Cannot stage an estimate with status '${estimate.status}'. Only the active estimate can be staged.` }
  }
  if (estimate.locked_at) {
    return { error: 'Cannot stage a locked estimate.' }
  }

  const { error } = await auth.supabase
    .from('estimates')
    .update({ status: 'staged', updated_at: new Date().toISOString() })
    .eq('id', estimateId)
    .eq('job_id', jobId)

  if (error) return { error: error.message }
  revalidateWorksheet(jobId)
  return { success: true }
}

export async function unstageEstimate(
  estimateId: string,
  jobId: string,
): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  const { data: estimate, error: fetchError } = await auth.supabase
    .from('estimates')
    .select('status, locked_at')
    .eq('id', estimateId)
    .single()

  if (fetchError || !estimate) return { error: fetchError?.message ?? 'Estimate not found' }
  if (estimate.status !== 'staged') {
    return { error: `Cannot unstage an estimate with status '${estimate.status}'. Only staged estimates can be unstaged.` }
  }
  if (estimate.locked_at) {
    return { error: 'Cannot unstage a locked estimate.' }
  }

  // Use set_active_estimate RPC to atomically promote this estimate to active
  // and demote any currently active estimate for the same job.
  const { error } = await auth.supabase.rpc('set_active_estimate', {
    p_estimate_id: estimateId,
    p_job_id: jobId,
  })

  if (error) return { error: error.message }
  revalidateWorksheet(jobId)
  return { success: true }
}

export async function renameEstimate(
  estimateId: string,
  title: string,
  jobId: string,
): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  if (!title.trim()) return { error: 'Name cannot be empty' }

  const { data: estimate, error: fetchError } = await auth.supabase
    .from('estimates')
    .select('status, locked_at')
    .eq('id', estimateId)
    .single()

  if (fetchError || !estimate) return { error: fetchError?.message ?? 'Estimate not found' }
  if (!isEstimateEditable(estimate)) return { error: 'Estimate is locked and cannot be modified' }

  const { error } = await auth.supabase
    .from('estimates')
    .update({ title: title.trim(), updated_at: new Date().toISOString() })
    .eq('id', estimateId)
    .eq('job_id', jobId)

  if (error) return { error: error.message }
  revalidateWorksheet(jobId)
  return { success: true }
}
