# Repo Audit — Schedule Module

**Date:** 2026-04-10  
**Branch:** `claude/audit-schedule-module-WJyaY`  
**Scope:** Pre-implementation audit. No files modified. No code written.

---

## A. Existing Routes / Pages

| Path | Purpose | Status | Recommendation |
|------|---------|--------|----------------|
| `/schedule` | Master schedule hub. Two tables: Labor Schedule (`sub_schedule`) and Material Schedule (`procurement_items`). Risk alert dashboard. Filter by job via `?job=jobId`. | Active, functional | **Adapt** — this is the primary surface. Will need to evolve into the new schedule engine's main view. |
| `/schedule/sub/new` | Create a new labor schedule item. Form for trade, company, start/end dates, status, release settings, cost code, notes. Inserts into `sub_schedule`. | Active, functional | **Adapt** — form structure is sound but will need to align with new type definitions. |
| `/schedule/sub/[id]/edit` | Edit an existing labor schedule item. "Release Now" and "Mark Confirmed" inline actions. Writes `confirmed_date` on confirm. | Active, functional | **Adapt** — state machine logic here (release/confirm) needs to move to a shared utility, not live in the page. |
| `/schedule/order/new` | Create a new material/procurement item. Calculates `order_by_date` from `required_on_site_date - lead_days`. Allows linking to a labor schedule via `linked_schedule_id`. | Active, functional | **Adapt** — date calculation logic is inline and duplicated; must be extracted before the new module ships. |
| `/schedule/order/[id]/edit` | Edit an existing procurement item. Shows calculated "Order by date" as read-only field (but allows override). | Active, functional | **Adapt** — same calculation duplication issue as `/order/new`. |
| `/jobs/[id]` (schedule tab) | Per-job labor schedule list. Inline Release/Unrelease/Confirm buttons that write directly to Supabase from the tab component. | Active, functional | **Adapt** — direct Supabase calls inside `JobTabs.tsx` need to move to server actions or a shared data layer. |
| `/jobs/[id]` (procurement tab) | Per-job material schedule list. Shows `order_by_date` risk flags inline. | Active, functional | **Adapt** — same direct-DB concern as schedule tab. |
| No `/schedule/templates/*` route exists | — | Not present | **Leave alone** — nothing to deprecate here; new module can define this path cleanly. |
| No Gantt / calendar / timeline route exists | — | Not present | **Leave alone** — no partial implementation to conflict with. |

**Files:**
- `src/app/schedule/page.tsx` (585 lines)
- `src/app/schedule/sub/new/page.tsx` (542 lines)
- `src/app/schedule/sub/[id]/edit/page.tsx` (728 lines)
- `src/app/schedule/order/new/page.tsx` (766 lines)
- `src/app/schedule/order/[id]/edit/page.tsx` (877 lines)
- `src/app/jobs/[id]/page.tsx` (644 lines)
- `src/app/jobs/[id]/JobTabs.tsx` (2304 lines)

---

## B. Existing Types / Data Helpers

### Types in `src/lib/db.ts`

| Item | What It Does | Relevance | Recommendation |
|------|-------------|-----------|----------------|
| `JobSubSchedule` (lines 35–49) | Core labor schedule type. Fields: `id`, `status`, `start_date`, `end_date`, `trade`, `sub_name`, `notes`, `cost_code`, `is_released`, `release_date`, `notification_window_days`. | Direct — this IS the current schedule entity. | **Adapt** — missing `confirmed_date` (written in updates but absent from the type), and missing `job_id`. Type is incomplete. |
| `ProcurementItem` (lines 51–68) | Core material schedule type. Fields: `id`, `status`, `order_by_date`, `required_on_site_date`, `description`, `trade`, `vendor`, `lead_days`, `cost_code`, `procurement_group`, `linked_schedule_id`, `is_client_supplied`, `is_sub_supplied`, `requires_tracking`. | Direct — this IS the current procurement entity. | **Adapt** — boolean responsibility flags (`is_client_supplied`, `is_sub_supplied`, `requires_tracking`) are structurally problematic; a single `source` enum would be cleaner. |
| `ScheduleRiskLevel` (line 32) | `'none' \| 'soon' \| 'overdue'` | Used throughout UI and logic. | **Reuse** — naming is correct; thresholds will need to become configurable. |
| `OrderRiskLevel` (line 33) | `'none' \| 'soon' \| 'overdue'` | Used throughout UI and logic. | **Reuse** — same comment as above. |
| `JobWithDetails` (lines 70–75) | Job type with nested `sub_schedule: JobSubSchedule[]` and `procurement_items: ProcurementItem[]`. | Used in job detail page load. | **Adapt** — nested arrays are fine for read; write path should not go through this aggregate. |

