# Slice 25 — RLS and Service-Role Audit

**Status:** Completed  
**Date:** 2026-05-04  
**Branch:** dev  
**Type:** Audit only — no application code changed

---

## 1. Files Inspected

| File | Purpose |
|---|---|
| `src/utils/supabase/admin.ts` | Admin/service-role client factory |
| `src/utils/supabase/server.ts` | User-facing session client factory |
| `src/lib/access-control-server.ts` | Permission guard helper (`requireModuleAccess`) |
| `src/app/actions/estimate-actions.ts` | Estimate CRUD actions |
| `src/app/actions/worksheet-item-actions.ts` | Worksheet item mutations |
| `src/app/actions/proposal-actions.ts` | Proposal lifecycle mutations |
| `src/app/actions/document-actions.ts` | Proposal document + send actions |
| `docs/actions/slices/slice_21_job_worksheet_items_rls.md` | RLS enforcement context |
| `docs/actions/slices/slice_23_send_validation.md` | Send validation context |
| `docs/actions/slices/slice_24_estimate_permissions.md` | Permission guard context |

---

## 2. Client Factory Summary

### `createClient()` — `src/utils/supabase/server.ts`

- Uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the anon/publishable key).
- Creates a session-aware server client using the request cookie store.
- Supabase resolves the calling user from the session JWT.
- **RLS applies** based on the user's `auth.uid()`.
- All `is_internal()` and other policy predicates run against the authenticated user.

### `createAdminClient()` — `src/utils/supabase/admin.ts`

- Uses `SUPABASE_SECRET_KEY` (the service role key).
- No session, no user context, no `auth.uid()`.
- **Bypasses ALL RLS policies.**
- Any table read or write via this client is invisible to RLS predicates.
- Used only in `access-control-server.ts` and `pricing-access-actions.ts` — both for permission metadata reads, not data mutations.

---

## 3. Mutation Path Inventory

### 3a. `estimate-actions.ts`

All actions use `createClient()` for data operations → **RLS applies**.  
All now have `requireModuleAccess` via `createAdminClient()` for permission metadata lookup → **correct and intentional**.

| Action | Data client | RLS | Permission guard | Additional guard | RPC |
|---|---|---|---|---|---|
| `getEstimatesForJob` | `createClient()` | ✓ | `view` | — | No |
| `createEstimate` | `createClient()` | ✓ | `manage` | — | No |
| `setActiveEstimate` | `createClient()` | ✓ | `manage` | — | **Yes** — `set_active_estimate` |
| `archiveEstimate` | `createClient()` | ✓ | `manage` | status check | No |
| `duplicateEstimate` | `createClient()` | ✓ | `manage` | — | No |
| `importEstimate` | `createClient()` | ✓ | `manage` | — | No |
| `renameEstimate` | `createClient()` | ✓ | `manage` | `isEstimateEditable()` | No |

**`set_active_estimate` RPC**: Called via the user-facing client. DB function source is not available in the repository. Whether it is `SECURITY DEFINER` cannot be confirmed from code alone. **DB inspection required.**

---

### 3b. `worksheet-item-actions.ts`

All actions use `createClient()` for data operations → **RLS applies**.  
All have `requireModuleAccess` (manage) + `requireEditableEstimate()`. RLS on `job_worksheet_items` also enforces editability at the DB layer (Slice 21).

| Action | Data client | RLS | Permission guard | Editability guard | RPC |
|---|---|---|---|---|---|
| `persistWorksheetRow` | `createClient()` | ✓ | `manage` | `requireEditableEstimate()` + RLS | No |
| `createWorksheetRow` | `createClient()` | ✓ | `manage` | `requireEditableEstimate()` + RLS | No |
| `restoreWorksheetRows` | `createClient()` | ✓ | `manage` | `requireEditableEstimate()` + RLS | No |
| `deleteWorksheetRow` | `createClient()` | ✓ | `manage` | `requireEditableEstimate()` + RLS | No |
| `persistWorksheetSortOrders` | `createClient()` | ✓ | `manage` | `requireEditableEstimate()` + RLS | No |

**Assessment: Worksheet mutations are the most defensively guarded path in the codebase — app-layer permission, app-layer editability, and DB-layer RLS all apply.**

---

### 3c. `proposal-actions.ts`

All actions use `createClient()` for data operations → **RLS applies**.  
**No `requireModuleAccess` guards on any action.**  
State guards are present (status checks) but are not permission guards.

