# Company Audit — R1

**Branch:** `dev`
**Date:** 2026-04-11

---

## A. Company-Related Files

| File | Role |
|---|---|
| `src/lib/db.ts` | Core types (`CompanyRow`, `CompanyType`, `CompanyCompliance`) and query helpers (`getCompanies`, `getCompanyCompliance`) |
| `src/app/more/companies/page.tsx` | Placeholder Companies page — describes future behavior, no live data wired |
| `src/app/more/page.tsx` | Navigation link to `/more/companies` |
| `src/app/jobs/new/actions.ts` | Inserts `company_name` (free text) into `job_clients` table |
| `src/app/jobs/new/JobForm.tsx` | Free text input for `company_name` when client type is "Company" |
| `src/app/jobs/[id]/page.tsx` | Reads `company_name` from `job_clients` via Supabase select |
| `src/app/jobs/[id]/JobTabs.tsx` | Displays `sub_name` (schedule) and `vendor` (procurement) as plain text |
| `src/app/schedule/sub/new/page.tsx` | Free text input labeled "Assigned Company" → stored as `sub_name` |
| `src/app/schedule/sub/[id]/edit/page.tsx` | Same free text for `sub_name` on edit |
| `src/app/schedule/order/new/page.tsx` | Free text input labeled "Company" → stored as `vendor` |
| `src/app/schedule/order/[id]/edit/page.tsx` | Same free text for `vendor` on edit |
| `src/app/schedule/page.tsx` | Displays `sub_name` and `vendor` columns; uses `sub_name` in risk notification copy |
| `src/app/page.tsx` | Reads `sub_name` and `vendor` for dashboard schedule risk notifications |
| `src/components/FilesTab.tsx` | `companies_visible` / `company_scope` file visibility flags (separate concept — see note) |
| `src/app/api/files/list/route.ts` | Reads `companies_visible` / `company_scope` for file access |
| `src/app/api/files/upload/route.ts` | Writes `companies_visible` / `company_scope` on file upload |
| `src/app/api/files/update/route.ts` | Updates `companies_visible` / `company_scope` on file edit |

---

## B. How Companies Are Currently Used

### 1. `companies` table (canonical company directory)
- Defined in `src/lib/db.ts` with `CompanyRow` type and `getCompanies()` / `getCompanyCompliance()` helpers.
- Has fields: `id`, `name`, `type` (`sub | vendor | both`), `email`, `phone`, `is_active`, compliance dates, `created_at`.
- **Not yet consumed by any live UI.** The `/more/companies` page is a placeholder only.
- `getCompanies()` and `getCompanyCompliance()` are defined but not imported anywhere in the application.

### 2. `sub_name` on `sub_schedule` (labor schedule)
- Free text string. Represents the company or subcontractor assigned to a labor schedule item.
- Set via a plain `<input>` labeled "Assigned Company" in `sub/new` and `sub/[id]/edit`.
- Displayed in `schedule/page.tsx`, `JobTabs.tsx`, and used in notification copy on `page.tsx`.
- Fallback display: `item.sub_name || 'Company TBD'` (JobTabs), `item.sub_name || 'Unassigned company'` (schedule/page).

### 3. `vendor` on `procurement_items` (material schedule)
- Free text string. Represents the supplier/vendor for a material procurement item.
- Set via a plain `<input>` labeled "Company" in `order/new` and `order/[id]/edit`.
- Displayed in `schedule/page.tsx` and `JobTabs.tsx`.

### 4. `company_name` on `job_clients` (client record)
- Free text string. Optionally set when a client is of type `company`.
- Stored in `job_clients` table; not linked to the `companies` table.
- Captured in `JobForm.tsx`, submitted via `actions.ts`, and selected in `jobs/[id]/page.tsx`.

### 5. `companies_visible` / `company_scope` on `job_files` (file permissions)
- Boolean and enum flags controlling which trades/companies can see a file.
- **Unrelated to the companies directory entity.** These control file visibility scopes, not company identity.
- Used consistently across `FilesTab.tsx`, `api/files/upload`, `api/files/update`, `api/files/list`.

---

## C. Inconsistencies Found

### C1 — Two different field names for "assigned company" on work records
- Labor schedule uses `sub_name` (sub_schedule table).
- Procurement uses `vendor` (procurement_items table).
- Both represent the company doing/supplying work on a job. Neither stores a company `id` — both store raw name strings.
- There is also a `is_sub_supplied` flag in procurement that maps to "Company Supplied" material source, mixing "sub" and "company" terminology.

