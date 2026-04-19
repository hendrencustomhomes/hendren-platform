'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  return { supabase, user }
}

export async function archiveJob(jobId: string) {
  const auth = await requireUser()
  if ('error' in auth) redirect('/login')

  const { supabase, user } = auth
  const { error } = await supabase
    .from('jobs')
    .update({
      archived_at: new Date().toISOString(),
      archived_by: user.id,
    })
    .eq('id', jobId)

  if (error) throw new Error(error.message)

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${jobId}`)
  redirect('/jobs')
}

export async function trashJob(jobId: string) {
  return archiveJob(jobId)
}

export async function restoreJob(jobId: string) {
  const auth = await requireUser()
  if ('error' in auth) redirect('/login')

  const { supabase } = auth
  const { error } = await supabase
    .from('jobs')
    .update({
      archived_at: null,
      archived_by: null,
    })
    .eq('id', jobId)

  if (error) throw new Error(error.message)

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${jobId}`)
  redirect('/jobs?view=archived')
}