| Action | Data client | RLS | Permission guard | State guard | Mutates |
|---|---|---|---|---|---|
| `getProposalStructure` | `createClient()` | ✓ | **NONE** | auth only | No — read |
| `saveProposalStructure` | `createClient()` | ✓ | **NONE** | `locked_at` check | Yes — `proposal_structures` |
| `lockProposal` | `createClient()` | ✓ | **NONE** | `proposal_status = 'draft'` check | Yes — `estimates` + `proposal_structures` |
| `unlockProposal` | `createClient()` | ✓ | **NONE** | `proposal_status = 'sent'` check | Yes — `estimates` + `proposal_structures` |
| `signProposal` | `createClient()` | ✓ | **NONE** | `proposal_status = 'sent'` check | Yes — `proposal_structures` |
| `voidProposal` | `createClient()` | ✓ | **NONE** | `proposal_status IN ('sent','signed')` check | Yes — `estimates` + `proposal_structures` |

**`lockProposal` note**: This function locks both the `estimates` and `proposal_structures` tables simultaneously using two separate UPDATE statements — not atomic. It is not currently called from any UI path (the "Send proposal" button calls `sendProposal` instead), but it remains exported and callable. It was not deleted.

---

### 3d. `document-actions.ts`

All actions use `createClient()` for data operations → **RLS applies for direct table writes**.  
**No `requireModuleAccess` guards on any action.**

| Action | Data client | RLS | Permission guard | State guard | RPC | Notes |
|---|---|---|---|---|---|---|
| `createProposalSnapshot` | `createClient()` | ✓ | **NONE** | active estimate check | No | Creates `proposal_documents` row |
| `sendProposal` | `createClient()` (data reads) | ✓ (reads) | **NONE** | status check + validation | **Yes** — `send_proposal` (SECURITY DEFINER) | See §4 |
| `voidProposalDocument` | `createClient()` | ✓ | **NONE** | `job_id` ownership check | No | Voids document row |

---

## 4. SECURITY DEFINER and RPC Findings

### `send_proposal` — **CRITICAL**

- Called in `sendProposal` via `auth.supabase.rpc('send_proposal', { ... })`.
- The calling client is `createClient()` — user session is passed with the request.
- **However**: `send_proposal` is documented as `SECURITY DEFINER` (Slice 16 report).
- `SECURITY DEFINER` means the function runs with the **owner's privileges**, not the calling user's.
- Inside the function, `auth.uid()` is not the calling user — it is the function owner (typically the `postgres` role or service role).
- Consequence: **the three writes inside `send_proposal` (UPDATE estimates, UPSERT proposal_structures, INSERT proposal_documents) execute with RLS bypassed.**
- The function receives `p_user_id` as a parameter and writes it to lock fields — this is audit tracking, not an RLS enforcement mechanism.
- **Any authenticated internal user can call `send_proposal` for any estimate/job.** The only application-layer gates before the RPC are:
  1. `requireUser()` — confirms auth session exists
  2. Active estimate check — `status = 'active'`
  3. `validateEstimateForSend()` — pricing/quantity validation
  4. `proposal_status = 'draft'` pre-check
- **No permission guard (`requireModuleAccess`) exists before the RPC call.**
- The Postgres function validates estimate ownership (`p_job_id`) and status internally, but this is a business-rule check, not a permission check.

### `set_active_estimate`

- Called in `setActiveEstimate` via `auth.supabase.rpc('set_active_estimate', { ... })`.
- DB function source is not present in the repository.
- **Cannot confirm SECURITY DEFINER status from code alone.**
- If `SECURITY DEFINER`: RLS is bypassed inside the function for all writes.
- **DB inspection required** before this path can be classified.

### `requireModuleAccess`

- Uses `createAdminClient()` to read permission metadata tables.
- Reads only: `internal_access`, `permission_rows`, `user_permission_snapshots`, `template_permissions`.
- **No data mutations via admin client.**
- Admin client usage here is appropriate and deliberate — permission tables are internal admin-managed tables, not user-data tables.
- This is the correct pattern and consistent with how `pricing-access-actions.ts` works.

---

## 5. Permission Guard Summary

| Action | File | Has `requireModuleAccess` |
|---|---|---|
| `getEstimatesForJob` | `estimate-actions.ts` | ✓ `view` |
| `createEstimate` | `estimate-actions.ts` | ✓ `manage` |
| `setActiveEstimate` | `estimate-actions.ts` | ✓ `manage` |
| `archiveEstimate` | `estimate-actions.ts` | ✓ `manage` |
| `duplicateEstimate` | `estimate-actions.ts` | ✓ `manage` |
| `importEstimate` | `estimate-actions.ts` | ✓ `manage` |
| `renameEstimate` | `estimate-actions.ts` | ✓ `manage` |
| `persistWorksheetRow` | `worksheet-item-actions.ts` | ✓ `manage` |
| `createWorksheetRow` | `worksheet-item-actions.ts` | ✓ `manage` |
| `restoreWorksheetRows` | `worksheet-item-actions.ts` | ✓ `manage` |
| `deleteWorksheetRow` | `worksheet-item-actions.ts` | ✓ `manage` |
| `persistWorksheetSortOrders` | `worksheet-item-actions.ts` | ✓ `manage` |
| `getProposalStructure` | `proposal-actions.ts` | **✗ NONE** |
| `saveProposalStructure` | `proposal-actions.ts` | **✗ NONE** |
| `lockProposal` | `proposal-actions.ts` | **✗ NONE** |
| `unlockProposal` | `proposal-actions.ts` | **✗ NONE** |
| `signProposal` | `proposal-actions.ts` | **✗ NONE** |
| `voidProposal` | `proposal-actions.ts` | **✗ NONE** |
| `createProposalSnapshot` | `document-actions.ts` | **✗ NONE** |
| `sendProposal` | `document-actions.ts` | **✗ NONE** |
| `voidProposalDocument` | `document-actions.ts` | **✗ NONE** |

