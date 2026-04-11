# Schedule Module — R5 Deliverables

**Date:** 2026-04-10
**Branch:** `dev`
**Files changed:**
- `src/lib/schedule/engine.ts` (imports + new functions; all existing exports preserved)

---

## A. Full Updated `engine.ts`

```typescript
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
  const day = date.getDay()
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

export function workingDayAdd(start, duration, flags): Date { /* unchanged */ }
export function workingDayDiff(start, end, flags): number { /* unchanged */ }

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
    if (!(predKey in inDegree) || !(succKey in inDegree)) continue
    successors[predKey].push(succKey)
    inDegree[succKey]++
  }

  const queue: string[] = allKeys.filter((k) => inDegree[k] === 0)
  const sorted: string[] = []

  while (queue.length > 0) {
    const node = queue.shift()!
    sorted.push(node)
    for (const succ of successors[node]) {
      inDegree[succ]--
      if (inDegree[succ] === 0) queue.push(succ)
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

  const predecessorsMap: Record<string, ScheduleItemDependency[]> = {}
  for (const dep of dependencies) {
    const succKey = `${dep.successor_type}:${dep.successor_id}`
    if (!predecessorsMap[succKey]) predecessorsMap[succKey] = []
    predecessorsMap[succKey].push(dep)
  }

  const order = topologicalSort(nodes, dependencies)
  const resolvedNodes: Record<string, ScheduleNode> = { ...nodes }

  for (const key of order) {
    const node = resolvedNodes[key]
    const deps = predecessorsMap[key] ?? []

    if (deps.length === 0) continue

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

    if (candidates.length === 0) continue

    const maxCandidate = candidates.reduce((max, d) => (d > max ? d : max))
    const newStartDate = formatDateISO(maxCandidate)

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
  return { items: [], dependencies: [] }
}
```

---

## B. Topological Sort Approach

**Algorithm:** Kahn's algorithm (BFS-based).

**Why Kahn's over DFS:**
- Produces a deterministic left-to-right queue order, not recursion-stack order
- Cycle detection is a natural byproduct: if `sorted.length !== allKeys.length` after the queue drains, at least one node was never enqueued because its in-degree never reached zero — which can only happen in a cycle
- No recursion stack overflow risk for large graphs
- Easier to reason about in a CI/audit context

**Steps:**
1. Initialize `inDegree[key] = 0` and `successors[key] = []` for every node key
2. Walk every dependency: increment `inDegree[succKey]`, append to `successors[predKey]`
3. Seed the queue with all keys where `inDegree === 0` (roots — no predecessors)
4. Dequeue a node, append to `sorted`, decrement in-degree of each successor; if a successor hits 0, enqueue it
5. When queue is empty: if `sorted.length < allKeys.length`, a cycle exists → throw

**Cross-graph dependencies (dangling edges):** If a dependency references a node key not present in the `nodes` map, the edge is silently skipped in both the sort and the resolution loop. This is intentional — the engine only resolves what it can see.

---

## C. Offset Handling (Including Negative)

**`applyWorkingDayOffset(base, offset)`** uses Mon–Fri only (no `WeekendFlags` parameter; `includeSaturday: false, includeSunday: false` is hardcoded internally).

**Zero offset:** returns `new Date(base)` immediately — no movement, no day-of-week snapping. A predecessor that ends on a Saturday with `offset = 0` yields Saturday as the candidate. This is intentional: the engine does not normalize base dates to working days before applying the offset. Normalization is a separate concern that can be added later if needed.

**Positive offset (`offset > 0`):** steps forward day-by-day from `base`, counting only Mon–Fri days, stopping when `remaining` hits zero. Example: Friday + 2 = Tuesday (skip Sat, skip Sun, Mon = 1, Tue = 2).

**Negative offset (`offset < 0`):** steps backward day-by-day from `base`, counting only Mon–Fri days. The direction is controlled by `step = -1`. Example: Monday − 2 = Thursday (step to Sun, skip; step to Sat, skip; step to Fri = 1; step to Thu = 2).

**Why not reuse `workingDayAdd`:**
`workingDayAdd` counts the start date as day 1 (inclusive of start) and requires `duration >= 1`. `applyWorkingDayOffset` treats the base as day 0 (offset = 0 means same day), supports offset = 0, and supports negative values. These are fundamentally different semantics.

---

## D. Assumptions Made

1. **`offset = 0` means same-day, not "next working day."** A successor with offset = 0 from a predecessor's end date starts on the same calendar date as that end date, even if that date is a weekend. This is the least surprising behavior for scheduling tools and can be overridden by setting offset = 1 if the intent is "start the next working day after predecessor ends."

2. **`resolveScheduleForJob` stub preserved unchanged.** The spec said to not remove existing exports. The stub is kept; it will be replaced in a future round when the data layer fetch is wired into the engine.

3. **`parseDateISO` and `formatDateISO` are private to `engine.ts`.** `labor.ts` already exports equivalent `parseDateLocal` / `formatDateToISO`. They are not imported here because `labor.ts` imports from `engine.ts` — importing in the reverse direction would create a circular dependency. The two implementations are byte-for-byte identical in behavior.

4. **Shallow copy of `nodes` is sufficient.** `resolvedNodes = { ...nodes }` copies the top-level key→object references. Individual node objects are only replaced (never mutated in place) via `resolvedNodes[key] = { ...node, ... }`. The caller's original map is never touched.

5. **`MAX` of candidates, not `MIN`.** When multiple predecessors constrain a successor, the latest candidate date wins. This models the constraint that all predecessors must be complete before the successor can start — the binding constraint is the last one to finish.

---

## E. Edge Cases Identified But Not Handled

1. **`offset = 0` on a weekend base.** If a predecessor's reference date falls on a Saturday or Sunday (possible when `include_saturday/sunday` is true for that node), `offset = 0` returns that weekend date as the candidate. The successor would then start on a weekend. The engine does not snap to the next working day. Left unhandled intentionally — snapping behavior needs a product decision before being encoded.

2. **Duplicate dependency edges.** If `dependencies` contains two rows with the same `predecessor_id`, `successor_id`, and `reference_point`, both are processed independently. The MAX logic naturally resolves this, but the in-degree counter in the topological sort will count each edge separately, which is correct for Kahn's algorithm.

3. **Buffer working days not applied.** `ScheduleNode.buffer_working_days` is present in the type and loaded into nodes but is not used in this round. Adding buffer to the resolved end date (or subtracting it for procurement lead-time) is explicitly deferred per spec.

4. **Procurement `lead_days` not applied.** `ScheduleNode.lead_days` is populated for procurement nodes but not used in resolution. Deferred per spec.

5. **Nodes with `duration_working_days = null` and dependencies.** If a node has dependencies (its start_date gets pushed forward) but no stored duration, `end_date` is left at whatever was in the original node. If the original `end_date` was derived from the old `start_date`, it will now be stale. Callers should treat `end_date` as advisory until duration is stored.

6. **Self-referencing dependency (`predecessor_id === successor_id`).** Would create an in-degree that can never reach zero. The cycle check catches this and throws. No special-case handling needed.
