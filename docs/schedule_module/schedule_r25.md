Schedule Module — R25 Deliverables

Date: 2026-04-11
Branch: dev
Scope: Shift Dependencies toggle — manual shift behavior via lag adjustment

⸻

A. Summary

R25 introduces the core logic required to support the “Shift Dependencies?” toggle.

This defines how the system behaves when a user:
	•	moves a schedule item (A)
	•	chooses NOT to cascade changes to dependent items (B, C, etc.)

Instead of breaking dependencies or forcing cascade, the system:

updates dependency lag values to preserve graph integrity

⸻

B. Core Behavior

When a schedule item is manually shifted and dependencies are not cascaded:
	•	No other schedule items are moved
	•	No dependencies are removed
	•	The dependency graph remains intact
	•	Lag days are recalculated to reflect the new relationship

⸻

C. Problem This Solves

Without this behavior, three bad options exist:

❌ Option 1 — Cascade everything

Forces unwanted changes → bad UX

❌ Option 2 — Break dependencies

Creates invalid graph → resolver inconsistency

❌ Option 3 — Do nothing

Creates hidden mismatch → “out of sync” state

⸻

✅ Implemented Solution

Convert manual movement into lag adjustment

This keeps:
	•	graph valid
	•	UI intuitive
	•	system deterministic

⸻

D. Implementation

File

src/lib/schedule/dependencyBehavior.ts

Function

computeDependencyAdjustmentsForManualShift(...)


⸻

E. Algorithm

Inputs
	•	movedItemId
	•	oldStartDate
	•	newStartDate
	•	dependencies[]

⸻

Step 1 — Compute shift

shiftDays = newStartDate - oldStartDate


⸻

Step 2 — Apply to dependencies

For each dependency:

Case 1 — Item is successor (A depends on something)

newLag = oldLag + shiftDays

Meaning:
	•	A moved later → needs more lag from predecessor
	•	A moved earlier → needs less lag

⸻

Case 2 — Item is predecessor (others depend on A)

newLag = oldLag - shiftDays

Meaning:
	•	A moved later → successors now effectively closer → reduce lag
	•	A moved earlier → successors further away → increase lag

⸻

Output

DependencyAdjustment[] = {
  dependencyId,
  newLagDays
}


⸻

F. Key Design Decision

“Relationship changes, not the items”

When a user moves A but not B:
	•	The system does NOT move B
	•	The system does NOT ignore the dependency
	•	The system updates the relationship definition

This is the only model that:
	•	preserves correctness
	•	avoids UI frustration
	•	aligns with real-world scheduling behavior

⸻

G. Example

Original

A → B (lag = 2)
A = Day 1
B = Day 3

User moves A to Day 5 (no cascade)

shiftDays = +4

Update:

lag = 2 - 4 = -2

Now:

A = Day 5
B = Day 3

Graph still resolves correctly.

⸻

H. Assumptions
	1.	Dates are ISO strings (YYYY-MM-DD)
	2.	lag_days defaults to 0 when null
	3.	Dependencies are directional and valid
	4.	Same-day comparisons are handled (shift = 0 → no change)

⸻

I. Edge Cases

1. Null dates

If either oldStartDate or newStartDate is null:
	•	No adjustments are made

⸻

2. Zero shift

If no actual change:
	•	No adjustments returned

⸻

3. Negative lag

Allowed.

This is intentional:
	•	Represents overlap / early successor start
	•	Valid in real construction sequencing

⸻

J. What This Does NOT Do

This function:
	•	does NOT write to DB
	•	does NOT modify schedule items
	•	does NOT trigger pipeline

It only computes adjustments.

⸻

K. Relationship to Architecture

This implements the rule defined earlier:

“There should never be an out-of-sync state”

By encoding manual shifts into lag:
	•	graph always resolves
	•	UI always reflects reality
	•	no hidden inconsistencies

⸻

L. Status

Dependency behavior is now:
	•	mathematically defined
	•	deterministic
	•	aligned with UX goals

⸻

M. Next Step

R26 — Apply adjustments to DB
	•	Wire into save flow
	•	Add “Shift Dependencies?” checkbox
	•	Persist updated lag values to schedule_item_dependencies

This is where behavior becomes visible to users.