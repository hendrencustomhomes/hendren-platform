# Actions GPT Template — Claude Code Prompt

Use this template when asking Claude Code to execute a bounded implementation slice.

---

## Prompt

```text
You are working in the Hendren Platform repo.

Branch target: dev

Start by reading:
1. docs/actions/START_HERE.md
2. docs/actions/current.md
3. [ADD ONLY THE ACTIVE MODULE DOCS FOR THIS SLICE]

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

Files/modules not to touch:
- [FILE OR MODULE]
- [FILE OR MODULE]

Rules:
- Work only on dev.
- Keep this to one bounded slice.
- Do not refactor unrelated code.
- Do not introduce new architecture unless the docs explicitly require it.
- Do not change schema unless this prompt explicitly includes a migration task.
- If docs conflict with code, stop and report the conflict before patching around it.
- If the task cannot be completed safely, stop with a short report instead of improvising.

Validation:
- Run TypeScript check if available.
- Run build/check command if available and relevant.
- If local env vars block prerender/build, identify the env failure as unrelated only if the compile/type stages pass.

Required final report:
1. Files changed
2. What changed
3. Validation results
4. Risks / follow-up
5. Anything intentionally not changed

Commit:
- Commit only the completed bounded slice.
- Commit message: [COMMIT MESSAGE]
```

---

## Notes for Actions GPT

Before generating a Claude Code prompt:

1. Fresh-sync against `docs/actions/current.md`.
2. Verify the active docs and files still exist on `dev`.
3. Name the smallest useful slice.
4. Include exact files whenever possible.
5. Include explicit stop conditions.

Do not send Claude Code a broad platform prompt.
Do not ask Claude Code to plan multiple phases at once.
Do not ask Claude Code to infer source of truth from old chats.
