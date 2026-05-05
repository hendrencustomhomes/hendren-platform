# Actions GPT Template — Claude Code Prompt

Use this template when asking Claude Code to execute a bounded implementation slice.

Actions GPT must resolve operating context before writing the prompt. Claude Code should receive only the context needed to execute the slice.

---

## Prompt

```text
You are working in the Hendren Platform repo.

Branch target: dev

---

REQUIRED FIRST STEP (DO NOT SKIP)

Synchronize with latest dev:
- git fetch origin
- git checkout dev
- git pull origin dev

Ensure working tree reflects latest remote state before continuing.

---

Read:
1. [ADD ONLY DOCS NEEDED TO EXECUTE THIS SLICE]
2. [ADD ONLY TARGET MODULE FILES/DOCS IF KNOWN]

---

DESIGN CONSTRAINT (NON-NEGOTIABLE)

Conform to module design rules defined in:
- docs/design/module_structure
- docs/design/module_design_strategy_r02.md

---

Task:
[ONE-SENTENCE OBJECTIVE]

Scope:
- [IN SCOPE ITEM 1]
- [IN SCOPE ITEM 2]
- [IN SCOPE ITEM 3]

Out of scope:
- [OUT OF SCOPE ITEM 1]
- [OUT OF SCOPE ITEM 2]
- [OUT OF SCOPE ITEM 3]

Expected files to inspect:
- [FILE]
- [FILE]

Expected files to modify:
- [FILE]
- [FILE]
- [MODULE-CORRECT SLICE REPORT PATH UNDER docs/modules/]

Files/modules not to touch:
- [FILE OR MODULE]
- [FILE OR MODULE]

---

STRUCTURE RULES (HARD CONSTRAINTS)

- No duplicate logic
- No new parallel systems (especially status or permissions)
- No logic inside shared UI components
- No "quick inline fixes"
- One clear owner for new logic
- Server-side enforcement first, UI second

---

STOP CONDITIONS

- If proper implementation conflicts with module structure → STOP and report
- If multiple ownership paths are required → STOP and report
- If a new architectural pattern seems required → STOP and report

---

Slice report:
- Write a concise completion report to: [MODULE-CORRECT SLICE REPORT PATH UNDER docs/modules/]
- The report must include:
  1. Slice name
  2. Status: completed / stopped
  3. Files changed
  4. What changed
  5. Validation results
  6. Risks / follow-up
  7. Anything intentionally not changed

---

Rules:
- Work only on dev.
- Keep this to one bounded slice.
- Do not refactor unrelated code.
- Do not introduce new architecture unless the docs explicitly require it.
- If docs conflict with code, stop and report the conflict before patching around it.
- If the task cannot be completed safely, stop with a short report instead of improvising.

Validation:
- Run TypeScript check if available.
- Run build/check command if available and relevant.
- If local env vars block prerender/build, identify the env failure as unrelated only if the compile/type stages pass.

Required final response:
1. Files changed
2. What changed
3. Validation results
4. Risks / follow-up
5. Slice report path
6. Anything intentionally not changed

Commit:
- Commit only the completed bounded slice, including the slice report.
- Commit message: [COMMIT MESSAGE]
```

---

## Notes for Actions GPT

Before generating a Claude Code prompt:

1. Fresh-sync against `docs/actions/START_HERE.md` and `docs/actions/current.md`.
2. Verify the active docs and files still exist on `dev`.
3. Name the smallest useful slice.
4. Include exact files whenever possible.
5. Include explicit stop conditions.
6. Do not include general Actions docs in Claude prompts unless directly needed for implementation.
7. Use a deterministic module-correct slice report path under `docs/modules/`.
8. Never use legacy report directories such as `docs/actions/slices/`, `docs/slices/`, `docs/audits/`, or `docs/archive/`.

Do not send Claude Code a broad platform prompt.
Do not ask Claude Code to plan multiple phases at once.
Do not ask Claude Code to infer source of truth from old chats.