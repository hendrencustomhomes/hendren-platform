# Launch Execution Plan

---

## Phase 1 — Core System Fixes

> Fix all broken flows before any other work proceeds.

- [ ] **#1** Fix login — non-admin users cannot authenticate (`app/(auth)/login/`, RLS on `profiles`/`users`)
- [ ] **#4** Fix task creation — "failed to add task" error (`app/jobs/[id]/tasks/`, `tasks` RLS)
- [ ] **#2** Fix procurement creation — `order_by_date` column rejects non-DEFAULT values (`supabase/migrations/`)
- [ ] **#3** Fix schedule item creation — invalid enum value `"scheduled"` for `sub_status` (`supabase/migrations/`)

---

## Phase 2 — Data Integrity + Forms

> Fix field types, dropdowns, and data validation across all forms.

- [ ] **#5** Referral sources — make add/editable in app; seed list: Past Client, Referral, Website, Signage, Other
- [ ] **#21** All cost code fields must be dropdowns (not free text); schedule field is one instance
- [ ] **#15** Procurement cost code — dropdown/search only; edit routes admin/bookkeeper to cost code edit page
- [ ] **#13** Procurement unit — dropdown with add/edit available to admin
- [ ] **#14** Procurement cost — format value as currency ($)
- [ ] **#16** Procurement linked schedule — dropdown/search only
- [ ] **#11** Procurement company — search/dropdown only; offer "add new company" pre-filled if not found
- [ ] **#18** Procurement order by date — reverse fill need-on-site for logging already-placed orders
- [ ] **#30** Task deadline reset — clearing deadline should null the value, not retain it
- [ ] **#31** Tasks — replace "visible to client" with assignee field; clients see only tasks assigned to them

---

## Phase 3 — Files System

> Overhaul file management UX and permissions.

- [ ] **#8** Files — edit permissions after upload; multi-select for permissions/trade type/download; folder square tiles with auto-sized vertical scroll

---

## Phase 4 — Job View UX

> Clean up the job detail page layout and navigation behavior.

- [ ] **#6** Job tabs — consolidate horizontal scroll into large tiles that fit the screen
- [ ] **#7** Job dashboard — remove redundant current/next stage tiles
- [ ] **#35** Jobs — show tasks, files, schedule, and logs as visible tiles without removing main nav tiles
- [ ] **#36** Tiles — highlight active tile when in use
- [ ] **#33** All tiles — make tappable if they link to a page
- [ ] **#32** Remove all "master" verbiage from the app
- [ ] **#38** Switching jobs — retain current context/tab (store active tab in URL params or global state)
- [ ] **#9** No horizontal scrolling anywhere except Gantt or tables — stress test across all views

---

## Phase 5 — Procurement System

> Complete the procurement form overhaul.

- [ ] **#10** Procurement tile — move company field higher; auto-suggest trade from vendor profile
- [ ] **#12** Procurement group — move near top; link to takeoff dropdown; allow free text if no results
- [ ] **#17** Procurement — remove instruction description from material responsibility section
- [ ] **#19** Procurement — remove "depends on" dropdown (redundant); make link to selection a dropdown/search
- [ ] **#20** Procurement — consolidate timing and responsibility tiles

---

## Phase 6 — Logs + Tasks

> Complete log and task functionality.

- [ ] **#28** Logs — add edit and delete options; RLS policies on logs table
- [ ] **#27** Logs — add task button on create/edit page; mobile logs tab gets job picker sorted by assigned jobs
- [ ] **#29** Logs/issues — consolidate by enabling "add task" from within a log
- [ ] **#41** Pipeline/tasks — decide on consolidation; auto-filter tasks by assigned/unassigned user *(depends on Phase 8 decision)*

---

## Phase 7 — Navigation

> Rebuild navigation structure for mobile and desktop.

- [ ] **#34** Mobile — replace hamburger menu with bottom tab bar: Dashboard, Jobs, Logs, Schedule
- [ ] **#37** Desktop — always-visible side menu with exhaustive links: Dashboard, Schedule, Takeoffs, Estimates, etc.

---

## Phase 8 — Pipeline Decisions

> Resolve product questions then build.

- [ ] **#40** Pipeline — make final pipeline editable; admin users can edit pipeline in app *(decide data model first)*
- [ ] **#39** Pipeline — color-coded progress (gray/blue/green) with stage gates *(depends on #40 being stable)*

---

## Phase 9 — Schedule Expansion

> Expand schedule after core bugs are resolved.

- [ ] **#22** Schedule — rename "released to company" label to "release"
- [ ] **#25** Schedule — remove "on site" from schedule status dropdown
- [ ] **#24** Schedule item creation — redirect to schedule page after save
- [ ] **#26** Schedule — all tiles tappable
- [ ] **#23** Schedule notifications — send initial confirmation only; no repeated emails per shift unless inside notification window
- [ ] **#42** Schedule — add calendar, list, and Gantt views; Gantt auto-sorts by start date and supports drag via 6-dot handle; works in mobile landscape and desktop *(depends on #3, #24, #25 done)*

---

## Open Product Questions

These must be answered before dependent items can be built.

- **What is "requires file upload" on tasks?** — Does it block task completion until a file is attached? Is it visible to assignees? Define before building.
- **Should pipeline be consolidated into tasks?** — If tasks cover onboarding, PM assignment, and proposal approval, is the pipeline view still needed? Answer drives Phase 8 scope.
