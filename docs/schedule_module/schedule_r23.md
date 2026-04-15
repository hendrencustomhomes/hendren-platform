Schedule Module — R23 Deliverables

Date: 2026-04-11
Branch: dev
Scope: Per-item baseline reset (mis-entry exception)

⸻

A. Summary

R23 implements the per-item baseline reset exception defined in the baseline architecture.

This allows a schedule item’s baseline dates to be overwritten only when the shift reason type indicates a mis-entry / wrong original date.

This is a narrow, explicit exception to the otherwise immutable baseline rule.

⸻

B. Core Behavior

A baseline reset is executed when ALL of the following are true:
	1.	A schedule item is being updated
	2.	shift_reason_type === 'mis_entry'
	3.	The item exists in sub_schedule

When triggered, the system:
	•	Sets baseline_start_date = start_date
	•	Sets baseline_end_date = end_date

This occurs immediately after the user’s manual edit is written.

⸻

C. Implementation Location

File

src/lib/schedule/baselineReset.ts

Function

resetBaselineForItemIfMisEntry(supabase, scheduleId, shiftReasonType)

Invocation Point

Inside saveScheduleDraftAction after each row update:
	•	Ensures reset happens before pipeline execution
	•	Guarantees downstream variance reflects corrected baseline immediately

⸻

D. Why This Exists

Without this, baseline would incorrectly treat bad original data as real schedule drift.

Example:
	•	Original entry: April 1 (wrong)
	•	Correct date: April 10

Without reset → shows +9 day delay (false)
With reset → shows 0 (correct)

⸻

E. Design Constraints Enforced

1. No Silent Resets

Reset only occurs when:

shift_reason_type === 'mis_entry'

No other reason type can trigger this.

⸻

2. No Bulk Reset

Reset is:
	•	per-item
	•	per-update

There is no job-wide reset

⸻

3. No Impact on Logs

Reset does NOT:
	•	delete logs
	•	modify historical records

Logs still capture the change event.

⸻

4. No Interaction With Pipeline Logic

Reset does not:
	•	affect dependency resolution
	•	affect cascade behavior
	•	affect call task triggers

It only adjusts baseline reference values.

⸻

F. Sequence Integration

Final save flow:

1. User edits schedule
2. Row updated in sub_schedule
3. IF mis_entry → baseline reset applied
4. runScheduleApplyPipeline()
   - resolve
   - detect impacts
   - apply
   - create call tasks

This guarantees:
	•	baseline is correct BEFORE impact detection
	•	no false “call task” from mis-entry corrections

⸻

G. Assumptions
	1.	shift_reason_type is already written to DB prior to reset call
	2.	mis_entry is a valid controlled value (not free text)
	3.	start_date and end_date represent corrected values at time of reset

⸻

H. Edge Cases

1. Null Dates

If start_date or end_date is null:
	•	baseline fields will also be set to null
	•	this is intentional (mirrors corrected state)

⸻

2. Multiple Mis-Entry Updates

If a user corrects multiple times:
	•	baseline will be overwritten each time
	•	final value represents latest corrected “true baseline”

⸻

3. Incorrect Reason Usage

If user selects mis_entry incorrectly:
	•	baseline will be overwritten
	•	system does not prevent misuse

This is intentional — no restriction model.

⸻

I. Relationship to Architecture

This completes Section F of the baseline architecture:

“A narrow exception exists for mis-entry… baseline may be overwritten”

All baseline rules are now enforced in code:
	•	one baseline per job ✓
	•	auto-population on insert ✓
	•	no locks ✓
	•	per-item reset ✓

⸻

J. Status

Baseline system is now:
	•	fully operational
	•	architecturally aligned
	•	safe against false variance

Next risks are no longer data correctness — they are multi-user interaction and dependency control.

⸻

K. Next Recommended Work
	•	R24 — Multi-user edit warning
	•	R25 — Shift Dependencies toggle behavior
	•	R26 — Lag recalculation logic

These move the system from correct → resilient → usable at scale.