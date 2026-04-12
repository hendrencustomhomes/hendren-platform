'use server'

import { revalidatePath } from 'next/cache'
import { getScheduleDependencies } from '@/lib/db'
import { setJobBaseline } from '@/lib/schedule/baseline'
import { resetBaselineForItemIfMisEntry } from '@/lib/schedule/baselineReset'
import {
  applyManualShiftDependencyAdjustments,
  computeManualShiftDependencyAdjustments,
} from '@/lib/schedule/manualShift'
import { runScheduleApplyPipeline } from '@/lib/schedule/runApplyPipeline'
import { createClient } from '@/utils/supabase/server'

export type DraftScheduleItemUpdate = {
  id: string
  start_date: string | null
  duration_working_days: number | null
  include_saturday: boolean
  include_sunday: boolean
  buffer_working_days: number
  shift_reason_type: string | null
  shift_reason_note: string | null
  shift_dependencies: boolean
  old_start_date: string | null
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
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : 'Baseline activation failed',
    }
  }
}

export async function saveScheduleDraftAction(
  jobId: string,
  updates: DraftScheduleItemUpdate[]
): Promise<SaveDraftActionResult> {
  const supabase = await createClient()

  try {
    const dependencies = await getScheduleDependencies(supabase, jobId)

    for (const u of updates) {
      const { error } = await supabase
        .from('sub_schedule')
        .update({
          start_date: u.start_date,
          duration_working_days: u.duration_working_days,
          include_saturday: u.include_saturday,
          include_sunday: u.include_sunday,
          buffer_working_days: u.buffer_working_days,
          shift_reason_type: u.shift_reason_type,
          shift_reason_note: u.shift_reason_note,
        })
        .eq('id', u.id)

      if (error) throw error

      await resetBaselineForItemIfMisEntry(supabase, u.id, u.shift_reason_type)

      if (u.shift_dependencies === false) {
        const adjustments = computeManualShiftDependencyAdjustments({
          movedItemId: u.id,
          oldStartDate: u.old_start_date,
          newStartDate: u.start_date,
          dependencies,
        })

        await applyManualShiftDependencyAdjustments(supabase, adjustments)
      }
    }

    await runScheduleApplyPipeline(supabase, jobId)

    revalidatePath('/schedule')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Save failed' }
  }
}