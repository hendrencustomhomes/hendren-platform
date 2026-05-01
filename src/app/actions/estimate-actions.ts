'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import type { Estimate } from '@/lib/estimateTypes'

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

  const now = new Date().toISOString()

  // Demote current active to draft first (removes unique-index occupant)
  const { error: demoteError } = await auth.supabase
    .from('estimates')
    .update({ status: 'draft', updated_at: now })
    .eq('job_id', jobId)
    .eq('status', 'active')

  if (demoteError) return { error: demoteError.message }

  // Promote target estimate to active
  const { error: promoteError } = await auth.supabase
    .from('estimates')
    .update({ status: 'active', updated_at: now })
    .eq('id', estimateId)

  if (promoteError) return { error: promoteError.message }

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

  const { data: source, error: fetchError } = await auth.supabase
    .from('estimates')
    .select('title, is_change_order')
    .eq('id', estimateId)
    .single()

  if (fetchError || !source) return { error: fetchError?.message ?? 'Estimate not found' }

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
  revalidateWorksheet(jobId)
  return { estimate: data as Estimate }
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

  if (error) return { error: error.message }
  revalidateWorksheet(jobId)
  return { success: true }
}
