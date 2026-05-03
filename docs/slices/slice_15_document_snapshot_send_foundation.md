# Slice 15 — Document Snapshot + Send Foundation

**Date:** 2026-05-02
**Branch:** claude/audit-worksheet-stability-nIwtF → dev
**Reference:** design/estimate_system_execution_plan_r02.md, docs/slices/slice_14_shared_pdf_output.md

---

## Objective

Introduce an immutable document snapshot layer so that a sent proposal has a permanent
record that is independent of future live estimate or worksheet changes.

This is a foundation slice: snapshot creation + rendering + minimal UI entry points.
No email delivery, e-signature, or public portal.

---

## Schema Added

### `proposal_documents`

```sql
CREATE TABLE proposal_documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID        NOT NULL REFERENCES jobs(id),
  estimate_id      UUID        NOT NULL REFERENCES estimates(id),
  doc_status       TEXT        NOT NULL DEFAULT 'draft_snapshot'
                               CHECK (doc_status IN ('draft_snapshot', 'sent', 'signed', 'voided')),
  title            TEXT        NOT NULL DEFAULT '',
  snapshot_json    JSONB       NOT NULL,
  created_by       UUID        REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at        TIMESTAMPTZ,
  superseded_by_id UUID        REFERENCES proposal_documents(id)
);
```

**Index:** `(estimate_id, created_at DESC)` — fast latest-doc lookup per estimate.

**RLS:**
- SELECT: `is_internal()`
- INSERT: `is_internal()`
- UPDATE: `is_internal()` (for voiding only — app layer restricts to status/voided_at)
- DELETE: none — records are never deleted

---

## `snapshot_json` Shape

```typescript
type ProposalSnapshotJson = {
  version: 1                    // schema version for future migrations
  captured_at: string           // ISO 8601 timestamp of creation
  proposal_status: string       // proposal_structures.proposal_status at capture time
  job_name: string
  estimate_title: string
  grand_total: number
  sections: Array<{
    id: string
    title: string               // display title after structure override
    subtotal: number
    items: Array<{
      id: string
      depth: number
      description: string
      quantity: number | string | null
      unit: string | null
      unit_price: number | string | null
      row_kind: string
      line_total: number
    }>
  }>
}
```

The snapshot captures the complete rendered proposal at creation time.
It contains no references to live worksheet rows or structure records.
It is the sole source of truth for the document view.

---

## `doc_status` Values

| doc_status | When set |
|---|---|
| `draft_snapshot` | Proposal is in `draft` state when snapshot is created |
| `sent` | Proposal is in `sent` state when snapshot is created |
| `signed` | Proposal is in `signed` state when snapshot is created |
| `voided` | Snapshot is explicitly voided via `voidProposalDocument` |

`doc_status` is derived from `proposal_structures.proposal_status` at creation time.
Snapshot creation never changes `doc_status` of existing documents.

---

## Server Actions Added

### `createProposalSnapshot(estimateId, jobId)`

Located in `src/app/actions/document-actions.ts`.

**Behavior:**
1. Auth guard
2. Load job name
3. Find active estimate matching `estimateId`
4. Parallel load: worksheet rows + proposal structure record
5. Run same derive/reconcile/freeze logic as preview/PDF routes
6. Run `applyStructure` → `ProposalSummary`
7. Map `ProposalSummary` → `ProposalSnapshotJson`
8. Insert into `proposal_documents`
9. Return `{ documentId }` on success

**Guarantees:**
- Does NOT mutate worksheet rows, proposal structure, or estimate lock state
- `snapshot_json` is written once and never updated
- Idempotent: can be called multiple times; each call creates a new document

### `voidProposalDocument(documentId, jobId)`

**Behavior:**
- Fetches document; verifies it belongs to the given job
- Guards: already voided → error
- Updates `doc_status = 'voided'` and `voided_at = now()`
- `snapshot_json` is NOT modified — content is preserved

---

## Routes Added

### `/jobs/[id]/proposal/documents/[documentId]`

Server component. Renders from `snapshot_json` only.

**Data fetching:**
- Auth guard
- Single query: `proposal_documents WHERE id = documentId AND job_id = id`
- No worksheet rows, no structure records, no live estimate data

**Rendering:**
- Uses shared PDF components (`DocShell`, `DocHeader`, `DocSection`, `DocLineItemTable`, `DocTotalsBlock`, `DocFooter`, `PrintButton`)
- Status badge uses `doc_status` (not live proposal status)
- "Captured at" timestamp from `snapshot_json.captured_at`
- Voided documents show a red banner; content is still rendered for reference
- Print button available (uses `window.print()` via `PrintButton`)

**Navigation:**
- Back arrow → preview page
- Print / Save as PDF button

---

## How Snapshot Differs from Live PDF

