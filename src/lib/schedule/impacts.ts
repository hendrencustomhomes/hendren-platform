import type { ResolvedScheduleGraph } from './resolver'
import type { JobSubSchedule } from '@/lib/db'

export type ConfirmedStartShiftImpact = {
  scheduleId: string
  jobId: string
  companyName: string | null
  oldStartDate: string | null
  newStartDate: string | null
  oldEndDate: string | null
  newEndDate: string | null
  pmId: string | null
}

function isConfirmedScheduleItem(item: JobSubSchedule): boolean {
  return item.status === 'confirmed'
}

export function detectConfirmedStartShiftImpacts(
  graph: ResolvedScheduleGraph
): ConfirmedStartShiftImpact[] {
  const impacts: ConfirmedStartShiftImpact[] = []

  for (const item of graph.job.sub_schedule) {
    // Step B — skip if not confirmed or no resolved node
    if (!isConfirmedScheduleItem(item)) continue

    const resolved = graph.resolvedNodes[`schedule:${item.id}`]
    if (!resolved) continue

    // Step C — only start_date change triggers an impact
    if (item.start_date === resolved.start_date) continue

    // Step D — build impact record
    impacts.push({
      scheduleId: item.id,
      jobId: graph.job.id as string,
      companyName: item.sub_name,
      oldStartDate: item.start_date,
      newStartDate: resolved.start_date,
      oldEndDate: item.end_date,
      newEndDate: resolved.end_date,
      pmId: (graph.job.pm_id as string | null | undefined) ?? null,
    })
  }

  return impacts
}

export function hasConfirmedStartShiftImpacts(
  graph: ResolvedScheduleGraph
): boolean {
  return detectConfirmedStartShiftImpacts(graph).length > 0
}
