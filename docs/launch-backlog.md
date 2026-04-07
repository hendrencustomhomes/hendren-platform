# Launch Backlog

---

## Blocked Now

> These items cause errors or prevent core flows from working. Fix before any user testing.

---

### 1. Login broken for non-admin users

**Feedback:** Unable to login with any users other than admin@

**Impact:** repo + supabase
**Likely files:** `app/(auth)/login/`, `lib/supabase/`, RLS policies on `profiles` or `users` table

---

### 2. Procurement creation fails — order_by_date column

**Feedback:** Error when trying to create procurement: cannot insert a non-DEFAULT value into column "order_by_date"

**Impact:** supabase
**Likely files:** `supabase/migrations/`, `app/jobs/[id]/procurement/` — column definition or insert statement

---

### 3. Schedule item creation fails — invalid enum sub_status "scheduled"

**Feedback:** Error when creating schedule item on status scheduled: invalid input value for enum sub_status: "scheduled"

**Impact:** supabase
**Likely files:** `supabase/migrations/` — enum definition for `sub_status`, `app/jobs/[id]/schedule/`

---

### 4. Task creation fails

**Feedback:** Error when creating task "failed to add task. Please try again"

**Impact:** repo + supabase
**Likely files:** `app/jobs/[id]/tasks/`, `lib/supabase/tasks.ts` or equivalent, RLS policies on `tasks` table

---

## Buildable Now

> These do not depend on blocked items and can be built in parallel.

---

### 5. Referral sources — add/edit in app

**Feedback:** Referral sources should be add/editable in the app. List at launch should be: Past Client, Referral, Website, Signage, Other

**Impact:** repo + supabase
**Likely files:** Admin settings page, `supabase/migrations/` — referral_sources table or lookup

---

### 6. Scrolling job tabs — consolidate or use large tiles

**Feedback:** Scrolling left to right for job tabs. Need to consolidate or make them large tiles that fit in the screen.

**Impact:** repo
**Likely files:** `app/jobs/[id]/`, job tab nav component

---

### 7. Job dashboard — remove redundant current/next stage tiles

**Feedback:** Job id dashboard is cluttered. Remove redundant current/next stage tiles.

**Impact:** repo
**Likely files:** `app/jobs/[id]/`, job detail overview/dashboard component

---

### 8. File permissions — edit after upload, multi-select, folder tiles

**Feedback:** Need to be able to edit file permissions after upload. Need file multi-select for any actions (Permissions, trade type, download). Need folder square tiles rather than full width tiles. Should auto size visible tiles for vertical scrolling.

**Impact:** repo + supabase
**Likely files:** `app/jobs/[id]/files/`, `components/FilesTab.tsx`, storage policies

---

### 9. No horizontal scrolling except Gantt or tables

**Feedback:** No horizontal scrolling anywhere except Gantt or tables. (Stress test this)

**Impact:** repo
**Likely files:** Global layout/CSS, all tab content components

---

### 10. Procurement tile — company higher, trade auto-suggest

**Feedback:** Company should be higher on procurement tile. Should auto suggest trade based on vendor, but allow for changing in case they have multiple trades on their company profile.

**Impact:** repo
**Likely files:** `app/jobs/[id]/procurement/`, procurement form component

---

### 11. Procurement — company search/dropdown with "add new company" option

**Feedback:** Company should be search/dropdown on procurement. No free fill. If company doesn't exist, offer "add new company" as option, and populate the company name with what was searched.

**Impact:** repo + supabase
**Likely files:** Procurement form, `components/CompanySearch.tsx` or equivalent, companies table

---

### 12. Procurement — group near top, link to takeoff dropdown

**Feedback:** Procurement group should be closer to the top as well and should link to takeoff dropdown. Allow free text if no search results.

**Impact:** repo
**Likely files:** Procurement form component

---

### 13. Procurement — unit dropdown with add/edit for admin

**Feedback:** Unit should be dropdown with add/edit available to admin.

**Impact:** repo + supabase
**Likely files:** Procurement form, admin settings, units lookup table

---

### 14. Procurement — cost field formats to $

**Feedback:** Cost should format to $

**Impact:** repo
**Likely files:** Procurement form component

---

### 15. Procurement — cost code dropdown/search, no free type

