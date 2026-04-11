'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { runScheduleApplyPipeline } from '@/lib/schedule/runApplyPipeline'
import { setJobBaseline } from '@/lib/schedule/baseline'

export type DraftScheduleItemUpdate = {
  id: string
  start_date: string | null
  duration_working_days: number | null
  include_saturday: boolean
  include_sunday: boolean
  buffer_working_days: number
}

export type SaveDraftActionResult = {
  ok: boolean
  error?: string
}

export type ActivateBaselineResult = {
  ok: boolean
  error?: string
}

export async function activateBaselineAction(
  jobId: string
): Promise<ActivateBaselineResult> {
  const supabase = await createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    await setJobBaseline(supabase, jobId, user?.id ?? null)

    revalidatePath('/schedule')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Baseline activation failed' }
  }
}

export async function saveScheduleDraftAction(
  jobId: string,
  updates: DraftScheduleItemUpdate[]
): Promise<SaveDraftActionResult> {
  const supabase = await createClient()

  try {
    // Write draft field changes to sub_schedule first
    for (const u of updates) {
      const { error } = await supabase
        .from('sub_schedule')
        .update({
          start_date: u.start_date,
          duration_working_days: u.duration_working_days,
          include_saturday: u.include_saturday,
          include_sunday: u.include_sunday,
          buffer_working_days: u.buffer_working_days,
        })
        .eq('id', u.id)
      if (error) throw error
    }

    // Run full resolve → impact-detect → apply → task-trigger pipeline
    await runScheduleApplyPipeline(supabase, jobId)

    revalidatePath('/schedule')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Save failed' }
  }
}
