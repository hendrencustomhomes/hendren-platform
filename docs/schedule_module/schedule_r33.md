Schedule Module — R33 Deliverables (Revised)

Date: 2026-04-11
Branch: dev
Scope: Dependency visibility in list view + dependency editing consolidation + material terminology cleanup

⸻

A. Summary

R33 improves the operational usability of the schedule editor by making dependencies visible in the main Labor Schedule list view while preserving the dependency editing system already introduced.

This round does three practical things:
	1.	Shows dependency context directly in the labor list view
	•	each labor item now shows what it depends on and what it blocks
	2.	Keeps dependency editing and preview operating on the same draft graph
	3.	Updates visible wording toward material terminology where safe, without changing typed data fields

This is a usability round, not a backend invention round.

⸻

B. Exact File Changed
	•	src/app/schedule/ScheduleEditClient.tsx (modified)

⸻

C. New Dependency Visibility in Labor List View

What was added

In non-edit mode, each labor row now shows dependency context beneath the Notes cell:
	•	Depends on: ...
	•	Blocks: ...

Example display:

Depends on: Framing (+0d), Windows (+2d)
Blocks: Paint (+1d)

Data source

This is computed from the current preview dependency graph, not raw DB-only state.

That means the dependency summaries reflect:
	•	server-loaded dependencies when simply viewing
	•	draft dependency changes while editing, once preview is recalculated

So the dependency information shown is aligned with the same graph the engine resolves against.

⸻

D. Dependency Summary Model

A derived map is built in the client:
	•	keyed by schedule item id
	•	contains:
	•	dependsOn[]
	•	blocks[]

Each entry contains:
	•	label
	•	offset

Only schedule → schedule relationships are summarized for this view.

Material-linked edges are intentionally excluded from the labor dependency summary block to keep it readable.

⸻

E. Offset Display

Offsets are shown in compact readable form:
	•	+0d
	•	+2d
	•	-1d

Formatting is handled by a small helper:

formatOffset(offset)

This keeps dependency summaries short enough to live inside the list view without adding more columns.

⸻

F. Why This Matters

Before R33:
	•	dependency editing existed
	•	dependency resolution existed
	•	dependency preview existed

But users still had poor visibility into the graph from the actual schedule list.

That meant:
	•	graph edits felt partially blind
	•	users had to mentally reconstruct relationships
	•	trust in dependency behavior was weaker than it should be

After R33:
	•	each item exposes its dependency context directly
	•	PMs can understand sequencing without leaving the main list
	•	the system feels more explainable

This is one of the highest-value usability improvements short of Gantt.

⸻

G. Material Terminology Cleanup

Visible empty-state copy in the Material Schedule section was updated from procurement wording to material wording.

Before
	•	“No procurement items yet”
	•	“Add procurement items…”

After
	•	“No material items yet”
	•	“Add material items…”

Important correction

An initial attempt also changed a data-field access from procurement_group toward material_group. That caused a TypeScript build failure because ProcurementItem does not define material_group.

The final corrected implementation keeps the existing typed field:

item.procurement_group || '—'

So:
	•	UI wording moves toward “material”
	•	data access remains on the actual typed schema

This keeps terminology improvement separate from schema changes.

⸻

H. Existing Dependency Editing Preserved

R33 does not redesign the dependency editing system introduced earlier. It preserves:
	•	draft dependency state
	•	attach after
	•	attach before
	•	insert between
	•	disconnect / reconnect
	•	remove link
	•	dependency section
	•	preview graph resolution using draft dependencies
	•	save flow that persists dependency inputs alongside normal edits

This round builds on that system rather than replacing it.

⸻

I. Existing Save/Preview Model Preserved

R33 keeps the same architecture:

Draft row edits

Stored in:
	•	draftOverrides

Draft dependency edits

Stored in:
	•	draftDependencies

Preview graph

Built from:
	•	edited row values
	•	draft dependency graph

Save

Submits:
	•	row updates
	•	dependency inputs

This remains the correct architecture because it keeps preview and persistence aligned.

⸻

J. Design Decision

The key design decision in this round is:

Do not add more dependency controls before users can actually see the graph clearly.

This is important because visibility reduces user error more than additional controls do.

Dependency visibility in the list view is therefore part of the launch-critical path, not cosmetic polish.

⸻

K. What This Round Does NOT Do

R33 does not:
	•	add Gantt view
	•	add calendar view
	•	add drag scheduling
	•	add dependency line drawing
	•	add editable offsets inline
	•	add dependency filtering
	•	add material dependency summaries to labor rows
	•	add log viewer UI
	•	rename underlying procurement data structures

Those remain future rounds.

⸻

L. Assumptions
	1.	Labor-row dependency visibility should focus on schedule-to-schedule relationships only.
	2.	Compact inline summaries are preferable to adding new dedicated columns.
	3.	Showing dependency context in read mode is more valuable right now than expanding edit-mode complexity.
	4.	The existing ScheduleItemDependency preview rows remain valid for client-side summary generation.
	5.	Terminology cleanup should stop at copy changes unless the underlying types and schema are intentionally updated.

⸻

M. Edge Cases

1. Items with no dependencies

Show:
	•	Depends on: —
	•	Blocks: —

2. Duplicate draft edges

Still prevented by the existing dedupeDependencies(...) helper.

3. Draft graph cycles

Preview engine behavior remains unchanged:
	•	resolve attempt in try
	•	fallback to raw nodes if resolution throws

4. Material-linked dependencies

Not shown in row summaries to avoid clutter.

5. Typed field mismatch during wording cleanup

Resolved by keeping procurement_group in code while shifting only user-facing copy to “material.”

⸻

N. Status

The schedule editor now has:
	•	row editing
	•	baseline controls
	•	presence warning
	•	shift reason capture
	•	no-cascade behavior
	•	dependency editing
	•	dependency visibility in the main list
	•	material-oriented user-facing wording where safe

This is a meaningful usability step toward launch.

⸻

O. Next Recommended Work

R34 — Templates + schedule creation flow

This is now the highest-value missing piece.

Why:
	•	current editing is becoming usable
	•	but schedule setup is still too manual
	•	templates are needed before launch-scale adoption

R35 — Gantt architecture

After templates / creation flow, move to the real schedule visualization architecture.

R36 — Log viewer

Logs already exist. They need operational visibility.