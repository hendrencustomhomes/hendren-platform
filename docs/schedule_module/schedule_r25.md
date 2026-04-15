Schedule Module — R25 Deliverables

Date: 2026-04-11
Branch: dev
Scope: Shift Dependencies toggle — manual shift behavior via dependency offset adjustment

⸻

A. Summary

R25 introduces the core logic required to support the “Shift Dependencies?” toggle.

This defines how the system behaves when a user:
	•	moves a schedule item (A)
	•	chooses NOT to cascade changes to dependent items (B, C, etc.)

Instead of breaking dependencies or forcing cascade, the system:

updates dependency offsets to preserve graph integrity

⸻

B. Core Behavior

When a schedule item is manually shifted and dependencies are not cascaded:
	•	No other schedule items are moved
	•	No dependencies are removed
	•	The dependency graph remains intact
	•	offset_working_days values are recalculated to reflect the new relationship

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

Convert manual movement into dependency offset adjustment

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

Step 1 — Compute shift

The function computes the working-day difference between:
	•	previous start date
	•	new start date

using Mon–Fri working-day logic.

shiftDays = diffInWorkingDays(oldStartDate, newStartDate)


⸻

Step 2 — Apply to dependencies

For each dependency:

Case 1 — Moved item is the successor
Meaning:
	•	dependency points into the moved item
	•	the moved item depends on something else

Match condition:

dep.successor_type === 'schedule' &&
dep.successor_id === movedItemId

Adjustment:

newOffsetWorkingDays = dep.offset_working_days + shiftDays

Meaning:
	•	item moved later → needs more offset from predecessor
	•	item moved earlier → needs less offset

⸻

Case 2 — Moved item is the predecessor
Meaning:
	•	dependency points out of the moved item
	•	other items depend on it

Match condition:

dep.predecessor_type === 'schedule' &&
dep.predecessor_id === movedItemId

Adjustment:

newOffsetWorkingDays = dep.offset_working_days - shiftDays

Meaning:
	•	item moved later → successors are now effectively closer → reduce offset
	•	item moved earlier → successors are now effectively farther away → increase offset

⸻

Output

DependencyAdjustment[] = {
  dependencyId,
  newOffsetWorkingDays
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

A → B
offset_working_days = 2

A = Day 1
B = Day 3

User moves A to Day 5 (no cascade)

shiftDays = +4

Update

If A is predecessor:

newOffsetWorkingDays = 2 - 4 = -2

Now:
	•	A = Day 5
	•	B = Day 3

Graph still resolves correctly.

⸻

H. Assumptions
	1.	Dates are ISO strings (YYYY-MM-DD)
	2.	offset_working_days is always present on ScheduleItemDependency
	3.	Dependencies are directional and valid
	4.	Same-day comparisons are handled (shift = 0 → no change)
	5.	Working-day shift calculation uses Mon–Fri logic for this adjustment step

⸻

I. Edge Cases

1. Null dates

If either oldStartDate or newStartDate is null:
	•	no adjustments are made

2. Zero shift

If no actual change:
	•	no adjustments are returned

3. Negative offsets

Allowed.

This is intentional:
	•	represents overlap / early successor start
	•	valid in real construction sequencing

4. Non-schedule dependencies

Only schedule-to-schedule dependency edges touching the moved item are adjusted.
Other dependency types are ignored by this helper.

⸻

J. What This Does NOT Do

This function:
	•	does NOT write to DB
	•	does NOT modify schedule items
	•	does NOT trigger pipeline behavior

It only computes dependency offset adjustments.

⸻

K. Relationship to Architecture

This implements the rule defined earlier:

“There should never be an out-of-sync state”

By encoding manual shifts into dependency offsets:
	•	graph always resolves
	•	UI always reflects reality
	•	no hidden inconsistencies

⸻

L. Status

Dependency behavior is now:
	•	mathematically defined
	•	deterministic
	•	aligned with UX goals
	•	corrected to the real schedule_item_dependencies schema

⸻

M. Next Step

R26 — Apply adjustments to DB
	•	wire into save flow
	•	add “Shift Dependencies?” checkbox
	•	persist updated offset_working_days to schedule_item_dependencies

This is where behavior becomes visible to users.
