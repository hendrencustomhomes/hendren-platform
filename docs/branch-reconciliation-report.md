# Branch Reconciliation Report
**Date:** 2026-04-07

---

## Branches Audited

### `dev` (main integration branch)
- **Latest commit:** `b06fbf7` — chore: allow outbound network access to Supabase and Vercel in sandbox
- **Tip at audit start:** `6ba5a6b` — Add launch execution plan phased from backlog
- **Total commits ahead of claude branch:** 50 commits
- **Status:** Most advanced branch; contains all 5 target fixes

### `claude/audit-reconcile-dev-5piyN`
- **Latest commit:** `e0c3e3f` — feat: job info tab with read-only UI and scope editing
- **Relationship to dev:** 50 commits *behind* dev in the same linear history (no divergent commits)
- **Unique commits not on dev:** 0
- **Status:** Stale pointer to an earlier commit in the shared linear chain

---

## Branch Topology

All commits in the repository form a **single linear chain** — there are no merge commits or true branch divergences. Both `dev` and `claude/audit-reconcile-dev-5piyN` point to different positions in the same chain. `dev` is ahead by 50 commits; the claude branch has no commits that are not already reachable from `dev`.

```
e0c3e3f  ← claude/audit-reconcile-dev-5piyN
  ...
  (50 commits)
  ...
6ba5a6b  ← dev (local at audit start)
b06fbf7  ← origin/dev (3 additional remote commits pulled during reconciliation)
```

---

## What Each Branch Contains

### Fixes present on `dev` (all confirmed):

| Fix | File(s) | Status on dev |
|-----|---------|---------------|
| **1. Procurement create fix** | `src/app/schedule/order/new/page.tsx` | ✅ Present — full `handleSubmit` form with `procurement_items` insert |
| **2. Schedule create fix** | `src/app/schedule/sub/new/page.tsx` | ✅ Present — full `handleSubmit` form with `sub_schedule` insert |
| **3. Task tab / task creation** | `src/app/jobs/[id]/JobTabs.tsx` | ✅ Present — full Tasks tab with `job_tasks` insert and status updates (commit `4fde585`) |
| **4. jobs.address → jobs.project_address** | `src/app/jobs/[id]/page.tsx`, `JobTabs.tsx`, `src/app/jobs/new/page.tsx` | ✅ Present — `project_address` used throughout; no legacy `job.address` references remain |
| **5. Files tab changes** | `src/components/FilesTab.tsx`, `src/app/jobs/[id]/JobTabs.tsx` | ✅ Present — advanced FilesTab (758 lines on dev vs 175 on claude branch); wired into JobTabs |

### Fixes present on `claude/audit-reconcile-dev-5piyN`:
- None of the 5 target fixes are fully implemented on this branch
- This branch represents the codebase state *before* those fixes were applied

---

## What Was Missing on Dev

**Nothing was missing from dev.** Dev was already the more complete branch. After pulling remote, dev now has 53 commits beyond the claude branch tip, including:

- `src/app/jobs/new/JobForm.tsx` — new job form component
- `src/app/jobs/new/actions.ts` — server actions for job creation
- `src/app/schedule/order/[id]/edit/page.tsx` — edit page for procurement orders
- `src/app/schedule/sub/[id]/edit/page.tsx` — edit page for sub schedule items
- `docs/launch-backlog.md`, `docs/launch-execution-plan.md`, `docs/launch-smoke-test.md` — launch planning docs
- All 5 target fixes fully implemented

---

## What Was Moved Onto Dev

No cherry-picks or manual file copies were required. The reconciliation consisted of:

1. **Confirmed** that `claude/audit-reconcile-dev-5piyN` is 50 commits behind `dev` with no unique commits
2. **Checked out** `dev`
3. **Pulled** 3 additional remote commits from `origin/dev`:
   - `b06fbf7` chore: allow outbound network access to Supabase and Vercel in sandbox
   - `f12bd6f` chore: gitignore Claude local settings file
   - `b2bb7e1` chore: verify repo connection write access

---

## Final Files Changed (relative to claude branch tip)

Files that exist on dev but not on (or differ from) the claude branch:

| File | Change Type | Key Content |
|------|-------------|-------------|
| `src/app/jobs/[id]/page.tsx` | Modified (644 → 114 lines on claude) | Full info panel, project_address, tasks query |
| `src/app/jobs/[id]/JobTabs.tsx` | Modified (2220 → 362 lines on claude) | Tasks tab, FilesTab, project_address, schedule/procurement tabs |
| `src/app/jobs/new/page.tsx` | Modified | project_address field, improved validation |
| `src/app/jobs/new/JobForm.tsx` | Added | Dedicated form component |
| `src/app/jobs/new/actions.ts` | Added | Server actions for job insert |
| `src/app/jobs/page.tsx` | Modified | Jobs list improvements |
| `src/app/schedule/order/new/page.tsx` | Modified (623 → 150 lines on claude) | Full create form with handleSubmit |
| `src/app/schedule/sub/new/page.tsx` | Modified (408 → 124 lines on claude) | Full create form with handleSubmit |
| `src/app/schedule/order/[id]/edit/page.tsx` | Added | Edit page for procurement orders |
| `src/app/schedule/sub/[id]/edit/page.tsx` | Added | Edit page for sub schedule items |
| `src/app/schedule/page.tsx` | Modified | Improved schedule view |
| `src/app/api/files/list/route.ts` | Modified | File list API |
| `src/app/api/files/signed-url/route.ts` | Modified | Signed URL API |
| `src/app/api/files/upload/route.ts` | Modified | Upload API |
| `src/components/FilesTab.tsx` | Modified (758 → 175 lines on claude) | Full files UI with visibility scopes, categories |
| `src/components/Nav.tsx` | Modified (292 → 68 lines on claude) | Full nav with hamburger menu |
| `src/lib/db.ts` | Modified (246 → 127 lines on claude) | Additional DB helpers |
| `src/app/login/page.tsx` | Modified | Login improvements |
| `src/app/page.tsx` | Modified | Home page updates |
| `docs/launch-backlog.md` | Added | Launch backlog |
| `docs/launch-execution-plan.md` | Added | Launch execution plan |
| `docs/launch-smoke-test.md` | Added | Smoke test checklist |
| `.claude/settings.json` | Added | Claude settings (pulled from remote) |
| `.gitignore` | Modified | Added .claude/settings.json (pulled from remote) |

---

## Remaining Risks

1. **Stale claude branch** — `claude/audit-reconcile-dev-5piyN` is 53 commits behind `dev`. It should not be used as a base for new work. Consider archiving or ignoring it.

2. **No procurement create in JobTabs inline** — The procurement tab in `JobTabs.tsx` links to `/schedule/order/new?job=...` rather than using an inline form. This is by design (dev commit history shows the standalone form is the fix), but ensure UX flow is tested end-to-end.

3. **`job_tasks` table dependency** — The Tasks tab queries `job_tasks`. Confirm this table exists in the Supabase schema before testing.

4. **FilesTab API routes** — The files upload/list/signed-url routes were all modified after the claude branch split. Integration testing with real Supabase storage is recommended.

5. **`project_address` schema column** — The `jobs` table insert now uses `project_address`. Verify the database column name matches exactly (was `address` in the old branch).

---

## Summary

- **dev is already complete** with all 5 target fixes and 50+ additional improvements
- **No cherry-picks were needed** — the claude branch is simply an older ancestor of dev
- **dev was pulled** from remote to incorporate 3 additional housekeeping commits
- **dev is the authoritative branch** and should be used for all further work
