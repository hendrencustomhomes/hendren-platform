# Schedule Module — R18 Deliverables

**Date:** 2026-04-11
**Branch:** `dev`
**Files changed:**
- `src/app/schedule/actions.ts` (modified)
- `src/app/schedule/page.tsx` (modified)
- `src/app/schedule/ScheduleEditClient.tsx` (modified)

---

## A. Exact Files Changed

### `src/app/schedule/actions.ts`

Added import of `setJobBaseline` from `@/lib/schedule/baseline`. Added `ActivateBaselineResult` type and `activateBaselineAction` server action. No changes to `saveScheduleDraftAction`.

### `src/app/schedule/page.tsx`

Added import of `getJobBaseline` from `@/lib/schedule/baseline`. Added `hasBaseline` fetch in the `jobFilter` branch. Passed `hasBaseline` prop to `<ScheduleEditClient>`.

### `src/app/schedule/ScheduleEditClient.tsx`

Added `activateBaselineAction` to the import from `./actions`. Added `hasBaseline: boolean` to the `Props` type. Added `baselineError` state and `baselinePending`/`startBaselineTransition` from a second `useTransition`. Added baseline toolbar section in the JSX, rendered above the edit mode toolbar.

---

## B. Exact Baseline Activation Action Added

```typescript
// src/app/schedule/actions.ts

export type ActivateBaselineResult = {
  ok: boolean
  error?: string
}

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

`user?.id ?? null` — if `getUser` returns no session (unauthenticated edge case), `createdBy` is passed as `null` rather than throwing. `setJobBaseline` accepts `null` for `createdBy` and omits the field from the insert, letting the DB default apply. The guard in `setJobBaseline` will throw `'Baseline already active for this job'` if a baseline exists; that error propagates to `ActivateBaselineResult.error` and is surfaced in the UI.

---

## C. How Baseline State Is Loaded in `/schedule?job=...`

In `page.tsx`, immediately after the `dependencies` fetch:

```typescript
const hasBaseline = jobFilter
  ? await getJobBaseline(supabase, jobFilter).then((b) => b !== null).catch(() => false)
  : false
```

- Only executed when `jobFilter` is present. The all-jobs view path does not call `getJobBaseline`.
- `.then((b) => b !== null)` collapses the `JobBaseline | null` result to a boolean.
- `.catch(() => false)` treats a query error as no-baseline rather than breaking the page load.
- The boolean is passed to `<ScheduleEditClient hasBaseline={hasBaseline} />`.

---

## D. Exact UI Behavior for Set Baseline vs Baseline Active

### When `hasBaseline === false`

A button is rendered:

```
[ Set Baseline ]
```

- Enabled when `baselinePending` is false.
- On click: clears `baselineError`, calls `activateBaselineAction(jobId)` inside `startBaselineTransition`.
- While pending: button text changes to `Setting Baseline…` and is disabled with reduced opacity.
- On success: `revalidatePath('/schedule')` causes the server component to re-render with the fresh `hasBaseline = true` value, switching the button to the indicator.
- On error: `baselineError` is set and rendered as red inline text next to the button. The button remains usable for retry.

### When `hasBaseline === true`

A non-interactive indicator is rendered:

```
● Baseline Active
```

- Styled with green background (`rgba(22, 163, 74, 0.1)`), green text (`#16a34a`), green border.
- `cursor: default`, `userSelect: none` — visually and behaviorally non-interactive.
- No click handler. No `onClick`. Not a `<button>` element — rendered as a `<span>`.

Both elements appear above the edit mode toolbar, inside `ScheduleEditClient`, only in the job-filtered view. The all-jobs view never receives `hasBaseline` and never renders either control.

---

## E. Assumptions Made

1. **`revalidatePath('/schedule')` triggers a full server re-render that re-fetches `getJobBaseline`.** After `activateBaselineAction` succeeds and revalidates, the Next.js page re-renders from the server with the newly inserted baseline row, producing `hasBaseline = true`. The client component receives this as a new prop. No client-side state mutation is needed to toggle the button — the server provides the updated truth.

2. **`user?.id` is a UUID string compatible with `created_by` column type.** The Supabase auth user ID is a UUID. The `created_by` column in `job_baselines` is assumed to be `uuid` or `text`. Passing `user.id` as a string is consistent with how other parts of the codebase use the auth user ID.

3. **`hasBaseline` is `false` on query error, not an error state.** If `getJobBaseline` throws during page load (network issue, schema mismatch), the page falls back to `hasBaseline = false` and renders the Set Baseline button. This is the safer degraded state — the user can attempt activation, which will either succeed or show an error message from the action, rather than the page failing to load.

4. **No optimistic update is needed for the baseline toggle.** The transition from Set Baseline to Baseline Active is driven by a server re-render after `revalidatePath`. This avoids any client-side state that could desync from the server. The `baselinePending` state during the transition handles the in-flight visual.

5. **A second `useTransition` is used for baseline separately from the draft save transition.** The two operations (`saveScheduleDraftAction` and `activateBaselineAction`) are independent and can both be in-flight conceptually. Using separate transitions keeps their pending states isolated.

6. **The baseline toolbar renders unconditionally in `ScheduleEditClient`.** The component is only rendered when `jobFilter` is present (enforced in `page.tsx`), so the toolbar never appears in the all-jobs view. No additional conditional guard inside the component is needed.

---

## F. TypeScript Errors Encountered

All errors are pre-existing environment errors from missing `node_modules`:

```
src/app/schedule/ScheduleEditClient.tsx(3,50): error TS2307: Cannot find module 'react'
src/app/schedule/ScheduleEditClient.tsx(4,18): error TS2307: Cannot find module 'next/link'
```

JSX element errors and the `Parameter 'prev' implicitly has an 'any' type` cascade at line 193 are unchanged from R15 — all caused by missing `react` types. No new errors introduced by R18 changes.

---

## G. Edge Cases Intentionally Deferred

1. **Double-click / rapid re-submission.** The `baselinePending` flag disables the button while the transition is in flight, preventing a second click during the same request. However, if the page re-renders between two rapid clicks (unlikely), both could reach `setJobBaseline`. The guard in `setJobBaseline` throws on the second call, producing an error message. No further protection is implemented.

2. **Baseline activation while another user has already activated.** If two users on the same job both see `hasBaseline = false` (their pages loaded before either activated), both may click Set Baseline. The first to complete will succeed; the second will receive `'Baseline already active for this job'` from the guard in `setJobBaseline`, which surfaces as an inline error. On their next page load or navigation, `hasBaseline` will be `true` and the indicator will show correctly.

3. **Stale `hasBaseline = false` after activation by another user.** A user who loaded the page before a colleague activated the baseline will still see the Set Baseline button until they refresh. Clicking it will receive an error from the action guard. This is the correct behavior per the architecture — no real-time sync is implemented, and the warning is surfaced rather than a silent failure.

4. **Error message from `setJobBaseline` is user-visible.** The error string `'Baseline already active for this job'` is thrown from the library and passed through to `ActivateBaselineResult.error`, which is rendered directly in the UI. If the error originates from a Supabase failure, the raw Supabase error message is shown. A future improvement could normalize error messages before surfacing them. Deferred.

5. **No baseline activation confirmation.** The Set Baseline button activates immediately on click without a confirmation dialog. Per the task brief, no confirmation flow was required. If the product later decides activation should require confirmation (e.g., "Are you sure? This cannot be undone without a reset flow"), a modal or inline confirm step can be added. Deferred.
