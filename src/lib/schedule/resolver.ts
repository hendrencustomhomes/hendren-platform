import type { SupabaseClient } from '@supabase/supabase-js'
import type { JobWithDetails, ScheduleItemDependency } from '@/lib/db'
import type { ScheduleNode } from './nodes'
import { getJobWithDetails, getScheduleDependencies } from '@/lib/db'
import { buildScheduleNodes } from './nodes'
import { resolveScheduleGraph } from './engine'

export type ResolvedScheduleGraph = {
  job: JobWithDetails
  dependencies: ScheduleItemDependency[]
  nodes: Record<string, ScheduleNode>
  resolvedNodes: Record<string, ScheduleNode>
}

export async function getResolvedScheduleGraph(
  supabase: SupabaseClient,
  jobId: string
): Promise<ResolvedScheduleGraph> {
  const job = await getJobWithDetails(supabase, jobId)
  const dependencies = await getScheduleDependencies(supabase, jobId)

  const nodes = buildScheduleNodes({
    subSchedule: job.sub_schedule,
    procurementItems: job.procurement_items,
  })

  const resolvedNodes = resolveScheduleGraph({ nodes, dependencies })

  return { job, dependencies, nodes, resolvedNodes }
}
