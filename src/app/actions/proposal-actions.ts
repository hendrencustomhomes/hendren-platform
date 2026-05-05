'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import type { ProposalStructureJson, ProposalStatus } from '@/lib/proposalStructure'
import { requireModuleAccess } from '@/lib/access-control-server'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  return { supabase, user }
}

function revalidateProposal(jobId: string) {
  revalidatePath(`/jobs/${jobId}/proposal`)
  revalidatePath(`/jobs/${jobId}/proposal/builder`)
}

export type ProposalStructureRecord = {
  structure_json: ProposalStructureJson
  proposal_status: ProposalStatus
  locked_at: string | null
}

export async function getProposalStructure(
  estimateId: string,
): Promise<{ record: ProposalStructureRecord } | { error: string } | { notFound: true }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'view')
  if (permGuard) return permGuard

  const { data, error } = await auth.supabase
    .from('proposal_structures')
    .select('structure_json, proposal_status, locked_at')
    .eq('estimate_id', estimateId)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { notFound: true }

  return { record: data as ProposalStructureRecord }
}

export async function saveProposalStructure(
  estimateId: string,
  jobId: string,
  structure: ProposalStructureJson,
): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  // Block structure saves on locked proposals (app-layer enforcement)
  const { data: existing } = await auth.supabase
    .from('proposal_structures')
    .select('locked_at')
    .eq('estimate_id', estimateId)
    .maybeSingle()

  if (existing?.locked_at) {
    return { error: 'Proposal is locked. Unlock it before making structural changes.' }
  }

  const { error } = await auth.supabase
    .from('proposal_structures')
    .upsert(
      { estimate_id: estimateId, structure_json: structure, updated_at: new Date().toISOString() },
      { onConflict: 'estimate_id' },
    )

  if (error) return { error: error.message }

  revalidateProposal(jobId)
  return { success: true }
}

// Sign the proposal (sent → signed). Cannot be undone.
export async function signProposal(
  estimateId: string,
  jobId: string,
): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'manage')
  if (permGuard) return permGuard

  const { data: existing, error: fetchErr } = await auth.supabase
    .from('proposal_structures')
    .select('proposal_status')
    .eq('estimate_id', estimateId)
    .maybeSingle()

  if (fetchErr) return { error: fetchErr.message }

  const currentStatus = (existing?.proposal_status ?? 'draft') as ProposalStatus
  if (currentStatus !== 'sent') {
    return { error: `Cannot sign: proposal must be 'sent' first (currently '${currentStatus}').` }
  }

  const { error } = await auth.supabase
    .from('proposal_structures')
    .update({ proposal_status: 'signed', updated_at: new Date().toISOString() })
    .eq('estimate_id', estimateId)

  if (error) return { error: error.message }

  revalidateProposal(jobId)
  return { success: true }
}

// Void the proposal (sent or signed → voided).
// If voided from 'sent', also unlocks the estimate.
// If voided from 'signed', estimate stays locked (signed is irreversible).
export async function voidProposal(
  estimateId: string,
  jobId: string,
): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'manage')
  if (permGuard) return permGuard

  const { data: existing, error: fetchErr } = await auth.supabase
    .from('proposal_structures')
    .select('proposal_status')
    .eq('estimate_id', estimateId)
    .maybeSingle()

  if (fetchErr) return { error: fetchErr.message }

  const currentStatus = (existing?.proposal_status ?? 'draft') as ProposalStatus
  if (currentStatus !== 'sent' && currentStatus !== 'signed') {
    return { error: `Cannot void: proposal status is '${currentStatus}'.` }
  }

  const now = new Date().toISOString()

  const { error: voidErr } = await auth.supabase
    .from('proposal_structures')
    .update({ proposal_status: 'voided', updated_at: now })
    .eq('estimate_id', estimateId)

  if (voidErr) return { error: voidErr.message }

  // Only unlock the estimate if voided from 'sent' (signed lock is permanent)
  if (currentStatus === 'sent') {
    await auth.supabase
      .from('estimates')
      .update({ locked_at: null, locked_by: null, locked_reason: null })
      .eq('id', estimateId)
  }

  revalidateProposal(jobId)
  revalidatePath(`/jobs/${jobId}/worksheet`)
  return { success: true }
}

// Reject the proposal (sent → rejected on estimates).
// The proposal_structures record remains at 'sent' — ProposalStatus does not include 'rejected'.
// Estimates is the authoritative status source; rejection is an estimate-lifecycle event.
export async function rejectProposal(
  estimateId: string,
  jobId: string,
): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'manage')
  if (permGuard) return permGuard

  const { data: estimate, error: fetchErr } = await auth.supabase
    .from('estimates')
    .select('status')
    .eq('id', estimateId)
    .single()

  if (fetchErr || !estimate) return { error: fetchErr?.message ?? 'Estimate not found' }
  if (estimate.status !== 'sent') {
    return { error: `Cannot reject: estimate status is '${estimate.status}'. Only sent estimates can be rejected.` }
  }

  const { error } = await auth.supabase
    .from('estimates')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', estimateId)
    .eq('job_id', jobId)

  if (error) return { error: error.message }

  revalidateProposal(jobId)
  revalidatePath(`/jobs/${jobId}/worksheet`)
  return { success: true }
}
