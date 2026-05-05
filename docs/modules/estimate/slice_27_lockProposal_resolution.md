# Slice 27 — lockProposal Resolution

**Status:** Complete  
**Date:** 2026-05-04  
**Branch:** dev

---

## 1. Decision

**Deleted.**

`lockProposal` was removed from `proposal-actions.ts`.

---

## 2. Reasoning

### Usage search

`grep -rn "lockProposal" src/` returned only two matches — both inside `proposal-actions.ts` itself (the function definition and an internal variable named `lockProposalErr`). No UI component, API route, or other server action imports or calls `lockProposal`.

### Why deletion is correct

| Factor | Finding |
|---|---|
| External callers | None |
| UI usage | None — send flow calls `sendProposal` |
| API route usage | None |
| Canonical alternative | `sendProposal` via atomic `send_proposal` RPC |
| Atomicity | Non-atomic dual write (estimates then proposal_structures) — inconsistency possible if second write fails |
| Permission guard | Added in Slice 26, but guarding a dead export is noise |

`sendProposal` supersedes `lockProposal` completely. The RPC (`send_proposal`) handles the same state transition (draft → sent, lock estimate, insert snapshot) atomically. Retaining `lockProposal` as a non-atomic alternative with no UI path is a maintenance liability and a latent inconsistency risk.

There is no valid use-case to retain it. Option B (replace with atomic version) would require a new Postgres function with no existing caller — deferred work with no payoff.

---

## 3. Files Changed

| File | Change |
|---|---|
| `src/app/actions/proposal-actions.ts` | Deleted `lockProposal` function (52 lines removed) |
| `docs/actions/slices/slice_27_lockProposal_resolution.md` | This report |

No imports needed to be cleaned up — `lockProposal` had no external callers.

---

## 4. Validation

| Check | Result |
|---|---|
| `grep -rn "lockProposal" src/` | No references outside own file (confirmed before deletion) |
| `npx tsc --noEmit` | Pass — no errors |

---

## 5. Risks

None. The function had no callers. Deletion removes dead code without affecting any reachable path.

---

## 6. Follow-up

- **Slice 28** — DB inspection of `set_active_estimate` RPC privilege model (SECURITY DEFINER status unknown).
- `unlockProposal` retains the same non-atomic dual-write structure as `lockProposal` had. It is actively used in `ProposalBuilderOrchestrator.tsx`. If an unlock and a concurrent write race, the estimate and proposal_structures could briefly diverge. This is lower risk than the lock path (unlock doesn't create permanent state), but worth noting for a future atomicity pass.

---

## 7. Intentionally Not Changed

- `sendProposal` — not modified
- `unlockProposal` — not modified (active UI path, out of scope)
- DB functions — not modified
- RLS policies — not modified
- UI components — not modified
- `assign` permission — not used
