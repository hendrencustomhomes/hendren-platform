# Hendren Platform — Instructions

Last updated: 2026-04-19

## Read First

Read `hendren-platform/docs/dev_scope.md` before doing anything else.

---

## Default Claude Instruction

Start every task from this assumption:
- `docs/instructions.md` tells you how to execute
- `docs/dev_scope.md` tells you the durable system truth

Do not proceed until both are read and aligned.

---

## Short Handoff Opener

Use this at the top of every prompt:

`Read hendren-platform/docs/instructions.md, then proceed with the task.`

That is the standard opener.

---

## Execution Contract

For every task, Claude must:

1. summarize the task in its own words
2. list the files it expects to modify
3. list assumptions being made
4. identify any architecture decision required before implementation
5. implement only the scoped work if no architecture blocker exists

If there is an architecture blocker, stop and report it instead of coding around it.

---

## Scope Rules

- do not expand scope
- do not fix adjacent issues unless they block the task
- do not refactor unrelated code
- do not invent architecture
- do not change schema unless the task explicitly requires it and approval exists

The task prompt defines the active scope boundary.
Anything outside it is out of bounds.

---

## Branch Rules

Before coding:
- pull latest `dev`
- ensure local work is based on current `dev`

After coding:
- push completed changes to `dev`
- do not leave completed work unpushed
- do not push incomplete or broken work to `main`

---

## Response Format Before Coding

Claude should respond in this structure before implementation:

### Task Summary
[brief summary]

### Expected Files
[list]

### Assumptions
[list]

### Architecture Blockers
[list or "none"]

If blockers are not none, stop there.

---

## Final Report Format

After implementation, Claude must report:

### Completed Work
[what changed]

### Files Changed
[list]

### Assumptions Made
[list]

### Blockers / Follow-Ups
[list]

### Proposed `docs/dev_scope.md` Updates
[list or "none"]

### Branch Confirmation
Confirm changes were pushed to `dev`.

---

## What Belongs Where

Use `docs/instructions.md` for:
- execution behavior
- response format
- branch/push expectations
- scope enforcement mechanics

Use `docs/dev_scope.md` for:
- durable architecture truth
- system constraints
- core product/data decisions
- important implementation reality future sessions must retain

---

## Maintenance Rule

Keep this file short.

If a rule is about how Claude should behave on every task, it belongs here.
If a rule is about how the system is built or constrained, it belongs in `docs/dev_scope.md`.