### Functions in `src/lib/db.ts`

| Function | What It Does | Relevance | Recommendation |
|----------|-------------|-----------|----------------|
| `getScheduleRiskLevel()` (lines 98–124) | Calculates schedule risk given `start_date`, `status`, `is_released`, `notification_window_days`. Hardcoded 7-day threshold for released-but-unconfirmed. | Core logic for risk UI. | **Adapt** — thresholds are hardcoded literals; need to be constants or config. Logic itself is sound. |
| `getOrderRiskLevel()` (lines 126–139) | Calculates procurement risk given `order_by_date`, `status`, `requires_tracking`. Hardcoded 7-day threshold. | Core logic for risk UI. | **Adapt** — same hardcoded threshold issue. |
| `getJobWithDetails()` (lines 168–215) | Fetches job with nested `sub_schedule` and `procurement_items` via Supabase. | Used by `/jobs/[id]/page.tsx`. | **Adapt** — query is not typed against database schema; as schedule module grows, this will become a bottleneck. |
| `getCompanies()` (lines 217–247) | Fetches company list. | Indirectly relevant (companies are assigned to schedule items). | **Leave alone** |

### Inline Queries (Not in `db.ts`)

| Location | What It Does | Recommendation |
|----------|-------------|----------------|
| `src/app/schedule/page.tsx` lines 182–200 | Queries `sub_schedule` joined to `jobs(id, client_name, color)`, ordered by `start_date`. Queries `procurement_items` joined to `jobs`, ordered by `order_by_date`. | **Adapt** — these queries should move into `db.ts` or a dedicated data layer. |
| `src/app/jobs/[id]/JobTabs.tsx` lines 575–640 | Direct `supabase.update()` calls for release, unrelease, confirm actions. | **Adapt** — write operations should not live in a display component. |

---

## C. Existing Logic That Could Conflict

### 1. `order_by_date` Calculation — Duplicated in Three Places

- **Files:**
  - `src/app/schedule/order/new/page.tsx` lines 222–235
  - `src/app/schedule/order/[id]/edit/page.tsx` lines 320–333
  - Display logic in `src/app/schedule/page.tsx` (reads pre-calculated field)
- **Logic:** `order_by_date = required_on_site_date - lead_days` using native `Date.setDate()`.
- **Conflict Risk:** HIGH
- **Why it matters:** If the new schedule engine computes or stores `order_by_date` differently (e.g., business days, or derives it server-side), these three client-side calculations will produce divergent values. Any procurement item edited via the old form will silently overwrite engine-computed dates.

### 2. Release/Confirmation State Machine — Duplicated Across Two Files

- **Files:**
  - `src/app/jobs/[id]/JobTabs.tsx` lines 575–640 (release, unrelease, confirm inline)
  - `src/app/schedule/sub/[id]/edit/page.tsx` lines 235–303 (same transitions in edit form)
- **Conflict Risk:** HIGH
- **Why it matters:** There are two independent code paths for state transitions on the same `sub_schedule` rows. If the new module adds a third path (e.g., bulk release, schedule engine trigger), all three can diverge. The state machine is not in a shared location.

### 3. Risk Thresholds — Hardcoded in `db.ts`

- **File:** `src/lib/db.ts` lines 119, 137
- **Values:** 7 days for released-unconfirmed and 7 days for order-by proximity; 14 days default `notification_window_days` in create form.
- **Conflict Risk:** MEDIUM
- **Why it matters:** If the schedule engine introduces configurable lead buffers or per-trade risk windows, these hardcoded values will produce incorrect risk levels for schedule items managed by the new engine.

