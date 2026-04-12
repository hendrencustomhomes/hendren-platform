import type { ScheduleItemDependency } from '@/lib/db'

export type DependencyAdjustment = {
  dependencyId: string
  newLagDays: number
}

function diffDaysISO(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)

  const d1 = new Date(ay, am - 1, ad)
  const d2 = new Date(by, bm - 1, bd)

  const ms = d2.getTime() - d1.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

export function computeDependencyAdjustmentsForManualShift(params: {
  movedItemId: string
  oldStartDate: string | null
  newStartDate: string | null
  dependencies: ScheduleItemDependency[]
}): DependencyAdjustment[] {
  const { movedItemId, oldStartDate, newStartDate, dependencies } = params

  // Guards
  if (!oldStartDate || !newStartDate) return []
  if (oldStartDate === newStartDate) return []
  if (!dependencies.length) return []

  const shiftDays = diffDaysISO(oldStartDate, newStartDate)

  if (shiftDays === 0) return []

  const adjustments: DependencyAdjustment[] = []

  for (const dep of dependencies) {
    const currentLag = dep.lag_days ?? 0

    // Case 1 — moved item is successor
    if (dep.successor_schedule_id === movedItemId) {
      const newLag = currentLag + shiftDays

      if (newLag !== currentLag) {
        adjustments.push({
          dependencyId: dep.id,
          newLagDays: newLag,
        })
      }
    }

    // Case 2 — moved item is predecessor
    if (dep.predecessor_schedule_id === movedItemId) {
      const newLag = currentLag - shiftDays

      if (newLag !== currentLag) {
        adjustments.push({
          dependencyId: dep.id,
          newLagDays: newLag,
        })
      }
    }
  }

  return adjustments
}