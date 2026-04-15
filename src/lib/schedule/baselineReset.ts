import type { SupabaseClient } from '@supabase/supabase-js'

export async function resetBaselineForItemIfMisEntry(
  supabase: SupabaseClient,
  scheduleId: string,
  shiftReasonType: string | null | undefined
): Promise<boolean> {
  if (shiftReasonType !== 'mis_entry') {
    return false
  }

  const { data, error } = await supabase
    .from('sub_schedule')
    .select('id, start_date, end_date')
    .eq('id', scheduleId)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error('Schedule item not found for baseline reset')
  }

  const { error: updateError } = await supabase
    .from('sub_schedule')
    .update({
      baseline_start_date: data.start_date,
      baseline_end_date: data.end_date,
    })
    .eq('id', scheduleId)

  if (updateError) throw updateError

  return true
}