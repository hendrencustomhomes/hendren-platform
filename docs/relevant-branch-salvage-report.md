# Relevant Branch Salvage Report
Date: 2026-04-07

## Branches Compared
- `origin/claude/fix-create-flows-wSrjp` (remote)
- `origin/claude/fix-jobs-address-schema-IAMTE` (remote)
- `claude/audit-reconcile-dev-5piyN` (local)

---

## Relevant Area Analysis

### 1. Procurement create fix — `src/app/schedule/order/new/page.tsx`

| Branch | Different from dev? | Branch better? | Action |
|--------|---------------------|----------------|--------|
| fix-create-flows-wSrjp | YES | PARTIALLY — has functional fix but strips UI features | Targeted edit applied |
| fix-jobs-address-schema-IAMTE | NO | — | None |
| audit-reconcile-dev-5piyN | NO | — | None |

**Dev status before**: Sent `order_by_date` in the `procurement_items` INSERT. This column is `GENERATED ALWAYS AS` in the DB schema; sending any value produces: *"cannot insert a non-DEFAULT value into column order_by_date"*, causing all procurement item creates to fail.

**Fix applied**: Removed `order_by_date` from the insert payload and removed the now-unused `orderByDateValue` calculation block. Dev's richer UI (cost codes, source flags, procurement groups, release settings) was preserved — only the broken DB call was corrected.

---

### 2. Schedule create fix — `src/app/schedule/sub/new/page.tsx`

| Branch | Different from dev? | Branch better? | Action |
|--------|---------------------|----------------|--------|
| fix-create-flows-wSrjp | YES | PARTIALLY — has sub_status fix but strips UI features | Targeted edit applied |
| fix-jobs-address-schema-IAMTE | NO | — | None |
| audit-reconcile-dev-5piyN | NO | — | None |

**Dev status before**: Only sent `status` in the `sub_schedule` INSERT. The table has a `sub_status` enum column; not supplying an explicit value caused inserts to fail when the column default was not a valid enum value.

**Fix applied**: Added `sub_status: form.status` alongside `status` in the insert payload. Dev's richer UI (release toggle, notification window, cost code) was preserved.

---

### 3. Task tab / task creation — `src/app/jobs/[id]/JobTabs.tsx`, `src/app/jobs/[id]/page.tsx`

| Branch | Different from dev? | Branch better? | Action |
|--------|---------------------|----------------|--------|
| fix-create-flows-wSrjp | YES | NO — branch is 276 lines; dev is 2220 lines with full task tab | None |
| fix-jobs-address-schema-IAMTE | YES | NO — branch is ~230 lines; dev is far more complete | None |
| audit-reconcile-dev-5piyN | YES | NO — same stripped-down version | None |

**Dev status**: Already has full task creation UI (job_tasks queries, task status management, Tasks tab with open/in-progress counts). Dev is the definitive version.

---

### 4. jobs.address → jobs.project_address fix — `src/app/jobs/[id]/page.tsx`, `src/app/page.tsx`, `src/app/jobs/page.tsx`, `src/app/jobs/new/page.tsx`

| Branch | Different from dev? | Branch better? | Action |
|--------|---------------------|----------------|--------|
| fix-create-flows-wSrjp | YES (jobs/new only) | NO — branch strips referral_source, client_email, scope_notes from form | None |
| fix-jobs-address-schema-IAMTE | YES (jobs/new only) | NO — same stripped-down version | None |
| audit-reconcile-dev-5piyN | YES (jobs/new only) | NO — same stripped-down version | None |

**Dev status**: All four files already use `project_address` correctly throughout. No fix needed.

---

### 5. Files tab — `src/components/FilesTab.tsx`

| Branch | Different from dev? | Branch better? | Action |
|--------|---------------------|----------------|--------|
| fix-create-flows-wSrjp | YES | NO — branch is 86 lines; dev is 758 lines with full visibility, packet, entity type support | None |
| fix-jobs-address-schema-IAMTE | YES | NO — same stripped-down version | None |
| audit-reconcile-dev-5piyN | YES | NO — same stripped-down version | None |

**Dev status**: Full-featured FilesTab with VisibilityScope, EntityType, category filter, upload flow, display name editing. Dev is the definitive version.

---

## Files Changed on Dev

1. `src/app/schedule/order/new/page.tsx` — removed `order_by_date` from procurement INSERT (generated column fix)
2. `src/app/schedule/sub/new/page.tsx` — added `sub_status` field to sub_schedule INSERT (enum column fix)

Committed as: `913820a` — *fix: stop inserting generated order_by_date column; add sub_status to sub schedule insert*

---

## Branches With No Remaining Relevant Code (Safe to Delete)

All three Claude branches have zero remaining relevant code differences from dev across all 5 areas:

1. **`origin/claude/fix-jobs-address-schema-IAMTE`** — the project_address fix it targeted is already in dev; its stripped-down file versions are inferior to dev's
2. **`claude/audit-reconcile-dev-5piyN`** — same: all relevant files in dev are more complete
3. **`origin/claude/fix-create-flows-wSrjp`** — the two functional bug fixes from this branch have been ported to dev as targeted edits; the stripped-down UI versions it carried are inferior to dev's

All three branches are safe to delete.
