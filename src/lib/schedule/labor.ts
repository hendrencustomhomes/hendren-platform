import { workingDayAdd, workingDayDiff } from './engine'
import type { WeekendFlags } from './engine'

export type { WeekendFlags }

export function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDateToISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function normalizeFromStartAndEnd(
  start: Date,
  end: Date,
  flags: WeekendFlags
): { durationWorkingDays: number } {
  return { durationWorkingDays: workingDayDiff(start, end, flags) }
}

export function normalizeFromStartAndDuration(
  start: Date,
  duration: number,
  flags: WeekendFlags
): { endDate: Date } {
  return { endDate: workingDayAdd(start, duration, flags) }
}

export function applyWeekendInference(
  start: Date,
  flags: WeekendFlags
): WeekendFlags {
  const day = start.getDay()
  return {
    includeSaturday: day === 6 ? true : flags.includeSaturday,
    includeSunday: day === 0 ? true : flags.includeSunday,
  }
}
