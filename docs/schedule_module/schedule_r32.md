docs/schedule_module/schedule_r32.md

Schedule Module — R32 Deliverables (Revised)

Date: 2026-04-11
Branch: dev
Scope: Dependency editing + working-day offset model + unified save pipeline

⸻

A. Summary

R32 introduces true dependency editing into the schedule system and completes the transition from legacy lag-based logic to a working-day offset model.

This revision aligns:
	•	data model (offset_working_days)
	•	dependency adjustment logic
	•	schedule resolution engine
	•	UI editing + preview

System is now operating on a single consistent dependency representation across backend and frontend.

⸻

B. Core Architectural Change

❌ Removed (implicitly deprecated)
	•	lag_days
	•	calendar-day diff logic for dependency shifts

✅ Introduced / Standardized
	•	offset_working_days
	•	working-day shift calculations
	•	typed dependency nodes (type + id)

This eliminates ambiguity between:
	•	calendar days vs working days
	•	schedule vs procurement references

⸻

C. Dependency Adjustment Engine (Critical)

File
	•	src/lib/schedule/dependencyBehavior.ts (or equivalent manual shift module)

Behavior

When a user:

moves a schedule item AND disables “shift dependencies”

We now:
	1.	Compute shift in working days
	2.	Rewrite dependency offsets instead of cascading dates

Key Logic
	•	Successor case:

newOffset = currentOffset + shiftDays


	•	Predecessor case:

newOffset = currentOffset - shiftDays



Working Day Calculation
	•	Mon–Fri only
	•	weekends excluded
	•	directionally correct (forward/backward)

Outcome

Graph structure remains stable while:
	•	preserving downstream dates
	•	reflecting user intent (manual override)

⸻

D. Save Pipeline (actions.ts)

File
	•	src/app/schedule/actions.ts

Responsibilities

R32 saveScheduleDraftAction now performs:
	1.	Fetch original rows
	2.	Apply row updates
	3.	Reset baseline when mis-entry
	4.	Conditionally adjust dependencies
	5.	Log all changes
	6.	Run schedule apply pipeline

Key Addition

if (u.shift_dependencies === false)

Triggers:
	•	computeManualShiftDependencyAdjustments
	•	applyManualShiftDependencyAdjustments

Result

Two distinct behaviors now exist:

Mode	Behavior
shift_dependencies = true	cascade graph
shift_dependencies = false	preserve graph via offset rewrite


⸻

E. Logging Layer

Schedule change logs now include:
	•	Start date changes
	•	Duration changes
	•	Weekend inclusion changes
	•	Buffer changes
	•	Shift reason + note
	•	Dependency preservation note

Example:

Manual move preserved downstream dates by rewriting 3 dependencies.

Baseline activation log includes:
	•	count of snapshotted schedule items

⸻

F. Schedule Edit Client (UI)

File
	•	src/app/schedule/ScheduleEditClient.tsx

Major Additions

1. Shift Dependencies Control

Per-row toggle:

Shift dependencies

Behavior
	•	ON → normal cascade behavior
	•	OFF → triggers offset rewrite logic

⸻

2. Draft State Expansion

Each row now tracks:

shift_dependencies: boolean
old_start_date: string | null

This enables:
	•	accurate diffing
	•	correct dependency adjustment inputs

⸻

3. Preview Engine Integrity

Preview now reflects:
	•	draft row overrides
	•	working-day calculations
	•	dependency behavior

This ensures:

what user sees before save = what backend will compute

⸻

4. Confirmed Shift Detection

System detects when:
	•	status === 'confirmed'
	•	AND start date changes via dependency resolution

Triggers UI warning:

X confirmed shifts — call tasks will be created


⸻

G. Task Trigger Pipeline Compatibility

R32 ensures compatibility with:
	•	ConfirmedStartShiftImpact
	•	createScheduleTriggeredCallTasks

Guarantee

When confirmed items shift:
	•	tasks are created
	•	duplicates avoided via open-task detection

⸻

H. Data Model Alignment

Dependencies now use:

predecessor_type
predecessor_id
successor_type
successor_id
reference_point
offset_working_days

No remaining reliance on:

lag_days ❌


⸻

I. System State After R32

Stable
	•	schedule editing
	•	dependency-aware resolution
	•	working-day math
	•	task triggering
	•	baseline activation
	•	logging

Newly Stable
	•	manual shift with dependency preservation
	•	offset-based dependency adjustments

⸻

J. Known Gaps (Intentional)

Not included in R32:
	•	dependency editing UI (attach/insert/remove)
	•	Gantt view
	•	calendar view
	•	visual graph editing

These remain next-phase work.

⸻

K. Risk Assessment

Low Risk
	•	build stability (post syntax fix)
	•	type consistency (lag removal complete)
	•	pipeline execution

Medium Risk
	•	working-day calculation edge cases:
	•	holidays (not modeled)
	•	timezone assumptions

Architectural Risk Removed
	•	mixed lag vs offset model
	•	inconsistent dependency representations

⸻

L. Bottom Line

R32 is the foundation release for:

deterministic, working-day-based scheduling with controlled dependency behavior

It unlocks:
	•	safe manual overrides
	•	predictable schedule math
	•	reliable downstream automation (tasks, alerts, baseline diffs)

⸻

M. Next Step (R33 Direction)
	•	dependency editing UI (graph manipulation)
	•	schedule visualization layer (Gantt)
	•	dependency debugging visibility

⸻

If you want, next move should be:
Gantt architecture (not code yet) — because everything underneath is now finally stable.