Schedule Module — R24 Deliverables

Date: 2026-04-11
Branch: dev
Scope: Multi-user edit presence (warning only, no locks)

⸻

A. Summary

R24 introduces a lightweight presence layer to detect when multiple users are editing the same job schedule concurrently.

This implementation is non-blocking and non-authoritative:
	•	No locks
	•	No prevention of edits
	•	No merge logic

It exists purely to surface awareness and reduce accidental overwrite.

⸻

B. Core Behavior

When a user enters schedule edit mode:
	•	Their presence is written to schedule_edit_presence

While editing:
	•	Their presence is refreshed (via repeated upsert calls)

When exiting edit mode (cancel/save/navigation):
	•	Their presence row is removed

Other users querying the same job can detect:
	•	How many other users are currently editing

⸻

C. Data Model

Table

schedule_edit_presence

Columns
	•	job_id (uuid, PK part, FK → jobs)
	•	user_id (uuid, PK part, FK → profiles)
	•	last_seen_at (timestamptz)

Primary Key

(job_id, user_id)

RLS
	•	Enabled
	•	Policy: FOR ALL USING (is_internal())

⸻

D. Library Implementation

File

src/lib/schedule/editPresence.ts

Functions

1. setScheduleEditPresence
Upserts presence row:
	•	Writes job_id, user_id, last_seen_at
	•	Safe to call repeatedly (idempotent via PK)

⸻

2. clearScheduleEditPresence
Deletes presence row:
	•	Called on exit from edit mode

⸻

3. getScheduleEditPresence
Returns:

{ otherUsersEditing: number }

	•	Filters out current user
	•	Counts only other active editors

⸻

E. Why This Exists

Two PMs editing the same schedule can:
	•	overwrite each other
	•	create conflicting dependency changes
	•	generate misleading call tasks

Without awareness, this feels like:

“stupid software lost my changes”

This layer prevents that perception without restricting behavior.

⸻

F. Design Constraints Enforced

1. No Locks

Users are never blocked from editing.

⸻

2. No Authority

Presence data:
	•	does not affect saves
	•	does not affect pipeline
	•	does not affect baseline

⸻

3. Last Write Wins (unchanged)

Conflict resolution remains:
	•	whichever save occurs last overwrites

⸻

4. Minimal Surface Area

No timestamps or usernames are returned yet — only a count.

This avoids premature UI complexity.

⸻

G. Sequence Integration (Planned Next Step)

This layer will be wired into UI in the next revision:

Enter edit mode → set presence
Polling / refresh → get presence
Exit edit mode → clear presence

UI behavior:
	•	If otherUsersEditing > 0
	•	Show warning banner

⸻

H. Assumptions
	1.	profiles.id matches Supabase auth user id
	2.	Presence writes are cheap and frequent (acceptable load)
	3.	Users will not leave sessions open indefinitely

⸻

I. Edge Cases

1. Stale Presence

If a user closes browser abruptly:
	•	row may persist

Mitigation (future):
	•	expire based on last_seen_at

⸻

2. Rapid Tab Switching

Multiple tabs from same user:
	•	collapse into single row (same PK)

Correct behavior

⸻

3. Network Loss

Presence may not clear

Acceptable — warning only system

⸻

J. Relationship to Architecture

This fulfills Section L of the baseline architecture:

“Multi-user editing warning without locks”

System behavior now aligns with principles:
	•	no restrictions ✓
	•	minimal friction ✓
	•	visible risk ✓

⸻

K. Status

Presence detection is:
	•	implemented
	•	DB-backed
	•	ready for UI wiring

No production behavior changes yet until UI integration.

⸻

L. Next Step

R25 — UI wiring:
	•	hook presence into edit mode
	•	add warning banner
	•	optional polling interval

After that:
	•	dependency control (Shift Dependencies)
	•	lag recalculation

These complete the interaction safety layer of the schedule system.