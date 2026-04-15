docs/schedule_module/schedule_r26.md

Schedule Module — R26 Deliverables

Date: 2026-04-11
Branch: dev
Scope: Apply manual-shift dependency adjustments to DB through the schedule edit save flow

⸻

A. Summary

R26 wires the manual no-cascade behavior into the real save flow.

This is the first revision where the user-facing meaning of “Shift Dependencies” becomes operational:
	•	when checked, schedule changes behave normally and cascade through the dependency graph
	•	when unchecked, downstream schedule items are not shifted
	•	instead, the system rewrites offset_working_days on touching dependencies so the graph stays truthful

This preserves the core product rule:

There should never be an out-of-sync state.

⸻

B. Exact Files Changed
	•	src/lib/schedule/manualShift.ts (new)
	•	src/app/schedule/actions.ts (modified)
	•	src/app/schedule/ScheduleEditClient.tsx (modified)

⸻

C. New Library File

File

src/lib/schedule/manualShift.ts

Exports

computeManualShiftDependencyAdjustments(...)
Computes dependency offset rewrites when a schedule item is manually shifted and the user chooses not to cascade dependencies.

Inputs:
	•	movedItemId
	•	oldStartDate
	•	newStartDate
	•	dependencies

Output:
	•	ManualShiftDependencyAdjustment[]

Shape:

{
  dependencyId: string
  newOffsetWorkingDays: number
}

applyManualShiftDependencyAdjustments(...)
Persists the computed adjustments to schedule_item_dependencies by updating:

offset_working_days

Returns:
	•	array of updated dependency ids

⸻

D. Manual Shift Calculation Behavior

Date difference model

R26 uses working-day difference, not raw calendar-day subtraction.

The helper:
	•	parses local ISO dates safely
	•	counts Mon–Fri movement only
	•	returns:
	•	positive number when moved later
	•	negative number when moved earlier
	•	zero when unchanged

This matches the schedule system’s broader working-day model more closely than calendar math.

⸻

Dependency rewrite model

For each dependency touching the moved item:

Case 1 — moved item is successor
Match:

dep.successor_type === 'schedule' &&
dep.successor_id === movedItemId

Rewrite:

newOffsetWorkingDays = dep.offset_working_days + shiftDays

Meaning:
	•	moved later → successor needs more offset from predecessor
	•	moved earlier → successor needs less offset

Case 2 — moved item is predecessor
Match:

dep.predecessor_type === 'schedule' &&
dep.predecessor_id === movedItemId

Rewrite:

newOffsetWorkingDays = dep.offset_working_days - shiftDays

Meaning:
	•	moved later → successors are now effectively closer → reduce offset
	•	moved earlier → successors are now effectively farther away → increase offset

⸻

E. Save Flow Changes

src/app/schedule/actions.ts

DraftScheduleItemUpdate was extended with:

shift_dependencies: boolean
old_start_date: string | null

These fields are now carried from the draft UI into the server action.

New imports added

import { getScheduleDependencies } from '@/lib/db'
import {
  applyManualShiftDependencyAdjustments,
  computeManualShiftDependencyAdjustments,
} from '@/lib/schedule/manualShift'

Save behavior

Before the update loop:
	•	fetch all job dependencies once using getScheduleDependencies(supabase, jobId)

Inside the loop for each updated labor row:
	1.	update sub_schedule
	2.	run resetBaselineForItemIfMisEntry(...)
	3.	if shift_dependencies === false
	•	compute dependency adjustments
	•	persist them to schedule_item_dependencies

After all row writes complete:
	•	run runScheduleApplyPipeline(...)

This means the final save order is:

1. write row edits
2. apply mis-entry baseline reset if needed
3. rewrite dependency offsets when no-cascade is chosen
4. run full resolve/apply/task pipeline

That order is correct because the pipeline should resolve from the newly saved dependency state, not the old one.

⸻

F. UI Changes

src/app/schedule/ScheduleEditClient.tsx

ScheduleDraftOverride now includes:

shift_dependencies: boolean
old_start_date: string | null

Default seeding on first edit:

