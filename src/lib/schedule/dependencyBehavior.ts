import type { ScheduleItemDependency } from '@/lib/db'

export type DependencyAdjustment = {
  dependencyId: string
  newLagDays: number
}

function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function diffInDays(a: string, b: string): number {
  const d1 = parseDateLocal(a)
  const d2 = parseDateLocal(b)
  const ms = d2.getTime() - d1.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

/**
 * When a user moves item A without shifting dependencies,
 * we convert that manual movement into updated lag values.
 *
 * This preserves graph consistency WITHOUT cascading changes.
 */
export function computeDependencyAdjustmentsForManualShift(params: {
  movedItemId: string
  oldStartDate: string | null
  newStartDate: string | null
  dependencies: ScheduleItemDependency[]
}): DependencyAdjustment[] {
  const { movedItemId, oldStartDate, newStartDate, dependencies } = params

  if (!oldStartDate || !newStartDate) return []

  const shiftDays = diffInDays(oldStartDate, newStartDate)
  if (shiftDays === 0) return []

  const adjustments: DependencyAdjustment[] = []

  for (const dep of dependencies) {
    // Case 1: moved item is successor (A depends on something)
    if (dep.successor_schedule_id === movedItemId) {
      adjustments.push({
        dependencyId: dep.id,
        newLagDays: (dep.lag_days ?? 0) + shiftDays,
      })
    }

    // Case 2: moved item is predecessor (others depend on A)
    if (dep.predecessor_schedule_id === movedItemId) {
      adjustments.push({
        dependencyId: dep.id,
        newLagDays: (dep.lag_days ?? 0) - shiftDays,
      })
    }
  }

  return adjustments
}