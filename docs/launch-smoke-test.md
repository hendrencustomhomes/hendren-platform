# Launch Smoke Test

Manual checklist. Run top-to-bottom before each release. Mark each item pass/fail.

---

## Internal User Login Validation

- [ ] Navigate to `/login`
- [ ] Log in with an internal user account (must exist in `internal_access` with `is_active = true`)
- [ ] Confirm redirect to `/jobs` (not 404 or blank)
- [ ] Log in with an unknown email — confirm login is rejected
- [ ] Confirm no `profiles.role`, `profiles.is_admin`, or `profiles.is_project_manager` reads in server logs

---

## Job Create

- [ ] Navigate to `/jobs/new`
- [ ] Fill in job name, address, contract type; submit
- [ ] Confirm redirect to `/jobs/[id]` with correct job name in header
- [ ] Confirm job appears in `/jobs` list
- [ ] Create a job with no PM assigned — confirm it saves without error
- [ ] Confirm `job_clients` row is created (not only `jobs.client_name`)

---

## Job Inline Edit

- [ ] Open any job at `/jobs/[id]`
- [ ] Click **Edit** on the Info tab
- [ ] Change job name, PM, scope notes; click **Save**
- [ ] Confirm page refreshes with updated values — no stale data
- [ ] Click **Edit**, make a change, then switch tabs — confirm **"Discard changes?"** dialog appears
- [ ] Click **Edit**, click **Cancel** — confirm no changes were saved
- [ ] Simulate a save failure (disconnect network) — confirm inline error message appears, not a silent no-op

---

## Files Upload / Open

- [ ] Navigate to the Files tab on any job
- [ ] Upload a file (PDF, image, or doc)
- [ ] Confirm file appears in the list with correct name and size
- [ ] Click the file — confirm it opens via signed URL (not a 403 or broken link)
- [ ] Upload a second file — confirm both are visible
- [ ] Confirm `visibility_scope` is set correctly on upload (not `client_visible` / `companies_visible` legacy fields)

---

## Tasks Create / Update

- [ ] Navigate to the Tasks tab on any job
- [ ] Click **+ Add Task**, fill in title and due date; click **Add Task**
- [ ] Confirm task appears in the list with correct status badge (`open`)
- [ ] Change task status via the dropdown — confirm badge updates immediately
- [ ] Create a task with **Requires file upload** checked — confirm badge renders
- [ ] Create a task with **Visible to client** checked — confirm badge renders
- [ ] Simulate add failure — confirm error message appears inline, not silent

---

## Logs

- [ ] Navigate to the Log tab
- [ ] Type a log entry; click **Add Entry**
- [ ] Confirm entry appears at the top of the list with author name and date
- [ ] Confirm empty state ("No log entries yet") shows on a job with no logs
- [ ] Simulate add failure — confirm error message appears inline

---

## Issues

- [ ] Navigate to the Issues tab
- [ ] Click **+ Log Issue**, fill in severity and title; click **Log Issue**
- [ ] Confirm issue appears in the list with correct severity badge
- [ ] Click **Resolve** — confirm confirmation dialog appears before resolving
- [ ] Confirm resolved issue shows strikethrough and checkmark
- [ ] Confirm empty state ("No issues ✓") shows on a job with no issues
- [ ] Confirm Issues tab label updates to `Issues (N)` when open issues exist

---

## Schedule Release / Confirm

- [ ] Open a job with schedule items (or create one at `/schedule/sub/new?jobId=...`)
- [ ] Navigate to the Schedule tab
- [ ] Click **Release** on a draft item — confirm badge changes to `Released`
- [ ] Click **Confirm** on a released item — confirm badge changes to `Confirmed`
- [ ] Click **Unrelease** on a released item — confirm it reverts to `Draft`
- [ ] Confirm schedule error displays inline (not `alert()`) on failure
- [ ] Click **+ Schedule Item** — confirm redirect to `/schedule/sub/new?jobId=...`
- [ ] Click **Edit** on an item — confirm redirect to `/schedule/sub/[id]/edit`

---

## Procurement Create / Edit

- [ ] Navigate to the Procurement tab on a job with items
- [ ] Confirm items list renders with status badge and order-by date
- [ ] Confirm overdue items show red flag, items due within 7 days show warning
- [ ] Click an item — confirm redirect to `/schedule/order/[id]/edit`
- [ ] Click **+ Procurement Item** — confirm redirect to `/schedule/order/new?jobId=...`
- [ ] Create a new procurement item — confirm it appears in the tab on return
- [ ] Edit an existing item — confirm changes persist on return

---

## Notes

- All tabs (Info / Pipeline / Log / Issues / Tasks / Schedule / Procurement / Files) must be present and responsive on a 375px viewport
- Tab badge counts (Issues, Tasks) must reflect live state after mutations
- No `alert()` calls should appear for any user-facing action (schedule errors are now inline)
