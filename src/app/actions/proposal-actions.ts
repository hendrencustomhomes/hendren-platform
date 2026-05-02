'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import type { ProposalStructureJson } from '@/lib/proposalStructure'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  return { supabase, user }
}

export async function getProposalStructure(
  estimateId: string,
  jobId: string,
): Promise<{ structure: ProposalStructureJson } | { error: string } | { notFound: true }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const { data, error } = await auth.supabase
    .from('proposal_structures')
    .select('structure_json')
    .eq('estimate_id', estimateId)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { notFound: true }

  return { structure: data.structure_json as ProposalStructureJson }
}

export async function saveProposalStructure(
  estimateId: string,
  jobId: string,
  structure: ProposalStructureJson,
): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const { error } = await auth.supabase
    .from('proposal_structures')
    .upsert(
      { estimate_id: estimateId, structure_json: structure, updated_at: new Date().toISOString() },
      { onConflict: 'estimate_id' },
    )

  if (error) return { error: error.message }

  revalidatePath(`/jobs/${jobId}/proposal`)
  return { success: true }
}
