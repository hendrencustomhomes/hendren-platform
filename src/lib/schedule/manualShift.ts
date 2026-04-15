import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScheduleItemDependency } from '@/lib/db'

export type ManualShiftDependencyAdjustment = {
  dependencyId: string
  newOffsetWorkingDays: number
}

function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isMonFri(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

function diffInWorkingDays(oldDate: string, newDate: string): number {
  const oldD = parseDateLocal(oldDate)
  const newD = parseDateLocal(newDate)

  if (oldD.getTime() === newD.getTime()) return 0

  const forward = newD > oldD
  let current = new Date(oldD)
  let count = 0

  while (current.getTime() !== newD.getTime()) {
    current.setDate(current.getDate() + (forward ? 1 : -1))
    if (isMonFri(current)) {
      count += forward ? 1 : -1
    }
  }

  return count
}

export function computeManualShiftDependencyAdjustments(params: {
  movedItemId: string
  oldStartDate: string | null
  newStartDate: string | null
  dependencies: ScheduleItemDependency[]
}): ManualShiftDependencyAdjustment[] {
  const { movedItemId, oldStartDate, newStartDate, dependencies } = params

  if (!oldStartDate || !newStartDate) return []

  const shiftDays = diffInWorkingDays(oldStartDate, newStartDate)
  if (shiftDays === 0) return []

  const adjustments: ManualShiftDependencyAdjustment[] = []

  for (const dep of dependencies) {
    if (
      dep.successor_type === 'schedule' &&
      dep.successor_id === movedItemId
    ) {
      adjustments.push({
        dependencyId: dep.id,
        newOffsetWorkingDays: dep.offset_working_days + shiftDays,
      })
      continue
    }

    if (
      dep.predecessor_type === 'schedule' &&
      dep.predecessor_id === movedItemId
    ) {
      adjustments.push({
        dependencyId: dep.id,
        newOffsetWorkingDays: dep.offset_working_days - shiftDays,
      })
    }
  }

  return adjustments
}

export async function applyManualShiftDependencyAdjustments(
  supabase: SupabaseClient,
  adjustments: ManualShiftDependencyAdjustment[]
): Promise<string[]> {
  const updatedDependencyIds: string[] = []

  for (const adj of adjustments) {
    const { error } = await supabase
      .from('schedule_item_dependencies')
      .update({ offset_working_days: adj.newOffsetWorkingDays })
      .eq('id', adj.dependencyId)

    if (error) throw error
    updatedDependencyIds.push(adj.dependencyId)
  }

  return updatedDependencyIds
}