'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import type { Estimate } from '@/lib/estimateTypes'
import { parseImportCsv } from '@/lib/worksheetCsv'

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

  const { data, error } = await auth.supabase
    .from('estimates')
    .select('id, job_id, title, status, is_change_order, parent_estimate_id, created_by, created_at, updated_at')
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

  const { data, error } = await auth.supabase
    .from('estimates')
    .insert({ job_id: jobId, title, status: 'draft', created_by: auth.user.id })
    .select('id, job_id, title, status, is_change_order, parent_estimate_id, created_by, created_at, updated_at')
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

  const { data: estimate, error: fetchError } = await auth.supabase
    .from('estimates')
    .select('status')
    .eq('id', estimateId)
    .single()

  if (fetchError || !estimate) return { error: fetchError?.message ?? 'Estimate not found' }
  if (estimate.status === 'active') {
    return { error: 'Cannot archive the active estimate. Set another estimate as active first.' }
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
    .select('id, job_id, title, status, is_change_order, parent_estimate_id, created_by, created_at, updated_at')
    .single()

  if (error) return { error: error.message }

  const rows = sourceRows ?? []
  if (rows.length > 0) {
    // Build old→new id mapping so parent_id references survive the copy
    const idMap = new Map<string, string>()
    for (const row of rows) {
      idMap.set(row.id, crypto.randomUUID())
    }

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
      unit_price: row.unit_price,
      notes: row.notes,
      scope_status: row.scope_status,
      is_upgrade: row.is_upgrade,
      pricing_type: row.pricing_type,
      replaces_item_id: null,
      pricing_source_row_id: null,
      pricing_header_id: null,
      catalog_sku: row.catalog_sku,
      source_sku: row.source_sku,
      total_price: row.total_price,
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

export async function renameEstimate(
  estimateId: string,
  title: string,
  jobId: string,
): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  if (!title.trim()) return { error: 'Name cannot be empty' }

  const { error } = await auth.supabase
    .from('estimates')
    .update({ title: title.trim(), updated_at: new Date().toISOString() })
    .eq('id', estimateId)
    .eq('job_id', jobId)

  if (error) return { error: error.message }
  revalidateWorksheet(jobId)
  return { success: true }
}
