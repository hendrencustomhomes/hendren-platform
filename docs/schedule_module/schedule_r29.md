docs/schedule_module/schedule_r29.md

Schedule Module — R29 Deliverables

Date: 2026-04-11
Branch: dev
Scope: Schedule change logging — diff-based logs created during save flow

⸻

A. Summary

R29 activates the logging system introduced in R28 by wiring it directly into the schedule save flow.

Every meaningful schedule edit now produces a structured, human-readable log entry tied to the affected schedule item.

This transforms the system from:
	•	state-only → state + history
	•	reactive → traceable

Logs now capture:
	•	what changed
	•	how it changed
	•	why it changed (shift reason + note)
	•	who made the change

⸻

B. Exact Files Changed
	•	src/app/schedule/actions.ts (modified)

⸻

C. Core Behavior

When a user saves schedule edits:
	1.	Original rows are fetched before mutation
	2.	Updates are written to sub_schedule
	3.	Baseline reset (if mis_entry) is applied
	4.	Diff is computed per row
	5.	A log entry is created for each changed row
	6.	Pipeline runs as before

Logs are created before pipeline execution, ensuring they reflect:

user intent, not derived system changes

⸻

D. Logging Trigger Conditions

A log is created when:
	•	At least one tracked field changes
OR
	•	A shift reason or note is provided

No log is created when:
	•	nothing changed
	•	no reason was provided

This prevents noise and keeps logs meaningful.

⸻

E. Fields Tracked in Diff

The following fields are compared against original values:
	•	start_date
	•	duration_working_days
	•	include_saturday
	•	include_sunday
	•	buffer_working_days

Each change is recorded in a human-readable format:

Start: Apr 1 → Apr 5
Duration: 3 → 5
Sat: No → Yes


⸻

F. Shift Reason Integration

Shift reason data is appended to the log:

Reason: weather
Note: Rain delay

Final log structure:

Start: Apr 1 → Apr 5 | Duration: 3 → 5
Reason: weather | Note: Rain delay

	•	Changes and reasons are separated by newline
	•	Multiple changes are pipe-separated

⸻

G. Log Ownership Model

Each log is created as:

ownerType: 'schedule_item'
ownerId: schedule_item.id
jobId: jobId
logType: 'schedule_change'

This enables:
	•	per-item history
	•	job-level aggregation
	•	future dashboards

⸻

H. Ordering and Timing

Logs are created:
	•	after DB updates
	•	before pipeline execution

This ensures:
	•	logs reflect user edits
	•	not downstream dependency shifts or recalculations

⸻

I. Assumptions
	1.	All schedule updates pass through saveScheduleDraftAction
	2.	sub_schedule rows exist for all updated IDs
	3.	createLinkedLog is reliable and throws on failure
	4.	Logging failures should fail the entire save (intentional)

⸻

J. Design Constraints Enforced

1. No noisy logs

No-op updates do not generate logs

⸻

2. No derived-state logging

Only direct user edits are logged

⸻

3. Human-readable format

Logs are readable without parsing or tooling

⸻

4. No schema coupling

Logs remain flexible text — no rigid structure required

⸻

K. Edge Cases

1. Partial updates

Only changed fields are included in log

⸻

2. Null transitions

Handled explicitly:

Start: — → Apr 5


⸻

3. Reason-only edits

If user sets a reason without changing fields:
	•	log is still created
	•	contains only reason/note

⸻

4. Multiple row updates

Each row produces its own independent log

⸻

5. Logging failure

If log creation fails:
	•	entire save fails
	•	prevents silent data loss

⸻

L. What This Does NOT Do

R29 does NOT:
	•	log pipeline-induced changes
	•	log dependency lag adjustments
	•	log baseline activation
	•	log presence activity
	•	aggregate logs at job level
	•	provide UI for viewing logs

⸻

M. Relationship to Architecture

This fulfills the next critical layer:

“The system must explain what happened, not just reflect current state”

With R29:
	•	every meaningful edit is recorded
	•	every change has context
	•	system behavior becomes auditable

⸻

N. Status

Schedule logging is now:
	•	active
	•	consistent
	•	tied to user actions
	•	minimal but complete

The system now has:
	•	correctness (baseline)
	•	control (dependencies)
	•	awareness (presence)
	•	memory (logs)

⸻

O. Next Recommended Work

R30 — Baseline + task logging
	•	log baseline activation
	•	link call tasks to logs

R31 — Log viewer UI
	•	per schedule item
	•	simple read-only timeline

R32 — Pipeline logging (selective)
	•	log only significant derived impacts

⸻

At this point, the system becomes not just operational — but explainable and defensible.