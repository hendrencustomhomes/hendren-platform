import type { SupabaseClient } from '@supabase/supabase-js'

export type JobBaseline = {
  id: string
  job_id: string
  created_at: string
  created_by: string | null
}

export type SetJobBaselineResult = {
  baseline: JobBaseline
  updatedScheduleIds: string[]
}

export async function getJobBaseline(
  supabase: SupabaseClient,
  jobId: string
): Promise<JobBaseline | null> {
  const { data, error } = await supabase
    .from('job_baselines')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle()

  if (error) throw error
  return (data as JobBaseline) ?? null
}

export async function setJobBaseline(
  supabase: SupabaseClient,
  jobId: string,
  createdBy: string | null
): Promise<SetJobBaselineResult> {
  // Step A — guard: throw if baseline already active
  const existing = await getJobBaseline(supabase, jobId)
  if (existing) {
    throw new Error('Baseline already active for this job')
  }

  // Step B — insert baseline record
  const insertPayload: Record<string, unknown> = { job_id: jobId }
  if (createdBy !== null) {
    insertPayload.created_by = createdBy
  }

  const { data: baselineRow, error: insertError } = await supabase
    .from('job_baselines')
    .insert(insertPayload)
    .select('*')
    .single()

  if (insertError) throw insertError

  const baseline = baselineRow as JobBaseline

  // Step C — fetch all sub_schedule rows for the job
  const { data: scheduleRows, error: fetchError } = await supabase
    .from('sub_schedule')
    .select('id, start_date, end_date, baseline_start_date, baseline_end_date')
    .eq('job_id', jobId)

  if (fetchError) throw fetchError

  const rows = (scheduleRows ?? []) as {
    id: string
    start_date: string | null
    end_date: string | null
    baseline_start_date: string | null
    baseline_end_date: string | null
  }[]

  // Step D — snapshot missing baseline fields from current dates
  const updatedScheduleIds: string[] = []

  for (const row of rows) {
    const needsStart = row.baseline_start_date === null
    const needsEnd = row.baseline_end_date === null

    if (!needsStart && !needsEnd) continue

    const patch: Record<string, unknown> = {}
    if (needsStart) patch.baseline_start_date = row.start_date
    if (needsEnd) patch.baseline_end_date = row.end_date

    const { error: updateError } = await supabase
      .from('sub_schedule')
      .update(patch)
      .eq('id', row.id)

    if (updateError) throw updateError

    updatedScheduleIds.push(row.id)
  }

  // Step E — return
  return { baseline, updatedScheduleIds }
}
