# Slice 26 — Proposal and Document Permission Guards

**Status:** Complete  
**Date:** 2026-05-04  
**Branch:** dev

---

## 1. Files Changed

| File | Change |
|---|---|
| `src/app/actions/proposal-actions.ts` | Added `requireModuleAccess` import + guards to 6 actions |
| `src/app/actions/document-actions.ts` | Added `requireModuleAccess` import + guards to 3 actions |
| `docs/actions/slices/slice_26_proposal_document_permission_guards.md` | This report |

---

## 2. What Changed

### `proposal-actions.ts`

Added `import { requireModuleAccess } from '@/lib/access-control-server'`.

Added permission guard to every exported action, placed immediately after `requireUser()` and before any DB work:

| Action | Level | Guard position |
|---|---|---|
| `getProposalStructure` | `view` | After `requireUser()` |
| `saveProposalStructure` | `manage` | After `requireUser()`, before locked_at check |
| `lockProposal` | `manage` | After `requireUser()`, before status fetch |
| `unlockProposal` | `manage` | After `requireUser()`, before status fetch |
| `signProposal` | `manage` | After `requireUser()`, before status fetch |
| `voidProposal` | `manage` | After `requireUser()`, before status fetch |

All existing status checks, lock checks, and business-rule guards are preserved unchanged.

### `document-actions.ts`

Added `import { requireModuleAccess } from '@/lib/access-control-server'`.

Added permission guard to every exported action:

| Action | Level | Guard position |
|---|---|---|
| `createProposalSnapshot` | `manage` | After `requireUser()`, before job fetch |
| `sendProposal` | `manage` | After `requireUser()`, before job fetch and RPC call |
| `voidProposalDocument` | `manage` | After `requireUser()`, before document fetch |

For `sendProposal`, the guard executes before any data reads and well before the `send_proposal` SECURITY DEFINER RPC is called. This closes the HIGH risk item H1 identified in Slice 25 at the application layer.

---

## 3. Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass — no errors |

---

## 4. Risks / Follow-up

**Addressed in this slice:**
- H1 (Slice 25): `sendProposal` now has a `manage` permission guard before the SECURITY DEFINER RPC.
- H3 (Slice 25): `unlockProposal`, `signProposal`, `voidProposal` are now permission-guarded.
- M1 (Slice 25): `saveProposalStructure` is now permission-guarded.
- M2 (Slice 25): `createProposalSnapshot` is now permission-guarded.
- M3 (Slice 25): `voidProposalDocument` is now permission-guarded.

**Remaining risks (not addressed in this slice):**

1. **H2 (partial) — `lockProposal` non-atomic write:** `lockProposal` is now permission-guarded, closing the access gap. The two-step non-atomic write (lock estimate then lock proposal) still exists. This function has no UI path; cleanup (atomicity or deletion) is a separate concern.

2. **M4 — `set_active_estimate` RPC SECURITY DEFINER status unknown:** Still requires DB inspection (Slice 28).

3. **SECURITY DEFINER RLS bypass (residual):** The `manage` guard on `sendProposal` now ensures only permitted users can reach the RPC. The internal writes inside `send_proposal` still run with elevated privileges — this is the expected behavior of an atomic Postgres function. The application-layer guard is the correct enforcement point.

4. **Latency:** `requireModuleAccess` adds 3–4 admin-client queries per call. Proposal actions are not high-frequency (unlike worksheet autosave), so this is acceptable.

---

## 5. Intentionally Not Changed

- RLS policies — not modified
- Database functions — not modified
- `send_proposal` RPC — not modified (SECURITY DEFINER behavior is intentional)
- `lockProposal` — not deleted (out of scope per task spec)
- `set_active_estimate` RPC — not inspected (out of scope per task spec)
- UI components — not modified
- `requireModuleAccess` contract — unchanged (same `view | manage` interface, same `PermissionRowKey` type)
- `assign` permission — not used (per spec and module_structure design standard)
- Non-estimate modules — not touched
