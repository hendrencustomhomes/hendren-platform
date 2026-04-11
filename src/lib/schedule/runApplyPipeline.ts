import type { SupabaseClient } from '@supabase/supabase-js'
import { getResolvedScheduleGraph } from './resolver'
import { detectConfirmedStartShiftImpacts } from './impacts'
import { applyResolvedScheduleGraph } from './apply'
import { createScheduleTriggeredCallTasks } from './taskTriggers'
import type { ResolvedScheduleGraph } from './resolver'
import type { ConfirmedStartShiftImpact } from './impacts'
import type { ApplyResolvedScheduleResult } from './apply'
import type { CreateScheduleTriggeredTasksResult } from './taskTriggers'

export type RunScheduleApplyPipelineResult = {
  graph: ResolvedScheduleGraph
  impacts: ConfirmedStartShiftImpact[]
  applyResult: ApplyResolvedScheduleResult
  taskResult: CreateScheduleTriggeredTasksResult
}

export async function runScheduleApplyPipeline(
  supabase: SupabaseClient,
  jobId: string
): Promise<RunScheduleApplyPipelineResult> {
  // Step A — resolve graph from DB
  const graph = await getResolvedScheduleGraph(supabase, jobId)

  // Step B — detect confirmed start-shift impacts before any mutation
  const impacts = detectConfirmedStartShiftImpacts(graph)

  // Step C — persist resolved dates
  const applyResult = await applyResolvedScheduleGraph(supabase, graph)

  // Step D — create triggered call tasks (runs even when impacts is empty)
  const taskResult = await createScheduleTriggeredCallTasks(supabase, impacts)

  return { graph, impacts, applyResult, taskResult }
}
