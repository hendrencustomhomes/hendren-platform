'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import {
  deriveDefaultStructure,
  reconcileStructure,
  applyStructure,
  type ProposalStructureJson,
  type ProposalStatus,
} from '@/lib/proposalStructure'
import { ESTIMATE_SELECT } from '@/lib/estimateTypes'
import type { Estimate } from '@/lib/estimateTypes'
import type { ProposalSnapshotJson, ProposalDocStatus } from '@/lib/proposalSnapshot'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  return { supabase, user }
}

// Create an immutable snapshot of the current proposal state.
// doc_status is derived from the current proposal_status:
//   draft → draft_snapshot  |  sent → sent  |  signed → signed  |  voided → voided
// Does NOT mutate proposal or estimate state.
export async function createProposalSnapshot(
  estimateId: string,
  jobId: string,
): Promise<{ documentId: string } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const { data: job } = await auth.supabase
    .from('jobs')
    .select('job_name')
    .eq('id', jobId)
    .single()

  if (!job) return { error: 'Job not found' }

  const { data: estimatesRaw } = await auth.supabase
    .from('estimates')
    .select(ESTIMATE_SELECT)
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })

  const estimates = (estimatesRaw ?? []) as Estimate[]
  const activeEstimate = estimates.find((e) => e.id === estimateId && e.status === 'active') ?? null

  if (!activeEstimate) return { error: 'No active estimate found for the given estimate ID' }

  const [{ data: rowsRaw }, { data: structureRecord }] = await Promise.all([
    auth.supabase
      .from('job_worksheet_items')
      .select('*')
      .eq('estimate_id', estimateId)
      .order('sort_order', { ascending: true }),
    auth.supabase
      .from('proposal_structures')
      .select('structure_json, proposal_status, locked_at')
      .eq('estimate_id', estimateId)
      .maybeSingle(),
  ])

  const worksheetRows = (rowsRaw ?? []) as any
  const proposalStatus = ((structureRecord as any)?.proposal_status ?? 'draft') as ProposalStatus
  const isLocked = !!((structureRecord as any)?.locked_at)

  // Same derive/reconcile/freeze logic used by preview and PDF routes
  let structure: ProposalStructureJson
  if (!(structureRecord as any)?.structure_json) {
    structure = deriveDefaultStructure(worksheetRows)
  } else if (isLocked) {
    structure = (structureRecord as any).structure_json
  } else {
    structure = reconcileStructure((structureRecord as any).structure_json, worksheetRows)
  }

  const summary = applyStructure(structure, worksheetRows)

  const docStatusMap: Record<ProposalStatus, ProposalDocStatus> = {
    draft:  'draft_snapshot',
    sent:   'sent',
    signed: 'signed',
    voided: 'voided',
  }
  const docStatus: ProposalDocStatus = docStatusMap[proposalStatus]

  const snapshotJson: ProposalSnapshotJson = {
    version: 1,
    captured_at: new Date().toISOString(),
    proposal_status: proposalStatus,
    job_name: job.job_name || '',
    estimate_title: activeEstimate.title,
    grand_total: summary.grandTotal,
    sections: summary.sections.map((section) => ({
      id: section.id,
      title: section.description,
      subtotal: section.subtotal,
      items: section.items.map((item) => ({
        id: item.id,
        depth: item.depth,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        row_kind: item.row_kind,
        line_total: item.lineTotal,
      })),
    })),
  }

  const { data: doc, error: insertErr } = await auth.supabase
    .from('proposal_documents')
    .insert({
      job_id: jobId,
      estimate_id: estimateId,
      doc_status: docStatus,
      title: `${job.job_name || 'Job'} — Proposal`,
      snapshot_json: snapshotJson,
      created_by: auth.user.id,
    })
    .select('id')
    .single()

  if (insertErr) return { error: insertErr.message }

  revalidatePath(`/jobs/${jobId}/proposal`)
  revalidatePath(`/jobs/${jobId}/proposal/preview`)
  return { documentId: doc.id }
}