### C2 — `company_name` in `job_clients` is not linked to the `companies` table
- Client companies are stored as free text in `job_clients.company_name`.
- There is no foreign key or lookup against the `companies` table.
- These are likely homeowner/client company names (e.g., "ABC Corp") rather than subs/vendors, but the naming collision with `companies` table is worth noting.

### C3 — `companies` table exists but is entirely unused in the UI
- `getCompanies()` and `getCompanyCompliance()` are importable from `db.ts` but no page or component imports them.
- The only reference to the companies table in the UI is the nav link to the placeholder page.
- This means the `companies` table is currently populated (if at all) through direct DB operations, not through the app.

### C4 — Label/terminology inconsistency in UI
- `sub_name` in sub_schedule is labeled "Assigned Company" in the create form, but column header on `schedule/page.tsx` shows the raw value with no label context.
- `vendor` in procurement is labeled "Company" in create forms, but the DB column is named `vendor`.
- `JobTabs.tsx` shows `sub_name` with fallback "Company TBD" but shows `vendor` with no fallback label.
- The word "company" is used for both subcontractors (labor) and vendors (material suppliers) — these are distinct company types (`sub` vs `vendor`) in the companies table.

### C5 — `CompanyRow` was missing `created_at` (now fixed — see Section D)
- The type did not include `created_at` despite the column existing on the table.
- The `getCompanies()` select query also omitted it.

### C6 — "Company Supplied" option uses `is_sub_supplied` flag
- In `order/new` and `order/[id]/edit`, selecting "Company Supplied" sets `is_sub_supplied: true`.
- The UI label says "Company Supplied" but the DB flag is `is_sub_supplied`, mixing sub/company terminology.
- This is a naming inconsistency between the DB schema and the UI, but touches procurement logic — **do not fix yet**.

---

## D. Type Changes Made in `src/lib/db.ts`

### Added `created_at` to `CompanyRow`

**Before:**
```ts
export type CompanyRow = {
  id: string
  name: string
  type: 'sub' | 'vendor' | 'both'
  email: string | null
  phone: string | null
  is_active: boolean
  coi_gl_expires: string | null
  coi_wc_expires: string | null
  w9_received_at: string | null
  general_contract_signed_at: string | null
}
```

**After:**
```ts
export type CompanyRow = {
  id: string
  name: string
  type: 'sub' | 'vendor' | 'both'
  email: string | null
  phone: string | null
  is_active: boolean
  coi_gl_expires: string | null
  coi_wc_expires: string | null
  w9_received_at: string | null
  general_contract_signed_at: string | null
  created_at: string | null
}
```

Also updated `getCompanies()` select query to include `created_at`.

**Existing fields confirmed present (no changes needed):**
- `id` ✓
- `name` ✓
- `type` ✓ (typed as `'sub' | 'vendor' | 'both'` — more precise than bare `string`, left as-is)
- `created_at` — added

No fields were removed or renamed.

---

## E. Low-Risk Improvements Made

**None made.**

Both the `sub_name` (labor schedule) and `vendor` (procurement) free text inputs were considered as candidates for conversion to company dropdown selectors. However:

1. The `companies` table has no live UI to populate it — it cannot be assumed to have any records.
2. The placeholder `/more/companies` page explicitly describes this as a future migration.
3. Converting either input now would break existing data entry before the company directory is operational.

Per the audit scope, these are listed under risky patterns (Section C, items C1–C4) and deferred until the Company Directory is implemented.

---

## Summary

The system has three distinct "company" concepts that are currently not connected:

| Concept | Where | Storage | Linked to `companies` table? |
|---|---|---|---|
| Assigned subcontractor | `sub_schedule.sub_name` | Free text | No |
| Material vendor | `procurement_items.vendor` | Free text | No |
| Client company name | `job_clients.company_name` | Free text | No |
| Company directory | `companies` table | Structured record | N/A (source) |
| File visibility scope | `job_files.companies_visible` | Boolean flag | No (different concept) |

The `companies` table and its associated types are ready in `db.ts`. The primary work for the Company Directory will be connecting `sub_name` and `vendor` inputs to live company lookups once the directory is populated and the placeholder page is implemented.