shift_dependencies: true
old_start_date: original.start_date

This is important because:
	•	checked/default behavior remains normal cascade
	•	old_start_date preserves the pre-edit anchor needed to compute manual shift distance later

Save payload

Each row save payload now includes:

shift_dependencies: override.shift_dependencies
old_start_date: override.old_start_date

Edit-mode UI

A new checkbox was added in labor edit mode:

Shift dependencies

Behavior:
	•	shown only in edit mode
	•	checked by default
	•	when unchecked, downstream dates are preserved and dependency offsets are rewritten instead of cascading

This keeps the UX simple and explicit:
	•	user chooses whether a manual move should propagate

⸻

G. Exact User-Facing Meaning

When Shift dependencies is checked
	•	normal behavior
	•	dependency graph resolves normally
	•	downstream items may move

When Shift dependencies is unchecked
	•	manually edited item moves
	•	downstream items do not move just because of that edit
	•	dependency edges remain in place
	•	offset_working_days is rewritten so the graph still reflects reality

This is the product-safe model because it avoids:
	•	forced cascade
	•	broken dependencies
	•	hidden mismatches

⸻

H. Assumptions Made
	1.	ScheduleItemDependency uses the canonical schema:
	•	predecessor_type
	•	predecessor_id
	•	successor_type
	•	successor_id
	•	offset_working_days
	2.	offset_working_days is always present and writable.
	3.	Working-day shift difference for this manual adjustment uses Mon–Fri only.
It does not inspect per-row weekend flags because dependency offsets are shared relationship values, not row-local duration rules.
	4.	old_start_date is captured from the original row at the moment the first draft override is created and remains the comparison anchor through that edit session.
	5.	The dependency list fetched once before the loop is sufficient for this round.
The function does not re-fetch after each rewrite.

⸻

I. Important Correction From Earlier Drafting

R26 depends on the corrected R25 model.

Earlier drafting used the wrong dependency shape:
	•	lag_days
	•	predecessor_schedule_id
	•	successor_schedule_id

That was incorrect for this project.

The real system uses:
	•	offset_working_days
	•	predecessor_type / predecessor_id
	•	successor_type / successor_id

R26 is implemented against the correct schema.

⸻

J. Edge Cases Intentionally Deferred

1. Multiple edited items in one save

If multiple connected schedule items are edited in the same draft session with shift_dependencies === false, adjustments are computed per row using the single dependency snapshot fetched before the loop. This is acceptable for now but may need refinement later if complex multi-row no-cascade edits become common.

2. Weekend-aware offset semantics

The manual shift difference uses Mon–Fri movement only. It does not yet incorporate item-level include_saturday / include_sunday flags into offset rewriting. This is acceptable for now but may need future product clarification.

3. Presence / multi-user interaction

R26 does not interact with the multi-user presence system yet. Concurrent no-cascade edits still follow last-write-wins behavior.

4. UI explanation text

The checkbox does not yet include a longer explanation tooltip or helper text. The label is intentionally minimal in this round.

5. Dependency preview semantics

The preview system already reflects the current draft graph, but this round does not add any extra explanatory UI telling the user that unchecked cascade will rewrite dependency offsets on save.

⸻

K. Relationship to Architecture

R26 is the first full implementation of the rule:

Either shift or don’t, and display real info.

Unchecked cascade no longer implies:
	•	stale graph
	•	hidden mismatch
	•	broken dependency meaning

Instead, it rewrites the relationship so saved state remains truthful.

That makes the schedule system more usable without adding locks or over-restriction.

⸻

L. Status

R26 completes the first operational version of:
	•	manual move
	•	explicit cascade choice
	•	truthful dependency preservation

This is a major interaction milestone for the schedule module.

⸻

M. Next Recommended Work

R27 — UI warning/presence wiring

Use the already-built presence layer to warn when another user is editing the same schedule.

R28 — dependency editing UI

Expose attach before / attach after / insert between / remove with reconnect in the actual schedule editor.

R29 — logs foundation

Begin recording schedule change history so the system gains operational intelligence, not just current-state correctness.