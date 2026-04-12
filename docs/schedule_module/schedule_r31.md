docs/schedule_module/schedule_r31.md

Schedule Module — R31 Deliverables

Date: 2026-04-11
Branch: dev
Scope: Dependency schema correction and manual-shift hardening

⸻

A. Summary

R31 corrects a dependency-schema mismatch that caused build failure and restores the manual no-cascade behavior to the project’s actual data model.

The issue was not with the schedule editing architecture itself. The issue was a drift between:
	•	an outdated dependency field model
	•	the current ScheduleItemDependency shape used by the repo

This round hardens the dependency adjustment helper so it matches the real schema and preserves the intended no-cascade behavior.

⸻

B. Problem Corrected

The failing implementation used fields that do not exist on the current dependency type:

lag_days
predecessor_schedule_id
successor_schedule_id

Vercel type checking correctly failed with:

Property lag_days does not exist on type ScheduleItemDependency

The correct dependency schema in this repo uses:

predecessor_type
predecessor_id
successor_type
successor_id
offset_working_days


⸻

C. Exact File Corrected
	•	src/lib/schedule/dependencyBehavior.ts

⸻

D. Corrected Behavior

Output shape

The helper now returns:

type DependencyAdjustment = {
  dependencyId: string
  newOffsetWorkingDays: number
}

This replaces the incorrect prior assumption of newLagDays.

⸻

Date math

The helper now:
	•	parses ISO dates locally
	•	computes deterministic working-day movement
	•	avoids UTC drift
	•	counts Mon–Fri movement only

Supporting helpers:
	•	parseDateLocal(...)
	•	isMonFri(...)
	•	diffInWorkingDays(...)

⸻

Dependency matching logic

For each dependency:

Case 1 — moved item is successor
Match:

dep.successor_type === 'schedule' &&
dep.successor_id === movedItemId

Action:

newOffsetWorkingDays = dep.offset_working_days + shiftDays

Case 2 — moved item is predecessor
Match:

dep.predecessor_type === 'schedule' &&
dep.predecessor_id === movedItemId

Action:

newOffsetWorkingDays = dep.offset_working_days - shiftDays

This preserves the intended no-cascade rule:

change the relationship, not the downstream item dates

⸻

E. Why This Fix Matters

Without this correction:
	•	the build fails
	•	dependency adjustment code points at nonexistent fields
	•	no-cascade behavior becomes unstable or impossible to trust

With this correction:
	•	the helper aligns with the actual repo schema
	•	build integrity is restored
	•	no-cascade schedule behavior remains deterministic

⸻

F. Relationship to Existing Behavior

R31 does not change the product rule.

It only restores the implementation to the actual model already in use elsewhere:
	•	manual shift with cascade off
	•	downstream dates preserved
	•	dependency offsets rewritten
	•	graph remains truthful

So this is a schema correction / hardening round, not a behavior redesign.

⸻

G. Assumptions Confirmed
	1.	ScheduleItemDependency in the current repo uses:
	•	predecessor_type
	•	predecessor_id
	•	successor_type
	•	successor_id
	•	offset_working_days
	2.	Dependency offset rewriting is the correct persistence mechanism for no-cascade manual edits.
	3.	Working-day difference is the intended basis for offset rewrite in this helper.

⸻

H. Edge Cases

1. Null dates

If either old or new start date is null:
	•	no adjustment is returned

2. No movement

If working-day shift is zero:
	•	no adjustment is returned

3. Non-schedule edges

The helper only adjusts dependencies where the moved item participates as a schedule node.

4. Negative offsets

Still allowed and valid.

⸻

I. What This Round Does NOT Do

R31 does not:
	•	add dependency editing UI
	•	add new logging behavior
	•	change save flow
	•	change pipeline order
	•	change baseline logic
	•	change presence logic

It only restores correctness in the dependency adjustment helper.

⸻

J. Status

Dependency adjustment logic is now back in alignment with:
	•	current repo types
	•	current DB shape
	•	current no-cascade product behavior

This closes the regression caused by the schema mismatch.

⸻

K. Next Recommended Work

R32 — Dependency editing UI

Add real user control for creating and changing dependencies directly in the schedule editor.

R33 — Schedule view model

Prepare the shared data contract for future List / Gantt / Calendar schedule views.

This keeps the next work focused on user-facing control, not more backend correction.