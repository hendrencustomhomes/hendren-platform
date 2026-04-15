# Scope Intake V1 — R3

Date: 2026-04-15
Branch: `claude/scope-intake-r2-U2mAQ`
Status: complete

## What changed

### ScopeTab.tsx — full R2 upgrade

Replaced the generic freeform scope row editor with a structured Scope Intake R2 UI.

Changes:
- Imports `SCOPE_STARTER_DEFINITIONS`, `isStarterScopeType`, `buildDefaultScopeItems`, `ScopeStarterSection` from `@/lib/scope`
- Starter rows are grouped into three sections rendered as separate cards: **Project**, **Layout**, **Features**
- Each starter field renders the correct input type per its `ScopeStarterDefinition.kind`:
  - `select` → `<select>` with defined options (controlled, saves on change)
  - `number` → `<input type="text" inputMode="decimal">` (uncontrolled, saves on blur)
  - `text` → `<input>` (uncontrolled, saves on blur)
  - `multiline` → `<textarea>` (uncontrolled, saves on blur)
- Help text from the definition is shown below each field label
- If no starter rows exist for the job, an **Initialize Scope** button is shown; clicking it bulk-inserts all default starter rows into `job_scope_items` via `buildDefaultScopeItems`
- Custom/freeform scope items (non-starter `scope_type`) are preserved and rendered in an **Additional Notes** card
- A **+ Add Custom Scope Item** action allows adding new freeform rows at any time
- All saves go to `job_scope_items` — no schema changes required
- No takeoff automation, no selections logic, no import/template logic added

### jobs/new/page.tsx — post-create redirect

One-line change only:

```
- router.push(job?.id ? `/jobs/${job.id}` : '/')
+ router.push(job?.id ? `/jobs/${job.id}?tab=scope` : '/')
```

After job creation the user is taken directly to the Scope tab of the new job. The tab system in `JobTabs.tsx` already handles `?tab=scope` via `useSearchParams` + `useEffect`.

## Exact files changed (this pass)

| File | Change |
|------|--------|
| `src/app/jobs/[id]/ScopeTab.tsx` | Full rewrite — generic freeform → structured R2 intake |
| `src/app/jobs/new/page.tsx` | Redirect target: `/jobs/[id]` → `/jobs/[id]?tab=scope` |
| `docs/scope_r3.md` | This file |

Files that arrived via `git merge origin/dev` (pre-existing work, not modified in this pass):

- `src/lib/scope.ts` — starter definitions module
- `src/app/jobs/[id]/JobTabs.tsx` — tab system including scope tab wiring and `useSearchParams`
- `src/app/jobs/[id]/page.tsx` — job detail page passing `scopeItems` to `JobTabs`
- `docs/scope_r2.md` — R2 planning document

## Migration needed

None. `job_scope_items` was already in use. Starter rows insert into the existing table using the existing schema (`scope_type`, `label`, `value_text`, `value_number`, `sort_order`). No new columns, no new tables.

## What was intentionally deferred

- Downstream takeoff automation from scope rows
- Selections linkage
- Import/template logic
- Scope row deletion UI
- Reordering starter rows

## QA performed

- TypeScript type check: `tsc --noEmit` — passed with no errors
- Next.js compile: passed (`✓ Compiled successfully`)
- Static page generation: pre-existing failure on `/jobs/new` due to missing Supabase env vars in the build environment (not introduced by this pass; the dev branch's `jobs/new/page.tsx` initializes `createClient()` at component scope which is evaluated during SSR prerendering without env vars present)
- Code review: confirmed `ScopeTab` imports only from `@/lib/scope` and `@/utils/supabase/client`; no downstream modules added

## Exact commit SHA

`3443e0d56ce87ae2ac36978ffcdd9f8f306c7499` (on `dev`)

## Branch note

Session environment designated `claude/scope-intake-r2-U2mAQ`. That branch was rejected by repository branch creation rules. Final push landed on `dev` as the task description required. The scope-specific commits were replayed cleanly onto `origin/dev` — only the three scope files are in the push diff.
