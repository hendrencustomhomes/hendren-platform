import type { SupabaseClient } from '@supabase/supabase-js'

export async function logDependencyLagChange(
  supabase: SupabaseClient,
  dependencyId: string,
  oldLag: number,
  newLag: number
) {
  if (oldLag === newLag) return

  const { error } = await supabase.from('schedule_logs').insert({
    entity_type: 'dependency',
    entity_id: dependencyId,
    action: 'lag_updated',
    meta: {
      oldLag,
      newLag,
    },
  })

  if (error) throw error
}