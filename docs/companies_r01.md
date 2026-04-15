# Companies V1 — Implementation Record

**Branch:** `claude/audit-company-directory-ui-EGTzy`
**Date:** 2026-04-15

---

## Files Changed

### Modified
| File | Change |
|---|---|
| `src/lib/db.ts` | Removed stale company types and helpers: `CompanyCompliance`, `CompanyType`, `CompanyRow`, `getCompanyCompliance`, `getCompanies`. None had any callers; removal is clean. |

### Created
| File | Purpose |
|---|---|
| `src/lib/companies.ts` | Canonical company module. All types, query helpers, and display utilities for the companies feature. |
| `src/app/more/companies/page.tsx` | Searchable company list. Replaced static placeholder with live data, search input, filter pills (All / Subs / Vendors / Service), and admin Add button. |
| `src/app/more/companies/new/page.tsx` | Create company form. Fields: company_name, type checkboxes, phone, email, primary_address, billing_same_as_primary, billing_address. Saves to `companies` table, redirects to detail page on success. |
| `src/app/more/companies/[id]/page.tsx` | Company detail page. Four sections: Info, Contacts, Trades, Compliance. |

---

## Schema Assumptions Used

### `companies` table
Columns used — as specified:
```
id                      uuid (PK)
company_name            text (not null)
is_vendor               boolean
is_subcontractor        boolean
is_service_company      boolean
primary_address         text (nullable)
billing_same_as_primary boolean
billing_address         text (nullable)
phone                   text (nullable)
email                   text (nullable)
is_active               boolean
created_at              timestamptz (nullable)
```
Old columns (`name`, `type`, `coi_gl_expires`, `coi_wc_expires`, `w9_received_at`, `general_contract_signed_at`) are intentionally not referenced.

### `company_contacts` table
Assumed schema (not confirmed from code — no prior references found):
```
id           uuid (PK, DB-generated)
company_id   uuid (FK → companies.id)
name         text (not null)
position     text (nullable)
phone        text (nullable)
email        text (nullable)
created_at   timestamptz (nullable)
```

### `company_trade_assignments` table
Assumed schema:
```
company_id   uuid (FK → companies.id)
trade_id     uuid (FK → trades.id)
```
`setCompanyTrades` deletes all rows for the company then inserts the new set. Assumes no additional constraints beyond the two FK columns.

### `company_compliance_documents` table
Assumed schema:
```
id           uuid (PK)
company_id   uuid (FK → companies.id)
doc_type     text — values: 'coi_gl' | 'coi_wc' | 'w9' | 'general_contract'
expires_at   date (nullable — used for coi_gl, coi_wc; null for w9 and general_contract)
created_at   timestamptz (nullable — treated as received_at for display)
```
No `storage_path` is read or written in V1. The compliance section is read-only.

### Trades
Uses existing `trades` table via `fetchActiveTrades` from `src/lib/trades.ts`. No changes to that table or helper.

### Admin check
Uses existing `internal_access` table pattern (`is_admin`, `is_active` on `profile_id`), consistent with `src/app/more/trades/page.tsx`.

---

## Intentionally Deferred

| Item | Reason |
|---|---|
| Compliance document upload / management | No `company-files` storage bucket exists yet. V1 compliance section is read-only — shows doc type status (OK / Expiring / Expired / Missing) from existing rows. |
| Inactive company toggle in list | Companies are shown with "Inactive" label in list but there is no filter to hide them. Deferred — small dataset, acceptable to show all for now. |
| Company delete | Destructive operation; needs confirmation modal and cascade consideration. Deferred to admin tooling slice. |
| Schedule / procurement rewiring | `sub_name` and `vendor` free-text fields remain unchanged. Wiring these to company FK lookups is a separate slice. |
| RPC `get_company_compliance` | Old RPC relied on legacy date columns on `companies`. Not called in V1 — compliance status is derived client-side from `company_compliance_documents` rows. RPC can be dropped from DB when confirmed unused. |
| `billing_address` free-text | Stored as a single text field. No address parsing or validation. |
| Contact roles enum | `position` is free text. The decisions.md lists formal role types (Admin, Bookkeeping, PM, etc.). Converting to a select is a low-priority polish item. |

---

## Next Slice

**Companies V2 — Compliance Document Upload**

1. Create `company-files` Supabase Storage bucket (or reuse `job-files` with a `companies/{company_id}/` path prefix).
2. Add upload UI to the Compliance section of the detail page.
3. On upload: insert a row into `company_compliance_documents` with `doc_type`, `expires_at` (date picker), and `storage_path`.
4. Add signed-URL download link to each compliance doc row.
5. Add expiry alert logic: query companies with COI expiring within 14 days for the dashboard or a dedicated admin view.

**Companies V3 — Schedule / Procurement Integration**

Replace `sub_name` (sub_schedule) and `vendor` (procurement_items) free-text inputs with company lookup selectors backed by the `companies` table. Requires V1 to be populated with real data first.
