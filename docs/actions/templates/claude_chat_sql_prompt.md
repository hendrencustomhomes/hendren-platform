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
[ALL REQUIRED CONTEXT MUST BE PROVIDED HERE — do not rely on external docs unless explicitly listed above]

Database scope:
- [TABLE / FUNCTION / POLICY / VIEW]
- [TABLE / FUNCTION / POLICY / VIEW]

Out of scope:
- [EXPLICITLY EXCLUDED TABLE / MODULE]
- [EXPLICITLY EXCLUDED TABLE / MODULE]

Rules:
- Use read-only SQL for inspection.
- Use migrations for all schema writes.
- Do not run raw DDL outside the approved migration path.
- Do not combine unrelated schema changes.
- Do not make destructive changes unless explicitly authorized in this prompt.
- Do not drop tables, columns, enum values, policies, or data without explicit approval.
- If the live DB differs from provided context, stop and report the mismatch before changing schema.
- If RLS is involved, inspect existing policies before proposing changes.
- Prefer additive changes unless the prompt explicitly authorizes cleanup/removal.

Required inspection before migration:
- Confirm existing table/function/policy names.
- Confirm existing columns and types.
- Confirm row counts if destructive or migration-sensitive.
- Confirm dependent views/functions/policies before changing objects.

Migration requirements:
- Migration name: [MIGRATION_NAME]
- Include the SQL migration body.
- Include rollback notes or explain why rollback is not safe/simple.
- Include post-migration verification SQL.

Validation:
- Run read-only verification queries after migration.
- Report exact results.
- Identify any warnings or follow-up items.

Required final report:
1. Inspection findings
2. Migration applied or proposed
3. Verification results
4. Data safety notes
5. Follow-up risks
6. Files/docs that should be updated in repo, if any
```

---

## Notes for Actions GPT

- ALL required context should be embedded directly in the prompt whenever possible.
- Only reference docs when absolutely necessary for that specific slice.

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

1. SQL / migration prompt
2. Claude Code implementation prompt

Do not ask one assistant to perform an unbounded DB + app rewrite in one pass.