// Atomic send: locks the proposal (draft → sent), locks the estimate, and creates an
// immutable sent-document snapshot in a single Postgres transaction via RPC.
// If the snapshot INSERT fails for any reason, the proposal/estimate writes roll back too.
export async function sendProposal(
  estimateId: string,
  jobId: string,
): Promise<{ documentId: string } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const { data: job } = await auth.supabase
    .from('jobs')
    .select('job_name')
    .eq('id', jobId)
    .single()
  if (!job) return { error: 'Job not found' }

  const { data: estimatesRaw } = await auth.supabase
    .from('estimates')
    .select(ESTIMATE_SELECT)
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })

  const estimates = (estimatesRaw ?? []) as Estimate[]
  const activeEstimate = estimates.find((e) => e.id === estimateId && e.status === 'active') ?? null
  if (!activeEstimate) return { error: 'No active estimate found' }

  // Load worksheet rows and proposal structure in one round-trip
  const [{ data: rowsRaw }, { data: structureRecord }] = await Promise.all([
    auth.supabase
      .from('job_worksheet_items')
      .select('*')
      .eq('estimate_id', estimateId)
      .order('sort_order', { ascending: true }),
    auth.supabase
      .from('proposal_structures')
      .select('structure_json, proposal_status, locked_at')
      .eq('estimate_id', estimateId)
      .maybeSingle(),
  ])

  // Pre-check: must be draft before computing the snapshot (the RPC checks too)
  const currentStatus = ((structureRecord as any)?.proposal_status ?? 'draft') as ProposalStatus
  if (currentStatus !== 'draft') {
    return { error: `Cannot send: proposal is already '${currentStatus}'` }
  }

  const worksheetRows = (rowsRaw ?? []) as any

  // Proposal is draft (unlocked) — always reconcile
  let structure: ProposalStructureJson
  if (!(structureRecord as any)?.structure_json) {
    structure = deriveDefaultStructure(worksheetRows)
  } else {
    structure = reconcileStructure((structureRecord as any).structure_json, worksheetRows)
  }

  const summary = applyStructure(structure, worksheetRows)

  const snapshotJson: ProposalSnapshotJson = {
    version: 1,
    captured_at: new Date().toISOString(),
    proposal_status: 'sent',
    job_name: job.job_name || '',
    estimate_title: activeEstimate.title,
    grand_total: summary.grandTotal,
    sections: summary.sections.map((section) => ({
      id: section.id,
      title: section.description,
      subtotal: section.subtotal,
      items: section.items.map((item) => ({
        id: item.id,
        depth: item.depth,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        row_kind: item.row_kind,
        line_total: item.lineTotal,
      })),
    })),
  }

  // Single atomic RPC: lock estimate + transition proposal to sent + insert snapshot.
  // Any failure inside the Postgres function rolls back all three writes.
  const { data: documentId, error: rpcErr } = await auth.supabase.rpc('send_proposal', {
    p_estimate_id:   estimateId,
    p_job_id:        jobId,
    p_user_id:       auth.user.id,
    p_snapshot_json: snapshotJson,
    p_title:         `${job.job_name || 'Job'} — Proposal`,
  })

  if (rpcErr) return { error: rpcErr.message }

  revalidatePath(`/jobs/${jobId}/proposal`)
  revalidatePath(`/jobs/${jobId}/proposal/builder`)
  revalidatePath(`/jobs/${jobId}/proposal/preview`)
  revalidatePath(`/jobs/${jobId}/worksheet`)
  return { documentId: documentId as string }
}

// Void a proposal document. Sets doc_status = 'voided' and voided_at.
// Never deletes — snapshot_json is preserved.
export async function voidProposalDocument(
  documentId: string,
  jobId: string,
): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const { data: doc, error: fetchErr } = await auth.supabase
    .from('proposal_documents')
    .select('doc_status, job_id')
    .eq('id', documentId)
    .single()

  if (fetchErr || !doc) return { error: 'Document not found' }
  if ((doc as any).job_id !== jobId) return { error: 'Document does not belong to this job' }
  if ((doc as any).doc_status === 'voided') return { error: 'Document is already voided' }

  const { error } = await auth.supabase
    .from('proposal_documents')
    .update({ doc_status: 'voided', voided_at: new Date().toISOString() })
    .eq('id', documentId)

  if (error) return { error: error.message }

  revalidatePath(`/jobs/${jobId}/proposal`)
  revalidatePath(`/jobs/${jobId}/proposal/preview`)
  revalidatePath(`/jobs/${jobId}/proposal/documents/${documentId}`)
  return { success: true }
}
