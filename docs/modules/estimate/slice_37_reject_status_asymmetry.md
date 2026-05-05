# Slice 37 — Rejected Proposal Status Asymmetry

**Status:** Completed (asymmetry documented as intentional)
**Date:** 2026-05-05
**Branch:** dev

---

## 1. Context

`current.md` listed as a known gap:

> `rejectProposal` only updates `estimates.status`; `proposal_structures.proposal_status`
> remains `sent` (ProposalStatus does not include 'rejected'); future UI may need to
> check `estimates.status` for rejected state.

The task was to make an explicit code-level decision: align `proposal_structures` on
rejection, or document the asymmetry as intentional.

---

## 2. Stop Condition Evaluation

Alignment path (adding 'rejected' to ProposalStatus and writing it to proposal_structures)
was evaluated first.

| Condition | Result |
|---|---|
| DB/schema changes required | **STOP** — `proposal_structures.proposal_status` is likely a DB enum; adding 'rejected' requires a live DB change |
| Ripple changes beyond this slice | **STOP** — `docStatusMap: Record<ProposalStatus, ProposalDocStatus>` in `document-actions.ts` needs a new entry; `STATUS_BADGE: Record<ProposalStatus, ...>` in preview page needs a new badge; both are out of scope |

Both stop conditions triggered for alignment. The correct path is to document the
asymmetry as intentional design.

---

## 3. Decision: Asymmetry is Correct Design

`proposal_structures.proposal_status` models document workflow state, not estimate
lifecycle state. The two tracks are intentionally separate:

- The proposal document was **sent** — that is the accurate document record.
- The client **rejected** it — that is a business outcome tracked in `estimates.status`.

Keeping `proposal_structures.proposal_status = 'sent'` after rejection is correct. The
document is not un-sent. The snapshot and audit trail remain valid. The estimate is the
authoritative record of the rejection.

This matches the reasoning from slice 32 (section 4):
> "The estimates record reflects the business outcome."

---

## 4. Changes

### `src/lib/proposalStructure.ts` — `ProposalStatus` type

Added a comment before the type declaration explaining:
- Why `'rejected'` is absent (intentional — rejection is an estimate event)
- Why `'staged'` is absent (intentional — staging is an estimate transition)
- That `estimates.status` is the authoritative lifecycle source
- That any code needing rejected state must read `estimates.status`

### `src/app/actions/proposal-actions.ts` — `rejectProposal`

Replaced the thin existing comment with an explicit statement of intent:
- `proposal_structures.proposal_status` stays at `'sent'` by design, not by accident
- Explains why adding 'rejected' to ProposalStatus is deferred (schema + ripple cost)
- States clearly: any code needing rejected state reads `estimates.status`

No logic changes in either file. Comments only.

---

## 5. Validation

- TypeScript: `npx tsc --noEmit` — no errors
- No behavior changes

---

## 6. Risks / Follow-up

**UI gap (pre-existing):** UI components that read `proposal_structures.proposal_status`
to display proposal state will show 'Sent' for a rejected estimate, not 'Rejected'. Any
future UI that surfaces rejection state must read `estimates.status` or join both fields.
This is documented in comments and in `current.md` known gaps. No UI change is in scope
for this slice.

**Future alignment path (if needed):** If a concrete UI or reporting requirement demands
that `proposal_structures.proposal_status` reflect rejection, the work requires:
1. DB column type change (or confirmation it is a free-text column)
2. Add `'rejected'` to `ProposalStatus`
3. Add `docStatusMap['rejected']` entry in `document-actions.ts`
4. Add `STATUS_BADGE['rejected']` in `preview/page.tsx`
5. Update `rejectProposal` to write to `proposal_structures`

That is a separate bounded slice triggered by a real UI need, not a preemptive fix.

---

## 7. Files Changed

| File | Change |
|---|---|
| `src/lib/proposalStructure.ts` | Comment added before `ProposalStatus` type |
| `src/app/actions/proposal-actions.ts` | `rejectProposal` function comment strengthened |
| `docs/modules/estimate/slice_37_reject_status_asymmetry.md` | This report |

---

## 8. Intentionally Not Changed

- `proposal_structures.proposal_status` behavior — stays at 'sent' after rejection
- `ProposalStatus` type values — no 'rejected' added
- DB schema — out of scope
- UI components — out of scope
- `document-actions.ts` — out of scope
- All other proposal actions (`signProposal`, `voidProposal`) — unaffected
