docs/schedule_module/schedule_r28.md

Schedule Module — R28 Deliverables

Date: 2026-04-11
Branch: dev
Scope: Logs foundation — unified linked logs system (no UI yet)

⸻

A. Summary

R28 introduces the foundational logging system for the platform via a new linked_logs table and supporting library functions.

This establishes a single, extensible logging model that can support:
	•	schedule change history
	•	call logs
	•	QC logs
	•	manual notes
	•	future audit trails and dashboards

This round is intentionally backend-only:
	•	no UI
	•	no automatic log creation yet
	•	no pipeline integration yet

The goal is to create a clean, durable foundation before attaching behavior.

⸻

B. Core Design Concept

All logs are modeled as:

“A record linked to an owner”

Where an owner can be:
	•	a schedule item
	•	a task
	•	a job
	•	a manual/global context

This avoids fragmented logging systems and enables a single query model across the platform.

⸻

C. Data Model

Table

linked_logs

Columns

Column	Type	Description
id	uuid (PK)	Unique log id
owner_type	text	Type of entity being logged
owner_id	uuid	ID of the entity
job_id	uuid (nullable)	Job context for grouping
log_type	text (nullable)	Category of log
note	text (nullable)	Freeform content
created_by	uuid (nullable)	User who created the log
created_at	timestamptz	Timestamp


⸻

D. Owner Types

type LogOwnerType =
  | 'schedule_item'
  | 'task'
  | 'job'
  | 'manual'

This allows logs to attach to any core entity without new tables.

⸻

E. Log Types

type LogType =
  | 'call_log'
  | 'qc'
  | 'schedule_change'
  | 'note'
  | 'other'

	•	Not enforced at DB level (text column)
	•	Controlled at application level
	•	Extensible without migrations

⸻

F. Library Implementation

File

src/lib/logs/types.ts

Defines:
	•	LinkedLog
	•	LogOwnerType
	•	LogType

⸻

File

src/lib/logs/index.ts

1. createLinkedLog(...)
Creates a new log row.

Behavior:
	•	inserts into linked_logs
	•	returns inserted row
	•	throws on error

Input:

{
  ownerType,
  ownerId,
  jobId,
  logType,
  note,
  createdBy
}


⸻

2. getLogsForOwner(...)
Fetches logs for a specific entity.

Behavior:
	•	filters by owner_type + owner_id
	•	orders newest first

⸻

G. Why This Matters

Up to this point, the system is:
	•	state-correct
	•	deterministic
	•	reactive

But it has no memory.

Without logs:
	•	you cannot explain changes
	•	you cannot audit behavior
	•	you cannot build trust in the system

This round introduces:

persistent operational memory

⸻

H. Design Constraints Enforced

1. No premature coupling

Logs are:
	•	not tied to schedule pipeline yet
	•	not tied to UI yet

This prevents:
	•	incorrect assumptions
	•	overfitting early use cases

⸻

2. Single-table strategy

All logs live in one table:
	•	avoids fragmentation
	•	simplifies querying
	•	enables future analytics

⸻

3. Nullable flexibility

Fields like:
	•	job_id
	•	log_type
	•	note
	•	created_by

are nullable to allow:
	•	system-generated logs
	•	partial logs
	•	future extensions

⸻

4. No validation at DB layer

Enums are not enforced in SQL.

Reason:
	•	faster iteration
	•	easier extension
	•	no migration overhead for new log types

⸻

I. What This Does NOT Do

R28 does NOT:
	•	automatically log schedule changes
	•	log baseline activation
	•	log dependency adjustments
	•	log presence activity
	•	provide UI to view logs
	•	enforce log schemas
	•	connect logs to tasks

This is intentional.

⸻

J. Assumptions
	1.	jobs.id and profiles.id are valid FK targets
	2.	gen_random_uuid() is available (pgcrypto enabled)
	3.	Internal-only access via is_internal() is sufficient for now
	4.	Logs volume will be moderate and manageable without indexing (initially)

⸻

K. Edge Cases (Deferred)

1. High-volume logging

No indexing strategy yet beyond PK.

Future:
	•	index (owner_type, owner_id)
	•	index (job_id)

⸻

2. Log deduplication

Multiple identical logs may be written.

No dedupe logic implemented.

⸻

3. Log editing / deletion

Logs are append-only in concept, but not enforced yet.

⸻

4. Structured metadata

No JSON field for structured payloads yet.

Future:
	•	meta jsonb

⸻

5. Cross-entity queries

No helper yet for:
	•	“all logs for a job across all owners”

⸻

L. Relationship to Architecture

This unlocks the next layer of the system:

From “state engine” → to “state + history system”

It is required before:
	•	dashboards
	•	audit trails
	•	intelligent alerts
	•	performance insights

⸻

M. Status

Logs foundation is now:
	•	defined
	•	implemented
	•	DB-backed
	•	queryable

No production-visible behavior yet.

⸻

N. Next Recommended Work

R29 — Schedule change logging
	•	create logs during save flow
	•	capture:
	•	date changes
	•	duration changes
	•	shift reason
	•	attach logs to schedule_item

R30 — Call task + log linkage
	•	tie call tasks to logs
	•	record completion notes

R31 — Basic log viewer
	•	simple read-only UI
	•	per schedule item or job

⸻

At this point, the system becomes not just correct — but explainable.