**Feedback:** Cost code is dropdown/search. No free type. Edit takes admin/bookkeeper to cost code edit page.

**Impact:** repo
**Likely files:** Procurement form, `components/CostCodeSelect.tsx` or equivalent

---

### 16. Procurement — linked schedule dropdown/search

**Feedback:** Linked schedule is dropdown/search.

**Impact:** repo
**Likely files:** Procurement form component

---

### 17. Procurement — remove instruction description from material responsibility

**Feedback:** Remove instruction description from material responsibility.

**Impact:** repo
**Likely files:** Procurement form component

---

### 18. Procurement — order by date: reverse fill need-on-site

**Feedback:** Allow for order by to reverse fill need on site for when using as log for orders already placed.

**Impact:** repo
**Likely files:** Procurement form component

---

### 19. Procurement — remove "depends on" dropdown

**Feedback:** Remove dropdown for depends on. All procurement items depend on contract, so that is redundant. Link to selection needs to be dropdown/search.

**Impact:** repo
**Likely files:** Procurement form component

---

### 20. Procurement — consolidate timing and responsibility tiles

**Feedback:** Consolidate timing and responsibility tiles.

**Impact:** repo
**Likely files:** Procurement form/detail component

---

### 21. ALL cost code fields — dropdown; schedule is one

**Feedback:** ALL cost code fields should be dropdown. Schedule is one.

**Impact:** repo
**Likely files:** Any form with cost code input across jobs, schedule, procurement

---

### 22. Schedule — rename "released to company" to "release"

**Feedback:** Change "released to company" to "release" schedule

**Impact:** repo
**Likely files:** Schedule item form/detail component, possibly supabase enum

---

### 23. Schedule — notification window, no spam emails per shift

**Feedback:** Notification window should still allow for initial confirmation, but not send spam emails with every shift unless inside their window.

**Impact:** repo + supabase
**Likely files:** Notification/email logic, schedule notification handler, edge functions

---

### 24. Schedule item creation — redirect to schedule page after save

**Feedback:** Schedule item creation should redirect to schedule page

**Impact:** repo
**Likely files:** Schedule item create form, `app/jobs/[id]/schedule/`

---

### 25. Schedule — remove "on site" from schedule dropdown

**Feedback:** Remove on site from schedule dropdown

**Impact:** repo
**Likely files:** Schedule form component, possibly supabase enum

---

### 26. Schedule — all tiles tappable on schedule page

**Feedback:** Schedule page should make all tiles tappable.

**Impact:** repo
**Likely files:** `app/jobs/[id]/schedule/`, schedule tile/card component

---

### 27. Logs — add task button and edit on same page

**Feedback:** Create log should also have option to add tasks. Need add task button and edit on same page. Logs tab on mobile should have job picker and auto sort by assigned jobs. Still need access to make logs on other people's jobs.

**Impact:** repo
**Likely files:** `app/logs/`, log create/edit form, `components/LogsTab.tsx`

---

### 28. Logs — edit and delete option

**Feedback:** Need option to edit/delete log.

**Impact:** repo + supabase
**Likely files:** Log detail/list component, RLS policies on logs table

---

### 29. Logs/issues — consolidate by adding tasks to logs

**Feedback:** Consolidate logs/issues by creating add task to logs.

**Impact:** repo
**Likely files:** `app/logs/`, `components/LogsTab.tsx`

---

### 30. Tasks — deadline reset should remove the deadline

**Feedback:** Task deadline reset should remove the deadline.

**Impact:** repo
**Likely files:** Task edit form, `app/jobs/[id]/tasks/`

---

### 31. Tasks — replace "visible to client" with assignee

**Feedback:** Visible to client should be replaced with assignee. Clients only see tasks they are assigned to.

**Impact:** repo + supabase
**Likely files:** Task form, RLS policies on tasks table

---

### 32. No "master" verbiage anywhere

**Feedback:** Do not use "master" as verbiage anywhere in software.

**Impact:** repo
**Likely files:** Any component, label, or copy using the word "master"

---

### 33. All tiles tappable if they link to a page

**Feedback:** All tiles should be tappable if they have a page they could be linked to.

**Impact:** repo
**Likely files:** All tile/card components across the app

---

### 34. Mobile — bottom tab nav instead of hamburger menu

