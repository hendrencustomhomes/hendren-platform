import type { SupabaseClient } from '@supabase/supabase-js'
import type { ResolvedScheduleGraph } from './resolver'

export type ApplyResolvedScheduleResult = {
  updatedScheduleIds: string[]
  updatedProcurementIds: string[]
  skippedScheduleIds: string[]
  skippedProcurementIds: string[]
}

function laborChanged(
  storedStart: string | null,
  storedEnd: string | null,
  resolvedStart: string | null,
  resolvedEnd: string | null
): boolean {
  return storedStart !== resolvedStart || storedEnd !== resolvedEnd
}

export async function applyResolvedScheduleGraph(
  supabase: SupabaseClient,
  graph: ResolvedScheduleGraph
): Promise<ApplyResolvedScheduleResult> {
  const { job, resolvedNodes } = graph

  const updatedScheduleIds: string[] = []
  const skippedScheduleIds: string[] = []
  const updatedProcurementIds: string[] = []
  const skippedProcurementIds: string[] = []

  const updates: Promise<void>[] = []

  // Step A — labor schedule rows
  for (const item of job.sub_schedule) {
    const resolved = resolvedNodes[`schedule:${item.id}`]

    if (
      !resolved ||
      !laborChanged(item.start_date, item.end_date, resolved.start_date, resolved.end_date)
    ) {
      skippedScheduleIds.push(item.id)
      continue
    }

    updatedScheduleIds.push(item.id)
    updates.push(
      (async () => {
        const { error } = await supabase
          .from('sub_schedule')
          .update({ start_date: resolved.start_date, end_date: resolved.end_date })
          .eq('id', item.id)
        if (error) throw error
      })()
    )
  }

  // Step B — procurement rows
  for (const item of job.procurement_items) {
    const resolved = resolvedNodes[`procurement:${item.id}`]

    if (!resolved || item.required_on_site_date === resolved.start_date) {
      skippedProcurementIds.push(item.id)
      continue
    }

    updatedProcurementIds.push(item.id)
    updates.push(
      (async () => {
        const { error } = await supabase
          .from('procurement_items')
          .update({ required_on_site_date: resolved.start_date })
          .eq('id', item.id)
        if (error) throw error
      })()
    )
  }

  await Promise.all(updates)

  return {
    updatedScheduleIds,
    updatedProcurementIds,
    skippedScheduleIds,
    skippedProcurementIds,
  }
}