### 4. Labor-to-Material Link — No Cascading, No Constraint Enforcement

- **Files:**
  - `src/app/schedule/order/new/page.tsx` lines 145–169
  - `src/app/schedule/order/[id]/edit/page.tsx` lines 241–267
- **Conflict Risk:** MEDIUM
- **Why it matters:** `linked_schedule_id` is written but never read back to enforce date alignment. If the new schedule engine introduces dependency graph semantics (material must arrive before labor starts), existing data has no validated links. Any engine traversal will find dangling or invalid relationships.

### 5. Status Enumerations — Defined Inline, Not Shared

- **Files:**
  - Labor statuses (`tentative`, `scheduled`, `confirmed`, `on_site`, `complete`, `cancelled`) scattered across `sub/new/page.tsx`, `sub/[id]/edit/page.tsx`, `JobTabs.tsx`
  - Procurement statuses (`Pending`, `Ordered`, `Confirmed`, `Will Call`, `Delivered`, `Issue`) scattered across `order/new/page.tsx`, `order/[id]/edit/page.tsx`
- **Conflict Risk:** MEDIUM
- **Why it matters:** No single source of truth for valid status values. New module introducing a status (e.g., `released_pending_confirm`) would require editing every file that defines these inline arrays.

### 6. `activeScheduleItems` / `openProcurementItems` Calculations — In Page Component

- **File:** `src/app/jobs/[id]/page.tsx` lines 309–318
- **Conflict Risk:** LOW-MEDIUM
- **Why it matters:** Counts and derived booleans computed directly in the page component. If the new module owns the definition of "active" or "open," page-level calculations will disagree.

### 7. Dashboard Risk Aggregation — Parallel Risk Logic

- **File:** `src/app/page.tsx` lines 82–137
- **Conflict Risk:** MEDIUM
- **Why it matters:** The dashboard independently queries and aggregates schedule risk, mirroring the logic in `/schedule/page.tsx`. Two places computing the same risk view means two places to update when the schedule engine changes risk semantics.

---

## D. Existing UI / Libraries

### Installed Packages

| Package | Current Use | Helps? |
|---------|------------|--------|
| `next` 16.2.1 | App framework | Neutral — no schedule-specific use |
| `react` 19.2.4 | UI framework | Neutral |
| `@supabase/supabase-js` ^2.100.1 | Direct DB access from client and server | Neutral — data layer works but queries are scattered |
| `tailwindcss` ^4 | Styling | Neutral |
| **No calendar library** | — | **Missing** — nothing installed for calendar views |
| **No Gantt library** | — | **Missing** — nothing installed for Gantt views |
| **No drag-and-drop library** | — | **Missing** — nothing installed for reordering |
| **No graph/DAG library** | — | **Missing** — nothing installed for dependency graphs |
| **No date math library** | — | **Missing** — native `Date` only; no `date-fns`, `dayjs`, or `moment` |

### Existing UI Components

| Component / Pattern | Current Use | Helps? |
|--------------------|-------------|--------|
| Inline style functions (`badgeStyle`, `labelStyle`, `inputStyle`, `tdStyle`, etc.) | Defined locally in each page file — not exported. | **Does not help** — these are not shared components; they look reusable but are copy-pasted per file. |
| Risk alert card pattern (`src/app/schedule/page.tsx` lines 286–357) | Summary cards for overdue/soon counts with individual alert rows. | **Partially helpful** — the pattern is worth extracting, but is currently inline HTML. |
| Trade dropdown with search (`src/app/schedule/sub/new/page.tsx` lines 251–422 area) | Inline implementation in each create/edit form. | **Does not help** — repeated pattern but not a component. |
| Status badge pattern (`JobTabs.tsx` `getScheduleBadge()`, `getProcurementSourceBadge()`) | Color-coded status labels. | **Reuse** — these two functions are the most self-contained pieces. |
| Table structure in `/schedule/page.tsx` | Two-table layout (labor + material) with job color indicator column. | **Adapt** — table structure is serviceable but columns will change with new module. |

---

## E. Likely Migration / Deprecation Risks

