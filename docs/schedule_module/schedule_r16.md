Schedule Module — R16 (Skipped Round)

Date: 2026-04-11
Branch: dev
Status: Skipped intentionally

⸻

A. Summary

R16 was intentionally skipped.

The originally expected progression would have introduced an intermediate step between:
	•	R15 (Edit Mode UI + draft pipeline)
	•	R17 (Baseline schema + server-side implementation)

However, during architecture review, it became clear that inserting an additional round would not add meaningful value and would instead fragment the implementation of a tightly coupled concept.

Baseline is not a UI feature. It is a data model + system behavior layer that must exist fully and correctly at the database and server level before any UI interaction is built on top of it.

As a result, the decision was made to:
	•	skip R16 entirely
	•	move directly from R15 → R17
	•	implement baseline as a complete vertical slice at the schema + server layer first

⸻

B. What R16 Would Have Been

R16 would have likely contained one of the following:
	•	Partial baseline UI scaffolding (buttons, indicators)
	•	Placeholder baseline fields without full write logic
	•	Early variance computation without schema backing
	•	Intermediate wiring between edit mode and baseline

All of these options share the same flaw:
They introduce partial state without system authority, which violates core architecture rules already established.

⸻

C. Why R16 Was Skipped

1. Avoid Partial System States

Baseline has a strict requirement:

There must never be an “out-of-sync” or “invalid” baseline state.

A partial implementation (UI without schema, schema without write flow, or write flow without trigger support) would create exactly that condition:
	•	items missing baseline fields
	•	UI indicating baseline exists when it is incomplete
	•	inconsistent behavior for newly added schedule items

Skipping R16 ensured that:
	•	baseline enters the system only when it is structurally correct
	•	no transitional broken states are introduced

⸻

2. Baseline Is Not Incremental

Unlike the schedule engine or dependency system, baseline is not naturally incremental.

It requires:
	•	schema (baseline fields + job-level marker)
	•	write flow (snapshot existing rows)
	•	DB trigger (auto-populate new rows)

These three components must exist together to satisfy core guarantees:
	•	no orphaned items
	•	consistent variance calculation
	•	stable reference layer

R17 delivers all three in one step. Splitting them across R16 and R17 would increase risk without benefit.

⸻

3. Maintain Clean Separation of Concerns

The architecture direction emphasizes strict layering:
	•	Engine → resolves schedule
	•	Apply → persists schedule
	•	Impacts → detects change
	•	Tasks → drives action
	•	Baseline → measures drift

R16 would have blurred boundaries by prematurely introducing:
	•	UI behavior without backing data guarantees
	•	logic that belongs to baseline into the schedule edit layer

Skipping R16 preserves:
	•	clean layering
	•	predictable responsibilities
	•	easier long-term maintenance

⸻

4. Reduce Rework Risk

Any UI or partial logic introduced before baseline schema is finalized would likely require rework once:
	•	trigger behavior is defined
	•	baseline activation flow is finalized
	•	per-item reset rules are implemented

By skipping R16:
	•	no temporary abstractions were introduced
	•	no UI needed to be rewritten
	•	baseline entered the system in a stable form

⸻

D. Resulting Sequence

The adjusted progression is:
	•	R15 — Edit Mode + draft + preview pipeline
	•	R16 — skipped
	•	R17 — Baseline schema + server-side implementation

This keeps the system aligned with an architecture-first approach, where:
	•	data model and invariants are established before UI
	•	system guarantees are enforced at the lowest level first

⸻

E. Impact on Future Rounds

Skipping R16 simplifies future work:

Next logical steps:
	•	R18 — Baseline activation entry point (server action + minimal UI surface)
	•	R19 — Baseline overlay (variance view)
	•	R20+ — Logs + shift reason integration + reporting

Because R17 delivered a complete foundation, all future rounds can assume:
	•	baseline always exists in a valid state when active
	•	all schedule items are baseline-aware
	•	no special-case handling for missing data is required

⸻

F. Key Principle Reinforced

This decision reinforces a core platform principle:

Do not introduce user-facing features until the underlying system can guarantee correctness.

R16 would have violated that principle. Skipping it keeps the system consistent, predictable, and maintainable.

⸻

G. Summary

R16 was not omitted accidentally — it was deliberately removed to prevent:
	•	partial implementation of a non-incremental system
	•	UI built on unstable data
	•	rework and inconsistency

R17 now serves as the true starting point of the baseline system, with a complete and reliable foundation.
