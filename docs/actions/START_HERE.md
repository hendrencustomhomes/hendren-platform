# Actions GPT — Start Here

Status: active entry point  
Branch target: `dev`  
Purpose: mandatory starting point for every fresh Actions GPT session.

---

## 1. Non-negotiable

Start here. Not from memory. Not from prior chats. Not from `main`.

All rules in this file remain active for the entire session. Re-check before writing or modifying files.

---

## 2. Startup sequence (always follow)

1. Read this file
2. Read `docs/actions/current.md`
3. Read ONLY the docs listed inside `current.md`
4. Confirm branch = `dev`
5. Summarize current state + next 1–3 slices BEFORE doing work

If `current.md` does not exist → create it before implementation work.

---

## 3. Keyword triggers

- "sync" → perform full sync before any work
- "handoff" → execute handoff procedure and update repo docs
- "slice" → define a bounded unit (1–3 max per session)

If a session begins without an explicit sync, perform one anyway.

---

## 4. Source of truth order

1. `docs/actions/START_HERE.md`
2. `docs/actions/current.md`
3. `docs/actions/handoff_latest.md`
4. Active docs listed in `current.md`

If a document is not referenced in `current.md`, treat it as non-authoritative.

---

## 5. Branch rule

`dev` is the only development truth.

- Do NOT treat `main` as current
- No long-lived side branches
- Short branches only for contained risk, then merge back to `dev`

---

## 6. Session constraint

Each chat = **1–3 slices max**

A slice must be:
- bounded
- testable
- non-drifting

If additional work is discovered mid-slice:
- do not include it
- list it as a future slice

Stop before context gets fuzzy.

---

## 7. Sync rule

Every new session begins with a sync:

- Read `current.md`
- Verify against repo
- Identify stale docs
- Propose next 1–3 slices

No blind execution.

---

## 8. Handoff rule

End of session must:

- Update `docs/actions/current.md` (if truth changed)
- Overwrite `docs/actions/handoff_latest.md`
- Explicitly state whether `current.md` was updated or intentionally not updated

Handoff must include:
- what changed
- current state
- next step
- what NOT to touch

### REQUIRED OUTPUT FOR USER (COPY BLOCK)

When the user says "handoff", you MUST include a copyable block for the next session opener. Provide it exactly as written below, with no changes, additions, or commentary:

Fresh sync on dev. Read docs/actions/START_HERE.md, then docs/actions/current.md, then follow the read list. Summarize state and next 1–3 slices.

Do not paraphrase. Do not wrap in quotes. Provide it as a clean, copyable block.

---

## 9. Slice report location

Slice reports must be written to the correct module directory under `docs/modules/`.

Do NOT write slice reports to:
- `docs/actions/slices/`
- `docs/slices/`
- `docs/audits/`
- `docs/archive/`
- any other legacy slice/audit/archive directory

Required module destinations:

| Work type | Report directory |
|-----------|------------------|
| Estimate, proposal, worksheet-in-estimate, send pipeline | `docs/modules/estimate/` |
| Pricing, catalog, pricing sources | `docs/modules/pricing/` |
| Cross-cutting platform, permissions, shared foundation, worksheet engine audits, repo-wide bugfixes | `docs/modules/platform/` |

Estimate and proposal are the same module. A proposal is an output artifact of the estimate pipeline, so proposal-side slice reports belong in `docs/modules/estimate/`.

File naming remains:

`slice_##_<short_name>.md`

Examples:
- `docs/modules/estimate/slice_34_void_sign_alignment.md`
- `docs/modules/pricing/slice_12_catalog_identity_cleanup.md`
- `docs/modules/platform/slice_12_permission_guard_fix.md`

If unsure which module applies:
- default to `docs/modules/estimate/` unless the work is clearly pricing/catalog or platform-level infrastructure
- record the reasoning in the slice report

This rule overrides any older instruction or template reference that points to `docs/actions/slices/` or another legacy report directory.

---

## 10. Scope of Actions docs

These files are **ChatGPT operating memory only**.

They contain:
- current state
- execution direction
- doc conflicts
- next steps

They do NOT replace module specs.

---

## 11. Conflict handling

If docs disagree:

1. Prefer latest slice reports
2. Verify against code
3. Record conflict in `current.md`

If a conflict affects implementation direction:
- stop
- present the conflict
- propose options
- do not proceed with assumptions

---

## 12. Tool roles

Actions GPT = planner + truth manager
Claude Code = repo/code executor
Claude Chat = SQL / DB executor

---

## 13. Database rule

- SQL / schema / RPC / RLS / enum changes are made directly in Supabase through Claude Chat or another SQL-focused tool.
- Do NOT create, modify, or commit files under `supabase/migrations/` unless the user explicitly asks for repo migration files.
- Claude Code prompts must not include SQL migration-file creation by default.
- If DB state changes outside the repo, update `docs/actions/current.md` and any relevant reports/docs to record the live DB truth.
- Reads are fine.

---

## 14. File write safety

Before modifying any existing repo file, ChatGPT must read the full current file from `dev`.

Do not write from memory.
Do not overwrite a full file with a patch fragment.
Do not replace a file unless full replacement is explicitly intended.

Default edit mode is surgical: preserve unrelated content exactly.

If the file is too large or risky to safely rewrite, stop and report instead of writing.

---

## 15. Design standard (non-negotiable)

All file writes and edits must conform to:

- `docs/design/module_structure`
- `docs/design/module_design_strategy_r02.md` (for worksheet-family work)

Do not introduce:
- god components
- duplicated logic or styling
- multiple owners of the same concern
- module logic inside shared UI
- alternative/parallel patterns for an existing concern

Prefer:
- small, single-responsibility files
- composition and layered reuse
- shared primitives and patterns over duplication

Before writing new files or extracting logic:
- check whether a shared or existing implementation already exists
- prefer reuse over creation
- justify any new structure that cannot reuse an existing pattern

Before proposing structural or architectural changes:
- read relevant repo files or docs
- do not reason from memory or assumptions

---

## 16. Claude prompt requirements

Before drafting any Claude prompt, classify the work by execution target:

1. If the task includes SQL, schema, RPC, RLS, enum, trigger, policy, data backfill, storage bucket, or direct Supabase state changes → use the Claude Chat / SQL template first.
2. If the task includes both DB work and repo/code work → split it into separate prompts: SQL / DB first, Claude Code second.
3. If the task is repo/code/docs-only with no DB state change → use the Claude Code template.
4. If unsure whether DB state changes are required → stop and ask or write the SQL inspection prompt first; do not default to Claude Code.

All Claude Code prompts MUST use:

`docs/actions/templates/claude_code_prompt.md`

All Claude Chat / SQL / DB prompts MUST use:

`docs/actions/templates/claude_chat_sql_prompt.md`

Claude Code prompts must include an explicit module-correct slice report path from Section 9. Do not use legacy report directories.

Claude Chat / SQL prompts must not ask for repo edits, commits, or migration files unless the user explicitly requests repo migrations.

No ad-hoc prompt formats.

---

## 17. Next required file

Create next:

`docs/actions/current.md`

---

## 18. Fresh chat opener

Use this:

Fresh sync on dev. Read docs/actions/START_HERE.md, then docs/actions/current.md, then follow the read list. Summarize state and next 1–3 slices.

---

## 19. Directive

Keep the repo clean, current, and resumable.
