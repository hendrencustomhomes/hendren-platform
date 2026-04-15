# Schedule Module — R19 Deliverables

**Date:** 2026-04-11
**Branch:** `dev`
**Files changed:**
- `src/app/schedule/page.tsx` (modified)
- `src/app/schedule/ScheduleEditClient.tsx` (modified)

---

## A. Exact Files Changed

### `src/app/schedule/page.tsx`

Replaced:
```typescript
const hasBaseline = jobFilter
  ? await getJobBaseline(supabase, jobFilter).then((b) => b !== null).catch(() => false)
  : false
```

With:
```typescript
const baselineStatus: boolean | null = jobFilter
  ? await getJobBaseline(supabase, jobFilter)
      .then((b): boolean => b !== null)
      .catch((): null => null)
  : false
```

Prop passed to `<ScheduleEditClient>` renamed from `hasBaseline={hasBaseline}` to `baselineStatus={baselineStatus}`.

### `src/app/schedule/ScheduleEditClient.tsx`

- `Props.hasBaseline: boolean` renamed to `Props.baselineStatus: boolean | null`
- Destructured parameter renamed accordingly
- Baseline toolbar updated from a two-branch `hasBaseline ? ... : ...` to a three-branch explicit comparison:
  - `baselineStatus === true` → Baseline Active indicator
  - `baselineStatus === false` → Set Baseline button
  - `baselineStatus === null` → Baseline unavailable indicator

### `src/app/schedule/actions.ts`

No changes. The `activateBaselineAction` implementation from R18 is correct as-is.

---

## B. Exact Baseline State Model Used in `/schedule?job=...`

```typescript
const baselineStatus: boolean | null = jobFilter
  ? await getJobBaseline(supabase, jobFilter)
      .then((b): boolean => b !== null)
      .catch((): null => null)
  : false
```

| Value | Meaning | Condition |
|---|---|---|
| `true` | Baseline confirmed present | `getJobBaseline` returned a row |
| `false` | Baseline confirmed absent | `getJobBaseline` returned `null` without error |
| `null` | Lookup failed | `getJobBaseline` threw (network, schema, permission) |

The no-job-filter path always produces `false` — baseline state is never fetched for the all-jobs view.

The explicit return type annotations on the `.then` and `.catch` callbacks (`(b): boolean` and `(): null`) prevent TypeScript from widening the inferred type. Without them, the type would resolve to `boolean | null | false`, which is equivalent but less precise and harder to read.

---

## C. Exact UI Behavior for Baseline Present / Absent / Lookup Failed

### `baselineStatus === true` — Baseline Active

```
● Baseline Active
```

- Rendered as a `<span>`, not a `<button>`
- Green background (`rgba(22, 163, 74, 0.1)`), green text (`#16a34a`), green border
- `cursor: default`, `userSelect: none`
- No click handler, no `onClick`
- Non-interactive by markup and style

### `baselineStatus === false` — Set Baseline

```
[ Set Baseline ]
```

- Rendered as a `<button>`
- On click: clears `baselineError`, calls `activateBaselineAction(jobId)` inside `startBaselineTransition`
- While `baselinePending`: label changes to `Setting Baseline…`, button is disabled and visually dimmed
- On action success: `revalidatePath('/schedule')` causes server re-render; page returns `baselineStatus = true`; client receives updated prop; indicator switches to Baseline Active
- On action error: `baselineError` is set and rendered as inline red text next to the button
- `baselineError` is cleared on each new click attempt

### `baselineStatus === null` — Baseline unavailable

```
Baseline unavailable
```

- Rendered as a `<span>`, not a `<button>`
- Amber/warning background (`rgba(217, 119, 6, 0.08)`), amber text, amber border — matches the existing warning palette used elsewhere in the schedule page
- `cursor: default`, `userSelect: none`
- No click handler
- User cannot attempt Set Baseline from this state
- The page otherwise renders normally; only the baseline control is affected

---

## D. Exact Activation Action Behavior After Cleanup

`activateBaselineAction` in `src/app/schedule/actions.ts` is unchanged from R18. It is correct as written:

```typescript
export async function activateBaselineAction(
  jobId: string
): Promise<ActivateBaselineResult> {
  const supabase = await createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    await setJobBaseline(supabase, jobId, user?.id ?? null)

    revalidatePath('/schedule')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Baseline activation failed' }
  }
}
```

The action cannot return `{ ok: true }` if `setJobBaseline` throws. The `catch` always produces `{ ok: false, error }`. The `'Baseline already active for this job'` guard in `setJobBaseline` propagates cleanly as a readable error string. No silent success on failure path exists.

---

## E. Assumptions Made

1. **`boolean | null` is the right shape for three-state.** `true` / `false` / `null` maps cleanly to present / absent / error without introducing a new type or string union. The explicit comparisons `=== true`, `=== false`, and the implicit `null` fallback branch are unambiguous in JSX and in code review.

2. **The `Baseline unavailable` state does not prevent the rest of the page from rendering.** The toolbar renders the unavailable indicator but does not block the schedule tables, the edit mode toolbar, or any other functionality. The page is fully usable in the unavailable state — only the baseline control is degraded.

3. **`revalidatePath` on successful activation is sufficient to update `baselineStatus`.** When the server action succeeds, Next.js invalidates the cached page, the server component re-runs `getJobBaseline`, gets the newly inserted row, and returns `baselineStatus = true` as a prop. No client-side state tracking of baseline presence is needed.

4. **The `null` state is not retryable from the UI.** There is no retry button for `Baseline unavailable`. A user who sees this must reload the page. This is intentional — the lookup failure is a server-side or network condition that the client cannot resolve. Adding a retry button would add complexity for a failure mode that should be transient. Deferred if product feedback indicates it is needed.

5. **`actions.ts` required no changes.** The `activateBaselineAction` structure is already correct. The activation can only be reached when `baselineStatus === false` (the Set Baseline button only renders in that state), so the guard in `setJobBaseline` is an additional safety layer rather than the primary control.

---

## F. TypeScript Errors Encountered

No new errors introduced. All errors in the changed files are pre-existing environment errors from missing `node_modules` (`react`, `next/link`, `next/navigation`). The explicit type annotations on `.then` and `.catch` callbacks in `page.tsx` satisfy the type checker without requiring any additional declarations.

---

## G. Edge Cases Intentionally Deferred

1. **`Baseline unavailable` is not retryable from the UI.** A page reload is the only recovery path. A retry mechanism (e.g., a reload link or a retry button that re-fetches baseline state client-side) would require lifting `baselineStatus` into client state or adding a dedicated fetch route. Deferred.

2. **Stale `Baseline unavailable` after a transient failure.** If the baseline lookup failed at page load due to a transient network issue and the user does not reload, they will continue to see `Baseline unavailable` even after the underlying condition resolves. No automatic recovery or polling is implemented.

3. **`Baseline unavailable` when a baseline actually exists.** If `getJobBaseline` throws on a job that has a baseline, the user sees `Baseline unavailable` rather than `Baseline Active`. This is correct — the system does not know the true state, so it does not claim one. The cost is that the user cannot confirm baseline is active from that page load. They can reload to recover.

4. **`baselineError` persists until next click.** If Set Baseline fails (e.g., `'Baseline already active'`), the error message remains visible until the user clicks the button again (at which point `setBaselineError(null)` clears it before the next transition). No auto-dismiss timeout is implemented.
