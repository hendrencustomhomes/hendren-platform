# Slice 28 — set_active_estimate RPC Audit

**Status:** Complete — audit only, no code changes  
**Date:** 2026-05-04  
**Branch:** dev

---

## 1. Function Privilege Model

**SECURITY INVOKER**

`set_active_estimate` is NOT `SECURITY DEFINER`. It runs with the calling user's privileges. RLS policies on the `estimates` table apply normally based on `auth.uid()`.

---

## 2. Evidence

Queried `pg_proc` directly via Supabase SQL:

```sql
SELECT
  p.proname,
  p.prosecdef AS is_security_definer,
  p.proowner::regrole AS owner,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'set_active_estimate'
  AND n.nspname = 'public';
```

Result: `is_security_definer = false`

Full function definition as retrieved:

```sql
CREATE OR REPLACE FUNCTION public.set_active_estimate(p_estimate_id uuid, p_job_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE estimates
     SET status     = 'draft',
         updated_at = now()
   WHERE job_id = p_job_id
     AND status  = 'active';

  UPDATE estimates
     SET status     = 'active',
         updated_at = now()
   WHERE id      = p_estimate_id
     AND job_id  = p_job_id;
END;
$function$
```

Owner: `postgres`  
Schema: `public`  
Language: `plpgsql`

---

## 3. Function Behavior

The function performs two UPDATE statements within a single implicit transaction:

1. **Demote** — sets the currently active estimate for the job back to `'draft'`, filtered by `job_id = p_job_id AND status = 'active'`.
2. **Promote** — sets the target estimate to `'active'`, filtered by `id = p_estimate_id AND job_id = p_job_id`.

The `p_job_id` filter on both writes means cross-job manipulation is blocked at the DB level — a caller cannot promote an estimate that does not belong to the supplied job.

The two UPDATEs run atomically within the function call (Postgres functions execute in a transaction). If the second UPDATE fails, the first rolls back — no inconsistent state.

---

## 4. Current Risk Level

**LOW**

| Check | Finding |
|---|---|
| Privilege model | SECURITY INVOKER — RLS applies |
| RLS enforcement | Yes — calling user's `auth.uid()` governs which rows can be updated |
| Application-layer permission | `requireModuleAccess(auth.user.id, 'estimates', 'manage')` is already in place (Slice 24) |
| Auth session guard | `requireUser()` in place |
| Cross-job protection | `p_job_id` filter on both UPDATEs prevents cross-job manipulation |
| Atomicity | Both UPDATEs are in one function call — atomic |

---

## 5. Application-Layer Guard Assessment

The current `setActiveEstimate` implementation in `estimate-actions.ts` is **sufficient**:

```typescript
const auth = await requireUser()
if ('error' in auth) return { error: 'Not authenticated' }

const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'manage')
if (permGuard) return permGuard

const { error } = await auth.supabase.rpc('set_active_estimate', {
  p_estimate_id: estimateId,
  p_job_id: jobId,
})
```

- Permission is gated before the RPC call.
- RLS enforces row-level access inside the function.
- No additional ownership pre-check is required at the application layer — the `p_job_id` filter inside the function and RLS together enforce it.

No code changes are needed.

---

## 6. Contrast with `send_proposal`

For reference, `send_proposal` is `SECURITY DEFINER` (documented in Slice 25). That means RLS is bypassed inside that function, which is why the application-layer `requireModuleAccess` guard added in Slice 26 is critical for `sendProposal`.

`set_active_estimate` is the opposite case — SECURITY INVOKER — so RLS remains active and the existing application-layer guard is sufficient on its own.

---

## 7. Required Follow-up

None from this audit. The gap identified in Slice 25 (M4) is fully resolved:

- Privilege model confirmed: SECURITY INVOKER
- RLS applies inside the function
- Application-layer guard (`manage`) is already in place
- No DB changes required

---

## 8. What Was Not Changed

- `set_active_estimate` DB function — not modified (not needed)
- `estimate-actions.ts` — not modified (already correct)
- RLS policies — not modified
- Any other file — not touched

This was an audit-only slice. No application code was changed.