| | Live PDF (`/proposal/pdf`) | Snapshot (`/proposal/documents/[id]`) |
|---|---|---|
| Data source | Live worksheet + proposal structure | `snapshot_json` in DB |
| Changes when estimate changes | Yes | No — frozen at capture time |
| Changes when proposal is unlocked/modified | Yes | No |
| Created on every page load | Yes | No — created explicitly |
| Stored in DB | No | Yes |
| Represents a moment in time | No | Yes |

The live PDF route is kept unchanged as a draft/internal output tool.

---

## Lock / Send Behavior

`createProposalSnapshot` **does not** lock the proposal or estimate.
It captures the current state regardless of lock status.

| Proposal status at capture | Snapshot `doc_status` |
|---|---|
| `draft` | `draft_snapshot` |
| `sent` (locked) | `sent` |
| `signed` (locked) | `signed` |
| `voided` | `voided` |

For a complete "send" flow, the recommended sequence is:
1. Builder: click "Mark as sent" → `lockProposal` (existing)
2. Preview: click "Create snapshot" → `createProposalSnapshot` → creates `sent` document

These are kept as separate actions so either step can be repeated or combined by future UI.

---

## Minimal UI Entry Points

### Preview page (`/proposal/preview`)
- **"Create snapshot" button** (`SnapshotCreateButton` client component):
  - Visible when proposal is not voided and an active estimate exists
  - On success: redirects to new document view
  - Shows inline error on failure
- **"Latest snapshot →" link**: shown when at least one document exists for the estimate

### Summary page (`/proposal/page`)
- **"Snapshot →" link**: shown when at least one document exists for the estimate

---

## Files Added / Changed

| File | Change |
|---|---|
| DB migration `create_proposal_documents` | New `proposal_documents` table + RLS policies + index |
| `src/lib/proposalSnapshot.ts` | **New** — `ProposalSnapshotJson`, `ProposalSnapshotSection`, `ProposalSnapshotItem`, `ProposalDocStatus`, `ProposalDocumentRecord` types |
| `src/app/actions/document-actions.ts` | **New** — `createProposalSnapshot`, `voidProposalDocument` server actions |
| `src/components/patterns/proposal/SnapshotCreateButton.tsx` | **New** — client component with loading state and router redirect |
| `src/app/jobs/[id]/proposal/documents/[documentId]/page.tsx` | **New** — snapshot view route, renders from `snapshot_json` only |
| `src/app/jobs/[id]/proposal/preview/page.tsx` | Add latest-doc query; add `SnapshotCreateButton` + "Latest snapshot →" link in header card |
| `src/app/jobs/[id]/proposal/page.tsx` | Add latest-doc query; add "Snapshot →" link in header card links row |

---

## Validation Run

| Stage | Result |
|---|---|
| DB migration | Applied successfully |
| Compilation (Turbopack) | Pass — 18.8s |
| TypeScript | Pass — 20.7s |
| Pre-existing prerender error | Supabase env-var — unrelated |

---

## Limitations

1. **No "send" integration**: `lockProposal` and `createProposalSnapshot` are separate
   actions. A future slice should combine them into an atomic "Send proposal" workflow
   that locks + snapshots in a single transaction.

2. **No void UI in snapshot view**: `voidProposalDocument` server action is ready but
   there is no button in the snapshot view to trigger it. Can be added in a future slice.

3. **No document list UI**: There is no `/proposal/documents` index page. Users can only
   reach snapshots via the "Latest snapshot" link (which always shows the most recent).
   A document history list would require a future slice.

4. **Single estimate per snapshot**: `createProposalSnapshot` requires an active estimate.
   Change orders (secondary estimates) are not yet snapshotted — each estimate would need
   its own proposal document flow.

5. **No snapshot versioning UI**: `superseded_by_id` column is present in the schema for
   future supersession tracking but is not populated by any current action.

---

## Risks / Follow-up Items

1. **Atomic lock + snapshot**: Currently two separate server actions. If the user locks
   the proposal but does not create a snapshot, the "sent" state has no permanent record.
   A future slice should make snapshot creation mandatory when locking (or atomic).

2. **Multiple documents per estimate**: The UI shows only the latest document. If users
   create multiple snapshots (e.g., draft snapshot + sent snapshot), only the latest is
   surfaced. A document history view would prevent confusion.

3. **`voidProposalDocument` not surfaced in UI**: Users have no way to void a snapshot
   through the current UI. This is intentional for this foundation slice but should be
   addressed before production use.

4. **Snapshot on voided proposals**: `createProposalSnapshot` allows snapshot creation
   when the proposal is voided. The resulting `doc_status` will be `voided`, which may
   be confusing. Consider blocking snapshot creation on voided proposals in a future slice.
