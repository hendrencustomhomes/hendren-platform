# Schedule Module — R12 Deliverables

**Date:** 2026-04-11
**Branch:** `dev`
**Files changed:**
- `src/lib/schedule/impacts.ts` (new)

---

## A. Full Contents of `src/lib/schedule/impacts.ts`

```typescript
import type { ResolvedScheduleGraph } from './resolver'
import type { JobSubSchedule } from '@/lib/db'

export type ConfirmedStartShiftImpact = {
  scheduleId: string
  jobId: string
  companyName: string | null
  oldStartDate: string | null
  newStartDate: string | null
  oldEndDate: string | null
  newEndDate: string | null
  pmId: string | null
}

function isConfirmedScheduleItem(item: JobSubSchedule): boolean {
  return item.status === 'confirmed'
}

export function detectConfirmedStartShiftImpacts(
  graph: ResolvedScheduleGraph
): ConfirmedStartShiftImpact[] {
  const impacts: ConfirmedStartShiftImpact[] = []

  for (const item of graph.job.sub_schedule) {
    // Step B — skip if not confirmed or no resolved node
    if (!isConfirmedScheduleItem(item)) continue

    const resolved = graph.resolvedNodes[`schedule:${item.id}`]
    if (!resolved) continue

    // Step C — only start_date change triggers an impact
    if (item.start_date === resolved.start_date) continue

    // Step D — build impact record
    impacts.push({
      scheduleId: item.id,
      jobId: graph.job.id as string,
      companyName: item.sub_name,
      oldStartDate: item.start_date,
      newStartDate: resolved.start_date,
      oldEndDate: item.end_date,
      newEndDate: resolved.end_date,
      pmId: (graph.job.pm_id as string | null | undefined) ?? null,
    })
  }

  return impacts
}

export function hasConfirmedStartShiftImpacts(
  graph: ResolvedScheduleGraph
): boolean {
  return detectConfirmedStartShiftImpacts(graph).length > 0
}
```

---

## B. Explanation of Exact Impact Detection Rule

An impact is recorded for a labor schedule item if and only if **all three** of the following are true:

1. `item.status === 'confirmed'`
2. A resolved node exists at key `schedule:${item.id}` in `graph.resolvedNodes`
3. `item.start_date !== resolved.start_date` (strict string inequality)

Condition 1 is evaluated by `isConfirmedScheduleItem`. Conditions 2 and 3 are evaluated inline in the loop.

The comparison is strict `!==` on `string | null` values. Two `null` values are equal — a row with no start date whose resolver also produced no start date is not an impact. A stored `'2026-04-15'` against a resolved `'2026-04-15'` is not an impact. Only a genuine value change (including `null → string` or `string → null`) qualifies.

The function iterates `graph.job.sub_schedule` in its original order and preserves that order in the output array (Step E).

---

## C. Why End-Date-Only Changes Are Excluded

An end-date-only shift means the labor item will still begin on the same calendar day — the company or sub arrives at the same time. The start date is the scheduling commitment that was communicated to the sub. It is the date on which site access, crew arrival, and sequencing with other trades are coordinated.

An end-date change in isolation means the duration of the work block changed (e.g., `duration_working_days` was updated) but the mobilization date did not. That is a scope or labor-estimate change, not a schedule conflict. It does not require the PM to call the sub to renegotiate a start time.

Conversely, a start-date shift — even if end date stays the same — means the sub needs to arrive at a different time than they confirmed. That is the event that requires a PM action.

Including end-date-only changes as impacts would produce noise: every duration edit on a confirmed item would trigger a "Call the company" task even when the sub's arrival date is unchanged. The detection rule is scoped to what the product considers an actionable external communication trigger.

---

## D. Assumptions Made

1. **`graph.job.id` is safely castable to `string`.** `JobWithDetails` is typed as `Record<string, unknown>`, which makes `graph.job.id` of type `unknown`. The cast `graph.job.id as string` is safe because `getJobWithDetails` selects `*` from the `jobs` table and every row has a non-null `id` UUID. The cast is necessary to satisfy the `jobId: string` field of `ConfirmedStartShiftImpact`.

