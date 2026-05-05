# Slice 36 — Snapshot Staged Support

**Date:** 2026-05-05
**Branch:** dev
**File:** `src/app/actions/document-actions.ts`

---

## 1. Context

`current.md` listed as a known gap and next recommended work:

> `createProposalSnapshot` still checks `status === 'active'`; it does not support
> staged estimates and would need updating if used from the staged proposal flow.

Slice 35 annotated this gap with a code comment. This slice closes it.

---

## 2. Stop Condition Evaluation

| Condition | Result |
|---|---|
| Conflicts with send invariants | **Clear** — snapshot inserts a new `proposal_documents` row only; does not mutate `estimates` or `proposal_structures`; send RPC creates its own separate doc row |
| Staged estimates mutate during snapshot | **Clear** — staged estimates have `isEstimateEditable() = false`; worksheet rows and structure are immutable at that point; snapshot is safer than active-estimate snapshots |
| DB or RPC changes needed | **Clear** — `proposal_structures.proposal_status` is `'draft'` for staged estimates; `docStatusMap` already maps `'draft' → 'draft_snapshot'` correctly |

---

## 3. Changes

### `src/app/actions/document-actions.ts` — `createProposalSnapshot`

**Eligibility filter** (the only logic change):

Before:
```typescript
const activeEstimate = estimates.find((e) => e.id === estimateId && e.status === 'active') ?? null
if (!activeEstimate) return { error: 'No active estimate found for the given estimate ID' }
```

After:
```typescript
const eligibleEstimate = estimates.find(
  (e) => e.id === estimateId && (e.status === 'active' || e.status === 'staged'),
) ?? null
if (!eligibleEstimate) return { error: 'Snapshots can only be created for active or staged estimates' }
```

**Variable rename:** `activeEstimate` → `eligibleEstimate` at the `.title` reference site.

**Function comment:** Replaced "Known gap" note with the correct eligibility statement:
- Eligible: `active`, `staged`
- Not eligible: `sent`, `signed`, `voided`, `rejected`, `archived`

No other logic was touched.

---

## 4. Invariants Preserved

- Terminal statuses (`sent`, `signed`, `voided`, `rejected`) remain ineligible — they already have immutable sent-time snapshots from the RPC.
- `archived` remains ineligible — archived estimates are hidden/recoverable; no snapshot purpose.
- Permission level stays `edit` — creating a snapshot is a read + insert operation, not a lifecycle transition.
- `send_proposal` RPC is unaffected — it enforces its own `staged` precondition independently.
- No snapshot logic changes beyond the eligibility check.
- `docStatusMap` for staged estimates: `proposal_structures.proposal_status = 'draft'` → `doc_status = 'draft_snapshot'`. Correct — this is a pre-send manual snapshot.

---

## 5. Files Changed

| File | Change |
|---|---|
| `src/app/actions/document-actions.ts` | Eligibility filter, variable rename, function comment |
| `docs/modules/estimate/slice_36_snapshot_staged_support.md` | New slice report |

---

## 6. Validation

- TypeScript: `npx tsc --noEmit` — no errors
- Active estimates: eligibility unchanged — still snapshotable
- Staged estimates: now snapshotable
- Sent / signed / voided / rejected: still blocked by eligibility filter
- Archived: still blocked (not in filter)
- Send flow (`sendProposal`): not touched

---

## 7. Files Not Changed (Intentionally)

- `sendProposal` — out of scope; send path is canonical through RPC
- `proposal-actions.ts` — no snapshot interaction
- DB schema — no changes needed
- UI components — no changes needed (UI wiring for staged snapshot button is a separate concern)
