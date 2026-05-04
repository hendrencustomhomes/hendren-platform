# Handoff — 2026-05-04 (Slices 25–28 Infrastructure Completion)

---

## What changed this session

### Slice 25 — RLS / service-role audit
- Identified all mutation paths
- Confirmed where RLS applies vs bypasses
- Flagged SECURITY DEFINER risk on `send_proposal`

### Slice 26 — proposal/document permission guards
- Added `requireModuleAccess` to all proposal and document actions
- Closed critical permission gap before SECURITY DEFINER RPC

### Slice 27 — lockProposal resolution
- Deleted unused, non-atomic `lockProposal`
- Removed redundant mutation path

### Slice 28 — set_active_estimate RPC audit
- Verified DB function is **SECURITY INVOKER**
- Confirmed RLS applies inside function
- No additional guards required

---

## Current state

The Estimate → Proposal → Send pipeline is now:

### Fully enforced across all layers

1. **Application layer**
   - `requireModuleAccess` enforces permission levels
   - `isEstimateEditable()` enforces state

2. **Database layer**
   - RLS protects worksheet and estimate mutations
   - `set_active_estimate` respects RLS (SECURITY INVOKER)

3. **Privileged operations**
   - `sendProposal` guarded before SECURITY DEFINER RPC
   - No unguarded mutation paths remain

### Structural cleanup
- Dead mutation path (`lockProposal`) removed
- All active paths are canonical and consistent

---

## Remaining gaps

- Estimate approval/status transition model not defined
- Pricing resolution logic not implemented
- `unlockProposal` remains non-atomic (acceptable for now)
- Permission helper may need caching optimization later

---

## Next step (locked)

### Slice 29 — estimate approval/status transition design

Scope:
- Define estimate lifecycle states (draft / active / sent / signed / etc.)
- Define transitions and constraints
- Align estimate + proposal state coupling
- Define which actions control transitions

Follow-up:
- Pricing resolution logic

---

## What NOT to touch

- Do NOT modify RLS policies
- Do NOT modify DB functions
- Do NOT introduce new permission systems
- Do NOT change proposal send flow
- Do NOT refactor worksheet system

---

## current.md updated?

Yes — updated to reflect Slice 28 and completed infrastructure track