---

## 6. Risks Ranked

### HIGH

**H1 — `sendProposal` calls SECURITY DEFINER RPC with no permission guard**  
- `send_proposal` RPC is `SECURITY DEFINER` → RLS bypassed inside the function for all three writes.
- `sendProposal` server action has no `requireModuleAccess` guard.
- Any authenticated internal user can send any job's proposal.
- The three internal writes (lock estimate, transition proposal, insert document) run with elevated privileges regardless of who is calling.

**H2 — `lockProposal` has no permission guard and is non-atomic**  
- Any authenticated internal user can lock any estimate and proposal.
- The lock is executed as two separate UPDATE statements — if the second fails, the estimate may be locked without the proposal transitioning.
- `lockProposal` is deprecated in practice (UI calls `sendProposal`) but remains exported.

**H3 — `unlockProposal`, `signProposal`, `voidProposal` have no permission guards**  
- Irreversible or high-impact state transitions available to any authenticated internal user.
- `signProposal` is explicitly irreversible.
- `voidProposal` on a `signed` proposal leaves the estimate permanently locked.

### MEDIUM

**M1 — `saveProposalStructure` has no permission guard**  
- Any internal user can overwrite proposal section structure for any estimate.
- Protected only by auth and `locked_at` status check.

**M2 — `createProposalSnapshot` has no permission guard**  
- Creates permanent rows in `proposal_documents` for any job the user can reach via RLS.
- No role check before document creation.

**M3 — `voidProposalDocument` has no permission guard**  
- Any internal user can void any document they can reach.
- Verified only against `job_id` match, not user role.

**M4 — `set_active_estimate` RPC SECURITY DEFINER status unknown**  
- Function source not in repo; cannot confirm privilege model.
- If SECURITY DEFINER: same bypass risk as `send_proposal`.
- Requires DB inspection.

**M5 — `requireModuleAccess` adds 3–4 admin-client queries per guarded call**  
- Worksheet autosave path runs at keystroke debounce frequency.
- Latency may be acceptable today but will not scale without caching.

### LOW

**L1 — `lockProposal` remains exported but has no UI path**  
- Callable by any code that imports the module.
- Should be deleted or formally deprecated with a guard if retained.

**L2 — `pricing-access-actions.ts` does not check `is_admin`**  
- Inconsistency with `requireModuleAccess` which does check admin bypass.
- Admins are not granted implicit access on pricing paths through that helper.

---

## 7. Recommended Next Slices

### Slice 26 — Proposal and document action permission guards

Apply `requireModuleAccess('estimates', 'manage')` to all mutating actions in `proposal-actions.ts` and `document-actions.ts`:
- `saveProposalStructure`
- `lockProposal`
- `unlockProposal`
- `signProposal`
- `voidProposal`
- `sendProposal`
- `createProposalSnapshot`
- `voidProposalDocument`

Apply `requireModuleAccess('estimates', 'view')` to `getProposalStructure`.

This is a direct parallel to Slice 24's pattern and should be low-risk.

### Slice 27 — SECURITY DEFINER application-level ownership guard for `sendProposal`

Because `send_proposal` is `SECURITY DEFINER`, RLS does not enforce ownership inside the function. The server action must enforce that the calling user is permitted to send this specific job's proposal before the RPC is called. This requires:

1. Verifying the job exists and belongs to the expected scope (already partially done via job fetch).
2. Confirming the user's permission guard (`requireModuleAccess`) is in place (covered by Slice 26).
3. Optionally: verifying the user has explicit access to the specific job (job-scoped permissions if they exist in future).

Additionally: evaluate whether `lockProposal` should be deleted (it is not called from any UI path).

### Slice 28 — DB inspection of `set_active_estimate` RPC privilege model

Inspect the `set_active_estimate` Postgres function source in the database:
- If `SECURITY DEFINER`: add application-level ownership and status validation before the RPC call in `setActiveEstimate`.
- If `SECURITY INVOKER`: RLS applies — document that finding and close the gap.
- Either way: document the privilege model so future maintainers do not need to re-investigate.

---

## 8. Intentionally Not Changed

- No application code modified
- No RLS policies modified
- No database functions modified
- No schema changes
- No UI changes
- Pricing, scheduling, and non-estimate modules not inspected
