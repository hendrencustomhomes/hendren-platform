# Companies V1 — Minimal Audit (R02)

**Branch audited:** `dev`
**Date:** 2026-04-14

---

## Result

**PASS**

---

## Audit Scope

Audited only these files:
- `src/lib/companies.ts`
- `src/app/more/companies/page.tsx`
- `src/app/more/companies/new/page.tsx`
- `src/app/more/companies/[id]/page.tsx`
- `src/lib/db.ts` (scope check only)

Checks performed:
- actual table/column names used by the Companies UI match the migrated Companies V1 shape
- no legacy `companies.type`
- no legacy compliance fields on `companies`
- no use of `company_memberships` as contacts
- no scope drift outside Companies

---

## Findings

### 1. Companies UI uses the migrated Companies table shape
Confirmed usage in `src/lib/companies.ts`:
- table: `companies`
- columns:
  - `id`
  - `company_name`
  - `is_vendor`
  - `is_subcontractor`
  - `is_service_company`
  - `primary_address`
  - `billing_same_as_primary`
  - `billing_address`
  - `phone`
  - `email`
  - `is_active`
  - `created_at`

Confirmed write usage in:
- `src/app/more/companies/new/page.tsx`
- `src/app/more/companies/[id]/page.tsx`

These files write/read the same migrated Companies V1 field set.

### 2. No legacy `companies.type`
No use of legacy `type` on `companies`.

Type behavior is implemented with the current boolean flags only:
- `is_subcontractor`
- `is_vendor`
- `is_service_company`

### 3. No legacy compliance fields on `companies`
No use of legacy compliance columns on `companies`.

No references found in audited files to:
- `coi_gl_expires`
- `coi_wc_expires`
- `w9_received_at`
- `general_contract_signed_at`

Compliance is read from `company_compliance_documents` through `getCompanyComplianceDocs()` in `src/lib/companies.ts`, then displayed in `src/app/more/companies/[id]/page.tsx`.

### 4. No use of `company_memberships` as contacts
Contacts are implemented against `company_contacts`, not `company_memberships`.

Confirmed in `src/lib/companies.ts`:
- `getCompanyContacts()` → `company_contacts`
- `createCompanyContact()` → `company_contacts`
- `updateCompanyContact()` → `company_contacts`
- `deleteCompanyContact()` → `company_contacts`

Confirmed in `src/app/more/companies/[id]/page.tsx`:
- Contacts section uses those `company_contacts` helpers only.

### 5. No scope drift outside Companies
No Companies V1 scope drift found in the audited files.

`src/lib/db.ts` was not expanded for unrelated work. The Companies feature is isolated in `src/lib/companies.ts` and the Companies routes.

---

## Exact Mismatches

None.

---

## Exact Files To Fix

None.

---

## Next

**next: proceed**
