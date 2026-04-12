docs/schedule_module/schedule_r27.md

Schedule Module — R27 Deliverables

Date: 2026-04-11
Branch: dev
Scope: Multi-user edit presence wired into schedule edit UI (warning only, no locks)

⸻

A. Summary

R27 wires the already-built edit presence layer into the live schedule edit experience.

This makes concurrent editing visible to the user without introducing:
	•	locks
	•	blocked edits
	•	merge workflows
	•	save restrictions

The system now warns when another user is editing the same job schedule and continues to allow editing normally.

This matches the product rule:

Warn, do not restrict.

⸻

B. Exact Files Changed
	•	src/app/schedule/presenceActions.ts (new)
	•	src/app/schedule/ScheduleEditClient.tsx (modified)

⸻

C. New Server Action File

File

src/app/schedule/presenceActions.ts

Exports

enterScheduleEditPresenceAction(jobId)
Behavior:
	•	gets current authenticated user
	•	upserts presence row via setScheduleEditPresence(...)
	•	returns current count of other users editing via getScheduleEditPresence(...)

Return shape:

{
  ok: boolean
  otherUsersEditing?: number
  error?: string
}


⸻

refreshScheduleEditPresenceAction(jobId)
Behavior:
	•	same auth lookup
	•	refreshes last_seen_at through another upsert
	•	returns current count of other users editing

This is used for periodic keepalive / presence refresh during edit mode.

⸻

exitScheduleEditPresenceAction(jobId)
Behavior:
	•	gets current authenticated user
	•	deletes presence row via clearScheduleEditPresence(...)

Return shape:

{
  ok: boolean
  error?: string
}


⸻

D. UI Wiring in ScheduleEditClient

New imports

The client component now imports:
	•	useEffect
	•	useRef
	•	presence actions:
	•	enterScheduleEditPresenceAction
	•	refreshScheduleEditPresenceAction
	•	exitScheduleEditPresenceAction

New local state

Added:

const [otherUsersEditing, setOtherUsersEditing] = useState<number>(0)
const [presenceError, setPresenceError] = useState<string | null>(null)
const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

These track:
	•	how many other editors are active
	•	whether presence lookup/refresh failed
	•	active refresh timer while in edit mode

⸻

E. Presence Lifecycle Behavior

Enter edit mode

When the user clicks Edit Schedule:
	•	editMode becomes true
	•	presence effect begins
	•	enterScheduleEditPresenceAction(jobId) runs
	•	current other-editor count is loaded

While edit mode is active

The component refreshes presence every 15 seconds using:

refreshScheduleEditPresenceAction(jobId)

This:
	•	keeps the current user’s presence alive
	•	updates the count of other users editing

Exit edit mode

On edit-mode cleanup:
	•	timer is cleared
	•	exitScheduleEditPresenceAction(jobId) runs

This happens through:
	•	effect cleanup
	•	explicit cancel path
	•	successful save path

⸻

F. Exact User-Facing UI Behavior

1. Concurrent editor warning banner

Shown only when:
	•	editMode === true
	•	otherUsersEditing > 0

Banner text:

Another user is editing this schedule. Your changes may interfere.

Behavior:
	•	warning only
	•	no blocking
	•	no disabled save button
	•	no lock behavior

⸻

2. Presence failure banner

Shown only when:
	•	editMode === true
	•	presence system returned an error

Banner text:

Edit presence unavailable: {error}

Behavior:
	•	informational only
	•	editing remains allowed
	•	save remains allowed

This keeps the platform resilient even if presence lookup fails.

⸻

G. Save / Cancel Behavior

Cancel

handleCancel() now:
	1.	clears draft state
	2.	exits edit mode
	3.	clears local presence state
	4.	explicitly calls exitScheduleEditPresenceAction(jobId)

Save success

On successful save:
	1.	presence row is cleared
	2.	draft state is cleared
	3.	edit mode exits
	4.	presence counters/errors reset

This avoids leaving a stale active-editor row after a normal save.

⸻

H. Important Design Constraints Preserved

No locks

Users are never blocked from:
	•	entering edit mode
	•	saving changes
	•	cancelling
	•	editing while another user is present

No authority

Presence affects:
	•	warning UI only

Presence does not affect:
	•	pipeline execution
	•	dependency resolution
	•	baseline behavior
	•	task creation
	•	save permissions

Last write wins

Conflict behavior remains unchanged:
	•	whichever save lands last still wins

This round adds awareness, not conflict resolution.

⸻

I. Assumptions Made
	1.	profiles.id aligns with the authenticated user id returned from Supabase auth and can be used in schedule_edit_presence.user_id.
	2.	A 15-second refresh interval is sufficient for schedule editing presence without creating excessive load.
	3.	Explicit cleanup on save/cancel plus effect cleanup is acceptable even if exitScheduleEditPresenceAction(...) is called redundantly. Deleting an already-cleared row is harmless.
	4.	Warning users with only a count of other editors is enough for v1. No names or timestamps are required yet.

⸻

J. Edge Cases Intentionally Deferred

1. Stale presence from abrupt disconnect

If a user closes the browser or loses connection unexpectedly, a presence row may remain until a later cleanup strategy is added. This is acceptable for a warning-only system.

2. Multiple tabs by same user

Presence currently collapses by (job_id, user_id) at the DB level, which is acceptable. No tab-specific behavior is tracked.

3. Save failure after explicit exit attempt

If save fails, edit mode remains active and the presence effect continues refreshing. This is acceptable and correct for now.

4. User identity display

The warning does not show who else is editing. This is intentionally deferred to avoid premature UI complexity.

5. Cross-page cleanup

This round does not add route-change or browser unload cleanup beyond normal component unmount / effect cleanup.

⸻

K. Relationship to Architecture

R27 completes the first operational version of the product rule:

If two users edit at the same time, show a warning that their changes may interfere. Do not lock.

This keeps the platform aligned with the broader scheduling philosophy:
	•	minimal restriction
	•	visible risk
	•	user control preserved

⸻

L. Status

The schedule editor now has:
	•	edit presence tracking
	•	concurrent-edit warning
	•	graceful degradation when presence fails

This closes the basic multi-user awareness gap without making the system heavy-handed.

⸻

M. Next Recommended Work

R28 — dependency editing UI

Expose:
	•	attach before
	•	attach after
	•	insert between
	•	remove/reconnect

The backend support already exists. The next step is making it usable in the actual schedule editor.

R29 — logs foundation

Start recording schedule change history so the system gains operational intelligence, not just current-state correctness.