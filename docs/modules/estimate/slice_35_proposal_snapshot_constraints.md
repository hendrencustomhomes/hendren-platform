# Slice 35 — Proposal Snapshot Audit-Artifact Constraints

**Date:** 2026-05-05
**Branch:** dev
**Files changed:** `src/lib/proposalSnapshot.ts`, `src/app/actions/document-actions.ts`

---

## 1. Context

`current.md` listed as a known gap:

> `createProposalSnapshot` and `sendProposal` still create/store `snapshot_json`;
> target architecture says estimate is durable truth and proposal artifacts must not
> become competing source of truth.

This slice audits all `snapshot_json` usage across the codebase and hardens the
contract so the snapshot cannot drift into authoritative use.

---

## 2. Audit Findings

### snapshot_json write sites

| Site | Purpose |
|---|---|
| `createProposalSnapshot` in `document-actions.ts` | Builds and inserts draft/sent/signed/voided snapshot on demand |
| `sendProposal` in `document-actions.ts` | Builds send-time snapshot, passes to `send_proposal` RPC |

Both are write-only from the app layer. The RPC inserts the value; no code reads it back.

### snapshot_json read sites

| Site | Purpose | Authoritative? |
|---|---|---|
| `proposal/documents/[documentId]/page.tsx` | Renders historical snapshot document to the user | No — display only |

The document page uses `snapshot_json` exclusively to render the stored record to a
user. It makes no business decisions from it (no status transitions, no pricing
resolution, no scope derivation). This is the correct and only valid read pattern.

### Live view pages

| Page | Data source |
|---|---|
| `proposal/page.tsx` | `estimates`, `job_worksheet_items`, `proposal_structures` (live data) |
| `proposal/preview/page.tsx` | Same — live data; references `proposal_documents.id` only for navigation |

Neither live view reads `snapshot_json`. Both compute display state from live estimate data.

### `voidProposalDocument`

Reads `doc_status` and `job_id` only. Does not read or modify `snapshot_json`.

---

## 3. Stop Condition Evaluation

| Condition | Result |
|---|---|
| snapshot_json used as authoritative data anywhere | **No stop** — read only by display page; no business decisions |
| Enforcing constraints requires schema or RPC changes | **No stop** — comment-only changes sufficient |
| Proposal documents relied on by other modules | **No stop** — only used within the proposal/estimate module |

---

## 4. Changes Made

### `src/lib/proposalSnapshot.ts`

Added explicit audit-artifact contract at the file header. Defines:

- `snapshot_json` is write-once; never updated after insert.
- No app or server action may read it to resolve status, scope, or pricing.
- The only valid reader is a display-only document page.
- Any other read is a contract violation.

### `src/app/actions/document-actions.ts`

Three targeted comment additions:

1. **`createProposalSnapshot` function comment** — Updated to state:
   - Write-once; snapshot_json never read back for decisions.
   - `estimates` and `job_worksheet_items` remain the authoritative source.
   - Annotates the known gap: the `activeEstimate` guard checks `status === 'active'`
     but staged estimates should also be snapshotable (tracked in `current.md` known gaps).

2. **Inline comment before `snapshotJson` build in `createProposalSnapshot`** —
   "Audit artifact only — this value is inserted once and never read back for decisions."

3. **Inline comment before `snapshotJson` build in `sendProposal`** —
   "Send-time audit artifact — captures estimate state at the moment of send. Passed
   to the RPC and stored in proposal_documents as a write-once record. No app code
   reads snapshot_json back to determine status or scope."

No behavior changes in any function. All guards, data flows, and return values are
unchanged.

---

## 5. Invariants Confirmed

- `estimates.status` is the authoritative lifecycle state. No snapshot field is read
  to derive or override it.
- `job_worksheet_items` is the authoritative scope and pricing data. Snapshot sections
  are a historical copy for display only.
- `proposal_structures.proposal_status` is a secondary artifact that mirrors estimates
  for the sent/signed/voided states. It is not derived from snapshot data.
- Snapshot rows in `proposal_documents` accumulate as audit history. `doc_status` tracks
  their document lifecycle independently of estimate lifecycle.

---

## 6. Known Gap Annotated (Not Fixed)

`createProposalSnapshot` guards on `estimates.status === 'active'`. Since the send flow
now requires `staged`, a staged estimate cannot produce a manual snapshot through this
action. This gap was pre-existing and is recorded in `current.md`. Fixing it requires
a behavior change (different status guard + possibly a different permission level) and
is deferred to a dedicated slice.

---

## 7. Files Changed

| File | Type of change |
|---|---|
| `src/lib/proposalSnapshot.ts` | Comment only — audit-artifact contract header |
| `src/app/actions/document-actions.ts` | Comment only — function comment + two inline comments |
| `docs/modules/estimate/slice_35_proposal_snapshot_constraints.md` | New slice report |

---

## 8. Files Not Changed (Intentionally)

| File | Reason |
|---|---|
| `src/app/jobs/[id]/proposal/documents/[documentId]/page.tsx` | Correct read pattern; no change needed |
| `src/app/jobs/[id]/proposal/page.tsx` | Does not read snapshot_json |
| `src/app/jobs/[id]/proposal/preview/page.tsx` | Does not read snapshot_json |
| `src/app/actions/proposal-actions.ts` | No snapshot interaction |
| DB schema | Out of scope; no changes |

---

## 9. Validation

- TypeScript: `npx tsc --noEmit` — no errors
- No behavioral changes; send flow, void flow, and snapshot creation paths are identical
- All existing guards and revalidation paths preserved