**Feedback:** Mobile view should have tabs at the bottom of the page in every view for quick cross context navigation instead of hamburger menu. Tabs should be Dashboard, Jobs, Logs, and Schedule.

**Impact:** repo
**Likely files:** `components/Layout.tsx`, `app/layout.tsx`, mobile nav component

---

### 35. Jobs — tasks, files, schedule, logs as visible tiles

**Feedback:** Jobs should have tasks, files, schedule, and logs easily visible as tiles, but should not remove the always visible tiles for main nav.

**Impact:** repo
**Likely files:** `app/jobs/[id]/`, job overview component

---

### 36. Tiles highlighted when in use

**Feedback:** Tiles should be highlighted when in use.

**Impact:** repo
**Likely files:** Tile/card components, global CSS or Tailwind classes

---

### 37. Desktop — always-visible side menu, exhaustive links

**Feedback:** Desktop should have side menu instead of tabs and be always visible. Must be exhaustive: dashboard, schedule, takeoffs, estimates, etc.

**Impact:** repo
**Likely files:** `components/Layout.tsx`, `app/layout.tsx`, sidebar nav component

---

### 38. Switching jobs retains current context/tab

**Feedback:** Clicking on another job while in a given context should retain that context. e.g., looking at the schedule in job 1, clicks on job 2 — schedule view still there without having to select it again.

**Impact:** repo
**Likely files:** Job navigation component, routing logic, `app/jobs/[id]/`

---

## Dependent

> These items depend on blocked items being resolved first, or require design decisions before building.

---

### 39. Pipeline — color-coded progress with gates

**Feedback:** Pipeline does not progress with checked items. Should show colors for not started (gray), in progress (blue), completed (green). Need gates for progression as well.

**Impact:** repo + supabase
**Likely files:** `app/jobs/[id]/pipeline/`, pipeline stage components, possibly supabase pipeline/stage tables

**Depends on:** Final pipeline editing (item 40) resolved first so stages are stable before adding gate logic.

---

### 40. Final pipeline — editable, admin-editable in app

**Feedback:** Final pipeline needs editing, and should also be editable by admin users in app.

**Impact:** repo + supabase
**Likely files:** `app/jobs/[id]/pipeline/`, admin settings, pipeline template tables

**Depends on:** Agreement on pipeline data model before building edit UI.

---

### 41. Pipeline/tasks consolidation — consider removing pipeline

**Feedback:** Maybe we consolidate pipeline/tasks and auto filter by tasks not assigned/assigned to that user. Pipeline becomes redundant if tasks cover onboarding, PM assignment, and proposal approval.

**Impact:** repo + supabase
**Likely files:** `app/jobs/[id]/pipeline/`, `app/jobs/[id]/tasks/`

**Depends on:** Open product decision — see Open Product Questions below.

---

### 42. Schedule — calendar, list, and Gantt views

**Feedback:** Schedule needs to show calendar, list, and Gantt views. Gantt should auto sort based on schedule start date, but also be manually drag-able via 6 dot left side. Make sure it looks good in mobile landscape view and desktop.

**Impact:** repo
**Likely files:** `app/jobs/[id]/schedule/`, schedule view toggle component

**Depends on:** Schedule blocked bugs (items 3, 24, 25) resolved so data is reliable before building new views.

---

---

## Open Product Questions

- **What is "requires file upload" on tasks?**
  Unclear what behavior this enables — does it block task completion until a file is attached? Is it a task property visible to assignees? Needs definition before building.

- **Should pipeline be consolidated into tasks?**
  If Mike's "tasks" cover onboarding, PM assignment, and proposal approval, does a separate pipeline view add value or create confusion? Decision affects items 39–41.

---

## Notes

- Items in **Blocked Now** should be the first priority — they prevent any real user testing.
- Items in **Buildable Now** can be parallelized across frontend and backend work.
- Items in **Dependent** should be sequenced after their blockers or after product decisions are made.
- "master" verbiage sweep (item 32) can be a quick grep pass across all components and copy.
- Mobile bottom nav (item 34) and desktop side nav (item 37) are structural — do these early to avoid rework across every page.
- Context retention when switching jobs (item 38) likely requires storing the active tab in URL params or global state — design this once and apply everywhere.
