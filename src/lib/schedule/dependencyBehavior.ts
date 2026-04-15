import type { ScheduleItemDependency } from '@/lib/db'

export type DependencyAdjustment = {
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

/**
 * When a user moves item A without shifting dependencies,
 * we preserve the graph by rewriting dependency offsets
 * instead of cascading date changes.
 */
export function computeDependencyAdjustmentsForManualShift(params: {
  movedItemId: string
  oldStartDate: string | null
  newStartDate: string | null
  dependencies: ScheduleItemDependency[]
}): DependencyAdjustment[] {
  const { movedItemId, oldStartDate, newStartDate, dependencies } = params

  if (!oldStartDate || !newStartDate) return []

  const shiftDays = diffInWorkingDays(oldStartDate, newStartDate)
  if (shiftDays === 0) return []

  const adjustments: DependencyAdjustment[] = []

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