2. **`graph.job.pm_id` is castable to `string | null | undefined`.** `pm_id` is a nullable FK on the `jobs` table. It may be absent from the query result if not included in the select, or it may be `null` if no PM is assigned. The `?? null` fallback converts `undefined` to `null`, giving a consistent `string | null` output.

3. **`item.sub_name` is used directly as `companyName`.** `sub_name` is already `string | null` on `JobSubSchedule`. No lookup against the `companies` table is performed — the spec explicitly defers that. For a confirmed item, `sub_name` should be populated, but `null` is a valid output value (the task-creation layer will handle unassigned cases).

4. **`hasConfirmedStartShiftImpacts` calls `detectConfirmedStartShiftImpacts` and checks length.** This means calling `hasConfirmedStartShiftImpacts` does the full detection work. If the caller needs both the boolean and the list, they should call `detectConfirmedStartShiftImpacts` directly and derive the boolean themselves to avoid double computation. `hasConfirmedStartShiftImpacts` is intended as a convenience guard for callers that only need to branch on presence.

5. **Procurement items are not inspected.** Per spec, only labor schedule items are in scope for this round. Procurement nodes are entirely absent from the iteration.

6. **`confirmed_date` is not inspected.** The `JobSubSchedule.confirmed_date` field exists on the type but is not selected in `getJobWithDetails` (documented in R6 as a known gap). Even if it were available, the spec says not to use it in this round. The status field alone (`'confirmed'`) is the trigger.

7. **Order is preserved.** The function iterates and pushes in `graph.job.sub_schedule` order. No sorting or grouping is applied. The caller receives impacts in the same sequence as the source rows.

---

## E. TypeScript Errors Encountered

No errors in `src/lib/schedule/impacts.ts`.

The two type casts (`graph.job.id as string` and `graph.job.pm_id as string | null | undefined`) are intentional narrowings required by the `Record<string, unknown>` base type of `JobWithDetails`. They are not suppressing genuine type errors — they are bridging the deliberately loose DB return type to the stricter impact record type.

Pre-existing errors in the broader project (missing `node_modules`) are unchanged and not caused by this file.

---

## F. Edge Cases Intentionally Deferred

1. **PM task creation.** `pmId` is captured in the impact record so that the next layer can create a `Call ${companyName}` task assigned to the PM. Task creation is not implemented here. If `pmId` is `null` (no PM assigned), the spec notes that creation should still be allowed unassigned — that is also deferred.

2. **Write-time vs preview-time detection.** This function operates on a `ResolvedScheduleGraph`, which can be produced at any point — before or after `applyResolvedScheduleGraph` is called. It is the caller's responsibility to call `detectConfirmedStartShiftImpacts` with a graph that represents the about-to-be-applied state. Running it on a post-apply graph (where stored values already equal resolved values) would produce zero impacts. Sequencing is the caller's concern.

3. **Idempotency of impact detection.** If `applyResolvedScheduleGraph` is called twice with the same input (e.g., a retry), the second call would see the stored values already matching the resolved values and produce no updates and no impacts. No deduplication guard is needed in this layer.

4. **`confirmed_date` vs `status` as the trigger.** The current rule uses `status === 'confirmed'` only. A future refinement might also require `confirmed_date` to be set (treating it as the authoritative confirmation signal), or might exclude items whose `confirmed_date` was set after the last resolution. Deferred per spec.

5. **Multi-job graphs.** `ResolvedScheduleGraph` carries one job's data. If a future architecture produces a multi-job graph, `graph.job.id` would need disambiguation. Not a concern with current architecture.

6. **Company name from the companies table.** `sub_name` is a free-text denormalized field on `sub_schedule`. The canonical company record (with verified name, contacts, etc.) lives in the `companies` table. Using the canonical record for task creation may produce better output, but the spec says not to join the companies table yet. Deferred.
