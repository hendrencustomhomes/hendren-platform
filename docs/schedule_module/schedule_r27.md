You’re right.

docs/schedule_module/schedule_r27.md

Schedule Module — R27 Deliverables

Date: 2026-04-11
Branch: dev
Scope: Multi-user edit presence warning wired into the schedule edit UI

⸻

A. Summary

R27 connects the previously built schedule edit presence layer to the live schedule edit experience.

This round makes concurrent editing visible to the user without introducing:
	•	locks
	•	blocked edits
	•	merge workflows
	•	save restrictions

The schedule editor now shows a warning when another user is editing the same job schedule, while still allowing full editing and save behavior.

This preserves the product rule:

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
	•	creates server Supabase client
	•	gets current authenticated user
	•	writes or refreshes that user’s presence row for the job
	•	returns count of other users currently editing

Return shape:

{
  ok: boolean
  otherUsersEditing?: number
  error?: string
}

refreshScheduleEditPresenceAction(jobId)
Behavior:
	•	same auth lookup
	•	re-upserts presence row
	•	returns updated count of other users editing

This is used for keepalive refresh while edit mode remains open.

exitScheduleEditPresenceAction(jobId)
Behavior:
	•	gets current authenticated user
	•	clears that user’s presence row for the job

Return shape:

{
  ok: boolean
  error?: string
}


⸻

D. Presence Lifecycle in the Client

Enter edit mode

When the user clicks Edit Schedule:
	•	editMode becomes true
	•	client calls enterScheduleEditPresenceAction(jobId)
	•	returned otherUsersEditing count is stored in local state

While edit mode is active

A repeating 15-second timer calls:

refreshScheduleEditPresenceAction(jobId)

This:
	•	refreshes the current user’s presence
	•	updates the count of other active editors

Exit edit mode

On cleanup:
	•	refresh timer is cleared
	•	client calls exitScheduleEditPresenceAction(jobId)

This happens through:
	•	effect cleanup
	•	explicit cancel path
	•	successful save path

⸻

E. Exact UI Behavior Added

1. Concurrent editor warning

Shown only when:
	•	editMode === true
	•	otherUsersEditing > 0

Banner text:

Another user is editing this schedule. Your changes may interfere.

Behavior:
	•	warning only
	•	no blocking
	•	save still allowed
	•	cancel still allowed
	•	edit mode remains active

2. Presence failure warning

Shown only when:
	•	editMode === true
	•	presence calls fail

Banner text:

Edit presence unavailable: {error}

Behavior:
	•	informational only
	•	editing still allowed
	•	save still allowed

This preserves usability even if presence tracking is temporarily unavailable.

⸻

F. Changes Inside ScheduleEditClient.tsx

New imports

Added:
	•	useEffect
	•	useRef
	•	presence actions from ./presenceActions

New local state

Added:

const [otherUsersEditing, setOtherUsersEditing] = useState<number>(0)
const [presenceError, setPresenceError] = useState<string | null>(null)
const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

New effect

A useEffect tied to [editMode, jobId] now:
	•	enters presence on edit start
	•	refreshes every 15 seconds
	•	clears timer on cleanup
	•	exits presence on cleanup

Edit button change

Clicking Edit Schedule now:
	•	clears stale presence error
	•	resets other-editor count
	•	enters edit mode

Cancel behavior

handleCancel() now:
	•	clears draft state
	•	exits edit mode
	•	clears local presence state
	•	explicitly calls exitScheduleEditPresenceAction(jobId)

Save success behavior

On successful save:
	•	presence row is explicitly cleared
	•	draft state is reset
	•	edit mode exits
	•	presence state is cleared

⸻

G. What Did Not Change

R27 does not:
	•	lock the record
	•	block saves when another user is present
	•	show usernames of other editors
	•	show timestamps in UI
	•	change pipeline behavior
	•	change baseline behavior
	•	change dependency logic
	•	change task creation logic

This is awareness only.

⸻

H. Assumptions Made
	1.	The authenticated user id returned by Supabase auth is the correct id to use with schedule_edit_presence.user_id.
	2.	A 15-second refresh interval is frequent enough to keep presence useful without creating excessive write load.
	3.	Redundant cleanup is acceptable.
exitScheduleEditPresenceAction(...) may be called both from explicit handlers and from effect cleanup. This is safe.
	4.	A count of other editors is sufficient for v1.
No names or identity details are needed yet.

⸻

I. Edge Cases Intentionally Deferred

1. Stale presence after abrupt disconnect

If a user closes the browser or loses connection unexpectedly, their presence row may remain temporarily. This is acceptable for a warning-only system.

2. Multiple tabs by same user

Multiple tabs from the same user on the same job are not separately distinguished in the UI.

3. Route-change / unload sophistication

No special browser unload or route-transition handling was added beyond component cleanup.

4. User identity display

The warning does not yet show who else is editing. This is deferred to avoid premature UI complexity.

5. Presence timeout cleanup

This round does not add server-side stale-row expiration logic. That can be added later if stale warnings become noisy.

⸻

J. Relationship to Architecture

R27 implements the product decision:

If two users edit the same schedule at the same time, show a warning only. No locks.

This keeps the system aligned with the broader platform philosophy:
	•	minimal restriction
	•	visible risk
	•	user control preserved
	•	no “stupid software” lock frustration

⸻

K. Status

The schedule editor now has:
	•	edit presence tracking
	•	concurrent-edit warning
	•	graceful degradation when presence fails

This closes the first multi-user awareness gap without making the system rigid.

⸻

L. Next Recommended Work

R28 — dependency editing UI

Expose the dependency operations that already exist in the backend:
	•	attach before
	•	attach after
	•	insert between
	•	remove / reconnect

R29 — logs foundation

Begin capturing schedule changes as operational history so the system improves over time, not just in current-state correctness.