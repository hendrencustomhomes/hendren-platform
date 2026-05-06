# Actions GPT Template — Claude Chat / SQL Prompt

Use this template when asking Claude Chat or another SQL-focused assistant to inspect or change Supabase schema/data.

---

## Prompt

```text
You are working on the Hendren Platform Supabase database.

Branch/context target: dev

[OPTIONAL — ONLY IF REQUIRED FOR THIS TASK]
Reference docs:
- [SPECIFIC SLICE OR MODULE DOC ONLY]

Task:
[ONE-SENTENCE DATABASE OBJECTIVE]

Context:
[ONLY CONTEXT REQUIRED FOR DATABASE SAFETY — avoid architectural history or repo implementation rationale unless it changes what SQL is safe to run]

Database scope:
- [TABLE / FUNCTION / POLICY / VIEW]
- [TABLE / FUNCTION / POLICY / VIEW]

Out of scope:
- [EXPLICITLY EXCLUDED TABLE / MODULE]
- [EXPLICITLY EXCLUDED TABLE / MODULE]

Rules:
- Use read-only SQL for inspection.
- Apply all schema / RPC / enum changes directly in Supabase.
- Do NOT create or rely on repo migration files unless explicitly requested.
- Do not combine unrelated schema changes.
- Do not make destructive changes unless explicitly authorized in this prompt.
- Do not drop tables, columns, enum values, policies, or data without explicit approval.
- If the live DB differs from provided context, stop and report the mismatch before changing schema.
- If RLS is involved, inspect existing policies before proposing changes.
- Prefer additive changes unless the prompt explicitly authorizes cleanup/removal.

Required inspection before changes:
- Confirm existing table/function/policy names.
- Confirm existing columns and types.
- Confirm row counts if destructive or migration-sensitive.
- Confirm dependent views/functions/policies before changing objects.
- For destructive changes, explicitly inspect dependent views, functions/RPCs, triggers, indexes, constraints, and RLS policies before DDL.

Documentation requirements:
- Provide the SQL used/applied.
- Provide rollback notes or explain why rollback is not safe/simple.
- Provide post-change verification SQL.

Validation:
- Run read-only verification queries after changes.
- Report exact results.
- Identify any warnings or follow-up items.

Required final report:
1. Inspection findings
2. SQL applied or proposed
3. Verification results
4. Data safety notes
5. Follow-up risks
6. Files/docs that should be updated in repo, if any
```

---

## Notes for Actions GPT

- ALL required context should be embedded directly in the prompt whenever possible.
- Only reference docs when absolutely necessary for that specific slice.
- Do not ask the SQL executor to read repo files or docs unless their content is included in the prompt or known to be available in that execution environment.
- If repo evidence matters, summarize the verified repo finding inline instead of sending the SQL executor to the repo.
- Keep SQL prompts short and high-signal:
  - objective
  - minimal context
  - database scope
  - inspection checklist
  - authorized SQL action
  - stop conditions
  - final report
- Do not pad SQL prompts with constraints that are physically impossible for the SQL executor to violate. Keep such reminders here as internal Actions GPT notes, not executor-facing boilerplate.

Use this template when the task involves:

- tables
- columns
- enums
- indexes
- RLS policies
- RPC functions
- triggers
- data backfills
- storage buckets

Do not use this template for ordinary TypeScript-only work.

If a database task also requires repo code changes, split it into two prompts:

1. SQL / DB prompt
2. Claude Code implementation prompt

Do not ask one assistant to perform an unbounded DB + app rewrite in one pass.
