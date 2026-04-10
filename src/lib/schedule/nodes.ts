import type { JobSubSchedule, ProcurementItem } from '@/lib/db'

export type ScheduleNodeType = 'schedule' | 'procurement'

export type ScheduleNode = {
  key: string
  id: string
  type: ScheduleNodeType
  start_date: string | null
  end_date: string | null
  duration_working_days: number | null
  include_saturday: boolean
  include_sunday: boolean
  lead_days: number | null
  buffer_working_days: number
}

function makeScheduleNodeKey(type: ScheduleNodeType, id: string): string {
  return `${type}:${id}`
}

export function buildScheduleNodes(input: {
  subSchedule: JobSubSchedule[]
  procurementItems: ProcurementItem[]
}): Record<string, ScheduleNode> {
  const nodes: Record<string, ScheduleNode> = {}

  for (const row of input.subSchedule) {
    const key = makeScheduleNodeKey('schedule', row.id)
    nodes[key] = {
      key,
      id: row.id,
      type: 'schedule',
      start_date: row.start_date,
      end_date: row.end_date,
      duration_working_days: row.duration_working_days ?? null,
      include_saturday: row.include_saturday,
      include_sunday: row.include_sunday,
      lead_days: null,
      buffer_working_days: row.buffer_working_days,
    }
  }

  for (const row of input.procurementItems) {
    const key = makeScheduleNodeKey('procurement', row.id)
    nodes[key] = {
      key,
      id: row.id,
      type: 'procurement',
      start_date: row.required_on_site_date,
      end_date: row.required_on_site_date,
      duration_working_days: 1,
      include_saturday: false,
      include_sunday: false,
      lead_days: row.lead_days,
      buffer_working_days: row.buffer_working_days,
    }
  }

  return nodes
}
