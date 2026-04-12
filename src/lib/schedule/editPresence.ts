import type { SupabaseClient } from '@supabase/supabase-js'

export async function setScheduleEditPresence(
  supabase: SupabaseClient,
  jobId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('schedule_edit_presence')
    .upsert({
      job_id: jobId,
      user_id: userId,
      last_seen_at: new Date().toISOString(),
    })

  if (error) throw error
}

export async function clearScheduleEditPresence(
  supabase: SupabaseClient,
  jobId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('schedule_edit_presence')
    .delete()
    .eq('job_id', jobId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function getScheduleEditPresence(
  supabase: SupabaseClient,
  jobId: string,
  currentUserId: string
): Promise<{ otherUsersEditing: number }> {
  const { data, error } = await supabase
    .from('schedule_edit_presence')
    .select('user_id')
    .eq('job_id', jobId)

  if (error) throw error

  const others =
    (data ?? []).filter((row) => row.user_id !== currentUserId).length

  return { otherUsersEditing: others }
}