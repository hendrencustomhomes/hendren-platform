import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConfirmedStartShiftImpact } from './impacts'

export type CreateScheduleTriggeredTasksResult = {
  createdTaskIds: string[]
  skippedExistingImpactScheduleIds: string[]
}

const CALL_TASK_TYPE = 'call_task'
const DEFAULT_TASK_STATUS = 'open'

function isOpenTaskStatus(status: string | null | undefined): boolean {
  if (status == null) return true
  const lower = status.toLowerCase()
  return !['complete', 'completed', 'closed', 'cancelled'].includes(lower)
}

function buildCallTaskTitle(companyName: string | null): string {
  const trimmed = companyName?.trim()
  return trimmed ? `Call ${trimmed}` : 'Call company'
}

export async function createScheduleTriggeredCallTasks(
  supabase: SupabaseClient,
  impacts: ConfirmedStartShiftImpact[]
): Promise<CreateScheduleTriggeredTasksResult> {
  if (impacts.length === 0) {
    return { createdTaskIds: [], skippedExistingImpactScheduleIds: [] }
  }

  const createdTaskIds: string[] = []
  const skippedExistingImpactScheduleIds: string[] = []

  for (const impact of impacts) {
    // Step B — check for an existing open matching task
    const { data: existing, error: queryError } = await supabase
      .from('job_tasks')
      .select('id, status')
      .eq('job_id', impact.jobId)
      .eq('linked_schedule_id', impact.scheduleId)
      .eq('task_type', CALL_TASK_TYPE)

    if (queryError) throw queryError

    const hasOpenTask = (existing ?? []).some((t: { status: string | null }) =>
      isOpenTaskStatus(t.status)
    )

    // Step C — skip if open task already exists
    if (hasOpenTask) {
      skippedExistingImpactScheduleIds.push(impact.scheduleId)
      continue
    }

    // Step D — create new task
    const title = buildCallTaskTitle(impact.companyName)
    const description =
      `Confirmed start date shifted: ${impact.oldStartDate ?? '—'} → ${impact.newStartDate ?? '—'}`

    const payload: Record<string, unknown> = {
      job_id: impact.jobId,
      linked_schedule_id: impact.scheduleId,
      task_type: CALL_TASK_TYPE,
      status: DEFAULT_TASK_STATUS,
      title,
      description,
    }

    if (impact.pmId !== null) {
      payload.assignee_profile_id = impact.pmId
    }

    const { data: created, error: insertError } = await supabase
      .from('job_tasks')
      .insert(payload)
      .select('id')
      .single()

    if (insertError) throw insertError
    if (created) createdTaskIds.push((created as { id: string }).id)
  }

  return { createdTaskIds, skippedExistingImpactScheduleIds }
}
