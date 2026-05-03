# Actions GPT — Start Here

Status: active entry point  
Branch target: `dev`  
Purpose: mandatory starting point for every fresh Actions GPT session.

---

## 1. Non-negotiable

Start here. Not from memory. Not from prior chats. Not from `main`.

---

## 2. Startup sequence (always follow)

1. Read this file
2. Read `docs/actions/current.md`
3. Read ONLY the docs listed inside `current.md`
4. Confirm branch = `dev`
5. Summarize current state + next 1–3 slices BEFORE doing work

If `current.md` does not exist → create it before implementation work.

---

## 3. Source of truth order

1. `docs/actions/START_HERE.md`
2. `docs/actions/current.md`
3. `docs/actions/handoff_latest.md`
4. Active docs listed in `current.md`

Everything else is secondary unless explicitly referenced.

---

## 4. Branch rule

`dev` is the only development truth.

- Do NOT treat `main` as current
- No long-lived side branches
- Short branches only for contained risk, then merge back to `dev`

---

## 5. Session constraint

Each chat = **1–3 slices max**

A slice must be:
- bounded
- testable
- non-drifting

Stop before context gets fuzzy.

---

## 6. Sync rule

Every new session begins with a sync:

- Read `current.md`
- Verify against repo
- Identify stale docs
- Propose next 1–3 slices

No blind execution.

---

## 7. Handoff rule

End of session must:

- Update `docs/actions/current.md` (if truth changed)
- Overwrite `docs/actions/handoff_latest.md`

Handoff must include:
- what changed
- current state
- next step
- what NOT to touch

---

## 8. Scope of Actions docs

These files are **ChatGPT operating memory only**.

They contain:
- current state
- execution direction
- doc conflicts
- next steps

They do NOT replace module specs.

---

## 9. Conflict handling

If docs disagree:

1. Prefer latest slice reports
2. Verify against code
3. Record conflict in `current.md`

Do not guess.

---

## 10. Tool roles

Actions GPT = planner + truth manager
Claude Code = executor
Claude Chat = SQL / DB

---

## 11. Database rule

- Schema changes = migrations only
- No casual DDL
- Reads are fine

---

## 12. File write safety

Before modifying any existing repo file, ChatGPT must read the full current file from `dev`.

Do not write from memory.
Do not overwrite a full file with a patch fragment.
Do not replace a file unless full replacement is explicitly intended.

Default edit mode is surgical: preserve unrelated content exactly.

If the file is too large or risky to safely rewrite, stop and report instead of writing.

---

## 13. Next required file

Create next:

`docs/actions/current.md`

---

## 14. Fresh chat opener

Use this:

"Fresh sync on dev. Read docs/actions/START_HERE.md, then docs/actions/current.md, then follow the read list. Summarize state and next 1–3 slices."

---

## 15. Directive

Keep the repo clean, current, and resumable.
