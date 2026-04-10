export type WeekendFlags = {
  includeSaturday: boolean
  includeSunday: boolean
}

export type Dependency = {
  predecessorType: 'schedule' | 'procurement'
  predecessorId: string
  successorType: 'schedule' | 'procurement'
  successorId: string
  referencePoint: 'start' | 'end'
  offsetWorkingDays: number
}

function isWorkingDay(date: Date, flags: WeekendFlags): boolean {
  const day = date.getDay() // 0 = Sunday, 6 = Saturday

  if (day === 0 && !flags.includeSunday) return false
  if (day === 6 && !flags.includeSaturday) return false

  return true
}

export function workingDayAdd(
  start: Date,
  duration: number,
  flags: WeekendFlags
): Date {
  if (duration < 1) {
    throw new Error('duration must be >= 1')
  }

  let current = new Date(start)
  let daysAdded = 0

  while (true) {
    if (isWorkingDay(current, flags)) {
      daysAdded++
      if (daysAdded === duration) {
        return new Date(current)
      }
    }

    current = new Date(current)
    current.setDate(current.getDate() + 1)
  }
}

export function workingDayDiff(
  start: Date,
  end: Date,
  flags: WeekendFlags
): number {
  if (end < start) {
    throw new Error('end date cannot be before start date')
  }

  let current = new Date(start)
  let count = 0

  while (current <= end) {
    if (isWorkingDay(current, flags)) {
      count++
    }

    current = new Date(current)
    current.setDate(current.getDate() + 1)
  }

  return count
}

export function resolveScheduleForJob(jobId: string) {
  // TODO: will be implemented after data layer is wired
  return {
    items: [],
    dependencies: []
  }
}
