# Handoff — 2026-05-05 (Slices 29–33 Pipeline Completion + SQL Process Correction)

---

## What changed this session

### Slice 29 — archive and restore alignment
- Allowed archiving of active estimates
- Fixed restore to return archived → draft
- Added confirmation UX

### Slice 30 — stage estimate (server)
- Introduced `staged` lifecycle state
- Server-side transition implemented

### Slice 31 — stage/unstage UI + lifecycle correction
- Restricted staging to active only
- Added `unstageEstimate` (staged → active)
- Wired Stage/Unstage into UI

### Slice 32 — reject + permanent lock
- Removed `unlockProposal`
- Added `rejectProposal`
- Enforced send requires staged
- Blocked active switching when staged exists

### Slice 33 — send RPC atomic fix
- `send_proposal` now atomically:
  - enforces staged
  - locks estimate
  - sets `estimates.status = sent`
  - updates proposal_structures
  - inserts snapshot
- Removed app-layer post-RPC status update

### Process correction — SQL handling
- Identified incorrect behavior: repo migration file was created
- Deleted migration file
- Updated system rules:
  - SQL changes are Supabase-direct
  - Repo migrations are forbidden unless explicitly requested
- Updated templates and START_HERE to enforce rule

---

## Current state

The Estimate → Proposal → Send pipeline is now fully enforced and consistent:

```text
draft → active → staged → sent → rejected / signed / voided → archived
```

### Guarantees

- **Staging gate enforced** (UI + server + DB)
- **Send is atomic at DB layer** (no partial state)
- **Sent is permanently locked** (no unlock path)
- **Single active estimate enforced** (blocked when staged exists)
- **Archive/restore behaves correctly**
- **Permissions fully aligned (view/edit/manage)**

### Data truth

- Estimate = authoritative truth
- Proposal = formatted view + snapshot artifact
- DB enforces critical transitions (not just app)

---

## Remaining gaps

- `snapshot_json` still duplicates estimate data (not yet de-authoritized)
- `createProposalSnapshot` only supports active (not staged)
- `rejectProposal` does not update proposal_structures
- `void/sign` not fully aligned with estimate.status
- Pricing resolution logic not implemented

---

## Next step (locked)

### Slice 34 — proposal artifact truth cleanup

Scope:
- Ensure proposal_documents are output-only artifacts
- Remove any logic treating snapshot_json as authoritative
- Align all reads to estimate + worksheet

Follow-up:
- Void/sign alignment with estimate status

---

## What NOT to touch

- Do NOT reintroduce repo migration files
- Do NOT modify DB functions without SQL prompt
- Do NOT loosen staged → send requirement
- Do NOT add unlock paths
- Do NOT refactor worksheet system

---

## current.md updated?

Yes — updated to reflect:
- Slice 33 completion
- atomic send behavior
- SQL process rule
