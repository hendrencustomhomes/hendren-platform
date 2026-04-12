'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { runScheduleApplyPipeline } from '@/lib/schedule/runApplyPipeline'
import { setJobBaseline } from '@/lib/schedule/baseline'
import { resetBaselineForItemIfMisEntry } from '@/lib/schedule/baselineReset'
import { createLinkedLog } from '@/lib/logs'

export type DraftScheduleItemUpdate = {
  id: string
  start_date: string | null
  duration_working_days: number | null
  include_saturday: boolean
  include_sunday: boolean
  buffer_working_days: number
  shift_reason_type: string | null
  shift_reason_note: string | null
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
      error: err instanceof Error ? err.message : 'Baseline activation failed',
    }
  }
}

export async function saveScheduleDraftAction(
  jobId: string,
  updates: DraftScheduleItemUpdate[]
): Promise<SaveDraftActionResult> {
  const supabase = await createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // STEP 1 — fetch original rows (for diff + logging)
    const ids = updates.map((u) => u.id)

    const { data: originalRows, error: fetchError } = await supabase
      .from('sub_schedule')
      .select(
        'id, start_date, duration_working_days, include_saturday, include_sunday, buffer_working_days'
      )
      .in('id', ids)

    if (fetchError) throw fetchError

    const originalMap = new Map(
      (originalRows ?? []).map((r) => [r.id, r])
    )

    // STEP 2 — write updates + baseline reset
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

      await resetBaselineForItemIfMisEntry(
        supabase,
        u.id,
        u.shift_reason_type
      )
    }

    // STEP 3 — create logs (before pipeline mutates anything)
    for (const u of updates) {
      const original = originalMap.get(u.id)
      if (!original) continue

      const changes: string[] = []

      if (original.start_date !== u.start_date) {
        changes.push(
          `Start: ${original.start_date ?? '—'} → ${u.start_date ?? '—'}`
        )
      }

      if (original.duration_working_days !== u.duration_working_days) {
        changes.push(
          `Duration: ${original.duration_working_days ?? '—'} → ${
            u.duration_working_days ?? '—'
          }`
        )
      }

      if (original.include_saturday !== u.include_saturday) {
        changes.push(
          `Sat: ${original.include_saturday ? 'Yes' : 'No'} → ${
            u.include_saturday ? 'Yes' : 'No'
          }`
        )
      }

      if (original.include_sunday !== u.include_sunday) {
        changes.push(
          `Sun: ${original.include_sunday ? 'Yes' : 'No'} → ${
            u.include_sunday ? 'Yes' : 'No'
          }`
        )
      }

      if (original.buffer_working_days !== u.buffer_working_days) {
        changes.push(
          `Buffer: ${original.buffer_working_days ?? '—'} → ${
            u.buffer_working_days ?? '—'
          }`
        )
      }

      // Skip logging if nothing meaningful changed
      if (changes.length === 0 && !u.shift_reason_type && !u.shift_reason_note) {
        continue
      }

      const reasonParts: string[] = []

      if (u.shift_reason_type) {
        reasonParts.push(`Reason: ${u.shift_reason_type}`)
      }

      if (u.shift_reason_note) {
        reasonParts.push(`Note: ${u.shift_reason_note}`)
      }

      const note = [
        changes.length > 0 ? changes.join(' | ') : null,
        reasonParts.length > 0 ? reasonParts.join(' | ') : null,
      ]
        .filter(Boolean)
        .join('\n')

      await createLinkedLog(supabase, {
        ownerType: 'schedule_item',
        ownerId: u.id,
        jobId,
        logType: 'schedule_change',
        note: note || null,
        createdBy: user?.id ?? null,
      })
    }

    // STEP 4 — run pipeline
    await runScheduleApplyPipeline(supabase, jobId)

    revalidatePath('/schedule')
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Save failed',
    }
  }
}