docs/schedule_module/schedule_r30.md

Schedule Module — R30 Deliverables

Date: 2026-04-11
Branch: dev
Scope: Baseline activation logging and call-task log linkage

⸻

A. Summary

R30 extends the new logs foundation into two important system-triggered behaviors:
	1.	Baseline activation now creates a job-level log
	2.	System-created call tasks now create linked logs

This round expands logging beyond manual schedule edits and begins establishing the rule that important automated actions should also leave a record.

The result is a more explainable system:
	•	baseline creation is visible in job history
	•	call-task creation is visible both on the task and on the originating schedule item

⸻

B. Exact Files Changed
	•	src/app/schedule/actions.ts (modified)
	•	src/lib/schedule/taskTriggers.ts (modified)

⸻

C. Baseline Activation Logging

File

src/app/schedule/actions.ts

Behavior added

Inside activateBaselineAction(jobId):

After:

const result = await setJobBaseline(supabase, jobId, user?.id ?? null)

the system now creates a linked log:

await createLinkedLog(...)

Log ownership
	•	ownerType: 'job'
	•	ownerId: jobId
	•	jobId: jobId
	•	logType: 'note'

Log message

The note records baseline activation and, when applicable, how many schedule rows were snapshotted.

Example:

Baseline activated

or

Baseline activated (12 schedule items snapshotted)

Why this matters

Baseline activation is a major project event. Logging it at the job level means:
	•	the action is auditable
	•	later analysis can show when baseline started
	•	baseline state is no longer “silent”

⸻

D. Call Task Log Linkage

File

src/lib/schedule/taskTriggers.ts

New behavior

When a new system-triggered call task is created, the system now creates two logs.

⸻

1. Task-owned log

Ownership:
	•	ownerType: 'task'
	•	ownerId: createdTaskId
	•	jobId: impact.jobId
	•	logType: 'call_log'

Purpose:
	•	gives the created task its own origin record
	•	supports future task-level history

Example note:

System-created call task for confirmed start shift on schedule item abc123. 2026-04-01 → 2026-04-15


⸻

2. Schedule-item-owned log

Ownership:
	•	ownerType: 'schedule_item'
	•	ownerId: impact.scheduleId
	•	jobId: impact.jobId
	•	logType: 'schedule_change'

Purpose:
	•	records that the schedule item triggered a call task
	•	ties communication follow-up back to the schedule item

Example note:

Call task created: Call Smith Framing


⸻

E. Authentication / createdBy Behavior

In actions.ts

activateBaselineAction already loads the current auth user.
That same user id is now passed to createLinkedLog(...) as:

createdBy: user?.id ?? null

In taskTriggers.ts

The function now performs an auth lookup:

const {
  data: { user },
} = await supabase.auth.getUser()

That value is used as:

createdBy: user?.id ?? null

This means:
	•	when a real authenticated user triggered the chain, the logs show ownership
	•	if no user is available, logs still succeed with createdBy: null

⸻

F. Relationship to Existing Logging

R29 already logged:
	•	direct manual schedule edits

R30 now adds logs for:
	•	baseline activation
	•	system-created call tasks

So the log model now captures both:
	•	manual user actions
	•	important automated consequences

That is a major step toward a complete operational audit trail.

⸻

G. Design Constraints Preserved

1. No UI added

R30 adds no log viewer UI.
This remains backend-only.

2. No task schema changes

Task creation behavior is unchanged except for added logs.

3. No new tables

R30 uses the existing linked_logs table introduced in R28.

4. No change to task duplicate-prevention logic

Open-task detection behavior is unchanged.

⸻

H. Assumptions Made
	1.	createLinkedLog(...) is safe to call inline during baseline activation and task creation.
	2.	supabase.auth.getUser() is available in taskTriggers.ts and returns the initiating user when present.
	3.	Logging failure should fail the parent operation.
This is consistent with the broader “fail loud rather than silently lose history” direction.
	4.	Using logType: 'note' for baseline activation is acceptable for now, even though a future dedicated baseline_event type may be added later.

⸻

I. Edge Cases Intentionally Deferred

1. Duplicate log suppression

If higher-level code retries after a partial failure, duplicate logs may be possible. No dedupe logic is added in this round.

2. Log grouping

The two logs created for a call task are not explicitly cross-linked beyond shared job/task/schedule references.

3. Baseline re-activation attempts

Failed baseline activation attempts are not logged. Only successful activation is logged.

4. Skipped call-task cases

When a call task is not created because an open matching task already exists, no log is written. Only actual task creation is logged.

⸻

J. What This Does NOT Do

R30 does not:
	•	add a log viewer
	•	log presence events
	•	log dependency offset rewrites separately
	•	log pipeline-derived shifts
	•	log skipped call-task creation
	•	log baseline reset events independently

Those are still future rounds.

⸻

K. Relationship to Architecture

R30 moves the platform another step toward:

not just correct, but explainable

Now the system records:
	•	when a baseline was established
	•	when an automated communication task was created
	•	which schedule item triggered it

That strengthens trust and gives PMs a clearer operational trail.

⸻

L. Status

The logs system now covers:
	•	manual schedule edits
	•	baseline activation
	•	system-created call tasks

This is the first meaningful expansion from user-edit logs into system-event logs.

⸻

M. Next Recommended Work

R31 — Basic log viewer UI

Create a simple read-only log view for:
	•	schedule items
	•	tasks
	•	job-level history

R32 — Baseline reset logging

When mis_entry overwrites a baseline, create an explicit log.

R33 — Dependency-adjustment logging

When no-cascade rewrites dependency offsets, create a separate structured log entry instead of only embedding it inside schedule-change notes.