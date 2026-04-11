import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScheduleItemDependency } from '@/lib/db'
import { getJobWithDetails } from '@/lib/db'
import { buildScheduleNodes } from './nodes'

export type DependencyNodeRef = {
  type: 'schedule' | 'procurement'
  id: string
}

export type DependencyWriteInput = {
  predecessor: DependencyNodeRef
  successor: DependencyNodeRef
  referencePoint: 'start' | 'end'
  offsetWorkingDays: number
}

function makeDependencyNodeKey(ref: DependencyNodeRef): string {
  return `${ref.type}:${ref.id}`
}

async function getValidJobNodeKeys(
  supabase: SupabaseClient,
  jobId: string
): Promise<Set<string>> {
  const job = await getJobWithDetails(supabase, jobId)
  const nodes = buildScheduleNodes({
    subSchedule: job.sub_schedule,
    procurementItems: job.procurement_items,
  })
  return new Set(Object.keys(nodes))
}

function validateDependencyInput(
  input: DependencyWriteInput,
  validKeys: Set<string>
): void {
  const predKey = makeDependencyNodeKey(input.predecessor)
  const succKey = makeDependencyNodeKey(input.successor)

  if (predKey === succKey) {
    throw new Error(
      'Invalid dependency: predecessor and successor cannot be the same node'
    )
  }
  if (!validKeys.has(predKey)) {
    throw new Error('Invalid dependency: predecessor node not found on job')
  }
  if (!validKeys.has(succKey)) {
    throw new Error('Invalid dependency: successor node not found on job')
  }
}

function buildDependencyRow(jobId: string, input: DependencyWriteInput) {
  return {
    job_id: jobId,
    predecessor_type: input.predecessor.type,
    predecessor_id: input.predecessor.id,
    successor_type: input.successor.type,
    successor_id: input.successor.id,
    reference_point: input.referencePoint,
    offset_working_days: input.offsetWorkingDays,
  }
}

export async function createScheduleDependencies(
  supabase: SupabaseClient,
  jobId: string,
  inputs: DependencyWriteInput[]
): Promise<ScheduleItemDependency[]> {
  if (inputs.length === 0) return []

  const validKeys = await getValidJobNodeKeys(supabase, jobId)

  for (const input of inputs) {
    validateDependencyInput(input, validKeys)
  }

  const rows = inputs.map((input) => buildDependencyRow(jobId, input))

  const { data, error } = await supabase
    .from('schedule_item_dependencies')
    .insert(rows)
    .select()

  if (error) throw error
  return (data ?? []) as ScheduleItemDependency[]
}

export async function deleteScheduleDependenciesForJob(
  supabase: SupabaseClient,
  jobId: string
): Promise<void> {
  const { error } = await supabase
    .from('schedule_item_dependencies')
    .delete()
    .eq('job_id', jobId)

  if (error) throw error
}

export async function replaceScheduleDependenciesForJob(
  supabase: SupabaseClient,
  jobId: string,
  inputs: DependencyWriteInput[]
): Promise<ScheduleItemDependency[]> {
  if (inputs.length > 0) {
    const validKeys = await getValidJobNodeKeys(supabase, jobId)
    for (const input of inputs) {
      validateDependencyInput(input, validKeys)
    }
  }

  await deleteScheduleDependenciesForJob(supabase, jobId)

  if (inputs.length === 0) return []

  const rows = inputs.map((input) => buildDependencyRow(jobId, input))

  const { data, error } = await supabase
    .from('schedule_item_dependencies')
    .insert(rows)
    .select()

  if (error) throw error
  return (data ?? []) as ScheduleItemDependency[]
}
