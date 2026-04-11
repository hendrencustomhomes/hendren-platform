import type { ScheduleNode } from './nodes'
import type { ScheduleItemDependency } from '@/lib/db'

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

function parseDateISO(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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

function applyWorkingDayOffset(base: Date, offset: number): Date {
  if (offset === 0) return new Date(base)

  const monFri: WeekendFlags = { includeSaturday: false, includeSunday: false }
  const current = new Date(base)
  const step = offset > 0 ? 1 : -1
  let remaining = Math.abs(offset)

  while (remaining > 0) {
    current.setDate(current.getDate() + step)
    if (isWorkingDay(current, monFri)) {
      remaining--
    }
  }

  return new Date(current)
}

function topologicalSort(
  nodes: Record<string, ScheduleNode>,
  dependencies: ScheduleItemDependency[]
): string[] {
  const allKeys = Object.keys(nodes)

  const inDegree: Record<string, number> = {}
  const successors: Record<string, string[]> = {}

  for (const key of allKeys) {
    inDegree[key] = 0
    successors[key] = []
  }

  for (const dep of dependencies) {
    const predKey = `${dep.predecessor_type}:${dep.predecessor_id}`
    const succKey = `${dep.successor_type}:${dep.successor_id}`

    // Skip edges referencing nodes not in this graph
    if (!(predKey in inDegree) || !(succKey in inDegree)) continue

    successors[predKey].push(succKey)
    inDegree[succKey]++
  }

  // Kahn's algorithm: start with all zero-in-degree nodes
  const queue: string[] = allKeys.filter((k) => inDegree[k] === 0)
  const sorted: string[] = []

  while (queue.length > 0) {
    const node = queue.shift()!
    sorted.push(node)

    for (const succ of successors[node]) {
      inDegree[succ]--
      if (inDegree[succ] === 0) {
        queue.push(succ)
      }
    }
  }

  if (sorted.length !== allKeys.length) {
    throw new Error('Cycle detected in schedule dependency graph')
  }

  return sorted
}

export function resolveScheduleGraph(input: {
  nodes: Record<string, ScheduleNode>
  dependencies: ScheduleItemDependency[]
}): Record<string, ScheduleNode> {
  const { nodes, dependencies } = input

  // Build predecessors map: successor key → all dependencies targeting it
  const predecessorsMap: Record<string, ScheduleItemDependency[]> = {}
  for (const dep of dependencies) {
    const succKey = `${dep.successor_type}:${dep.successor_id}`
    if (!predecessorsMap[succKey]) {
      predecessorsMap[succKey] = []
    }
    predecessorsMap[succKey].push(dep)
  }

  const order = topologicalSort(nodes, dependencies)

  // Shallow-copy input so we never mutate the caller's map
  const resolvedNodes: Record<string, ScheduleNode> = { ...nodes }

  for (const key of order) {
    const node = resolvedNodes[key]
    const deps = predecessorsMap[key] ?? []

    // Step 2: no dependencies — leave unchanged
    if (deps.length === 0) continue

    // Step 3 & 4: compute candidate dates from each predecessor
    const candidates: Date[] = []

    for (const dep of deps) {
      const predKey = `${dep.predecessor_type}:${dep.predecessor_id}`
      const predecessor = resolvedNodes[predKey]
      if (!predecessor) continue

      const baseStr =
        dep.reference_point === 'start'
          ? predecessor.start_date
          : predecessor.end_date

      if (!baseStr) continue

      const candidate = applyWorkingDayOffset(parseDateISO(baseStr), dep.offset_working_days)
      candidates.push(candidate)
    }

    // Step 5: if no valid candidates, leave unchanged
    if (candidates.length === 0) continue

    // start_date = MAX(candidates)
    const maxCandidate = candidates.reduce((max, d) => (d > max ? d : max))
    const newStartDate = formatDateISO(maxCandidate)

    // Step 6: recompute end_date from duration if available
    let newEndDate: string | null = node.end_date
    const duration = node.duration_working_days

    if (duration != null && duration >= 1) {
      const flags: WeekendFlags = {
        includeSaturday: node.include_saturday,
        includeSunday: node.include_sunday,
      }
      newEndDate = formatDateISO(workingDayAdd(maxCandidate, duration, flags))
    }

    resolvedNodes[key] = {
      ...node,
      start_date: newStartDate,
      end_date: newEndDate,
    }
  }

  return resolvedNodes
}

export function resolveScheduleForJob(jobId: string) {
  // TODO: will be implemented after data layer is wired
  return {
    items: [],
    dependencies: []
  }
}