### 1. Parallel Schedule Systems Risk
The `/schedule` page and the `/jobs/[id]` schedule tab are independently functional views of the same data. If the new schedule module introduces a third data path (e.g., a schedule engine service), all three surfaces will need simultaneous updates. There is no shared data hook or server action they currently route through.

### 2. Hidden Date Logic
`order_by_date` is calculated in the browser via `new Date().setDate()` in two separate form files. This logic is invisible to any server-side schedule engine. If the engine ever needs to own date calculations, there is no single place to update.

### 3. `confirmed_date` Phantom Field
`confirmed_date` is written during confirm actions in `JobTabs.tsx` and `sub/[id]/edit/page.tsx`, but it does not appear in the `JobSubSchedule` type in `db.ts`. Any TypeScript code reading schedule items will not see this field, yet it exists in the database. This is a silent data gap.

### 4. Route Duplication Risk
If a new `/more/templates/schedule` route is created, it will need to clearly not conflict with `/schedule/sub/new` and `/schedule/order/new`. The current routes serve both creation and one-off editing. Template-based creation would need to either fork these routes or replace them, and there is currently no structural separation.

### 5. Confusing Terminology — `sub_schedule` vs. "Labor Schedule"
The database table is named `sub_schedule`. The UI calls it "Labor Schedule." The types call it `JobSubSchedule`. Three different terms for the same concept across three layers. The new module needs to pick one term and migrate the others; leaving all three will make the codebase harder to reason about.

### 6. Direct Supabase Writes in Display Components
`JobTabs.tsx` contains `supabase.from('sub_schedule').update(...)` calls directly inside a UI tab component (lines 575–640). This pattern will conflict with any future schedule engine that needs to intercept or validate state transitions. The new module cannot insert itself into the write path without refactoring `JobTabs.tsx`.

### 7. Boolean Source Flags vs. Enum
`is_client_supplied`, `is_sub_supplied`, and `requires_tracking` are three independent boolean columns on `procurement_items`. The UI treats them as mutually exclusive options (a dropdown), but the database does not enforce this. If the schedule engine queries "who is responsible for this material," it will get ambiguous results from any rows where multiple flags are true.

### 8. Hardcoded Risk Thresholds in Shared Utility
`db.ts` is the closest thing to a shared utility, but its risk functions use hardcoded day values. Any team wanting to tune risk windows for different trades or job types will have to change core utility code.

---

## F. Open Questions Based on Repo Reality

1. **`confirmed_date` is written to the database but absent from `JobSubSchedule` in `db.ts`. Is this intentional, and what is the authoritative field list for `sub_schedule` rows?**

2. **`order_by_date` is currently client-calculated. When the schedule engine owns this value, should existing rows be backfilled, or will the engine recalculate on every read? The edit form allows manual override — does that intent survive in the new model?**

3. **`linked_schedule_id` on `procurement_items` implies a dependency relationship (material needed before or at labor start), but no code currently enforces or reads this constraint. Is this field meant to power the new dependency graph, or is it just an informational annotation?**

4. **The three boolean flags (`is_client_supplied`, `is_sub_supplied`, `requires_tracking`) appear to encode a single `source` concept. Before the new module extends procurement logic, does the team want to migrate these to an enum column, or is the boolean structure intentional?**

5. **The status enumerations for `sub_schedule` and `procurement_items` are defined inline in form files. Should the new module own these enumerations as a single exported constant (e.g., `SCHEDULE_STATUSES`, `PROCUREMENT_STATUSES`), and if so, should existing statuses change?**

6. **`JobTabs.tsx` makes direct Supabase writes for release/confirm actions. Before the schedule engine ships, does the team want to extract these to server actions, or will the engine own the write path entirely and the tab just become a read view?**

7. **The dashboard (`src/app/page.tsx`) independently aggregates schedule risk in lines 82–137, mirroring `/schedule/page.tsx`. Should risk aggregation be driven by a single shared server function after the new module ships, or is the dashboard intentionally a separate computation?**

8. **No date math library is installed. The new module's dependency graph calculations (lead days, buffer days, cascade dates) — should these use native `Date`, or is the team open to adding `date-fns` or `dayjs` for business-day calculations?**
