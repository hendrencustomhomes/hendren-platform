# Supabase Staging Deploy R01

## Current repo truth verified in this pass

Verified from the repo:
- `package.json` already includes `@supabase/supabase-js`
- there was no existing `supabase/` directory in the repo before this pass
- there was no existing staging database deployment workflow in the repo before this pass

That means the repo had app-level Supabase usage, but not repo-level Supabase CLI migration deployment wiring yet.

---

## Files added in this pass

- `supabase/config.toml`
- `supabase/migrations/.gitkeep`
- `.github/workflows/supabase-staging-db-push.yml`

---

## What this setup does

This pass wires a minimal staging-only migration deployment path:
- any push to `dev` that changes `supabase/migrations/**`
- or changes `supabase/config.toml`
- triggers a GitHub Actions job
- the job links to the staging Supabase project
- the job runs `supabase db push --dry-run`
- the job then runs `supabase db push`

Production is not wired in this pass.

---

## Important weak assumption

This setup assumes the repo will become the migration source of truth.

If staging already contains schema changes that were applied manually and are not represented in `supabase/migrations`, then auto-apply can fail or drift until the staging schema is baselined into repo migrations.

That is the main risk in this setup.

So the workflow is wired now, but one manual baseline step may still be required before this is truly safe for the current existing schema.

---

## Required GitHub setup

Create a GitHub **environment** named:
- `staging`

Add these secrets to that environment:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_STAGING_PROJECT_ID`
- `SUPABASE_STAGING_DB_PASSWORD`

### Secret meanings

#### `SUPABASE_ACCESS_TOKEN`
Your Supabase personal access token for CLI authentication.

#### `SUPABASE_STAGING_PROJECT_ID`
The Supabase project ref for the staging project.
Example shape: `abcdefghijklmnopqrstu`

#### `SUPABASE_STAGING_DB_PASSWORD`
The database password for the staging Supabase project.

---

## Required manual step before trusting auto-apply

If the current staging schema was built through dashboard SQL / manual copy-paste, do this once from a machine with Supabase CLI installed:

```bash
supabase login
supabase link --project-ref <STAGING_PROJECT_ID>
supabase db pull
```

This creates a migration file in `supabase/migrations/` that captures the current remote schema.

Then:
1. review that generated migration carefully
2. commit it to `dev`
3. push to GitHub

After that, future schema changes should be added as migration files in `supabase/migrations/` instead of manual dashboard-only SQL.

---

## Normal future workflow

### Create a new migration
```bash
supabase migration new <short_name>
```

This creates:
```text
supabase/migrations/<timestamp>_<short_name>.sql
```

Add the SQL, commit it to `dev`, and push.

### What happens on push to `dev`
The GitHub Action will:
1. install Supabase CLI
2. link to staging using the GitHub environment secrets
3. show pending migrations with `supabase db push --dry-run`
4. apply them with `supabase db push`

---

## Workflow file behavior

Workflow file:
- `.github/workflows/supabase-staging-db-push.yml`

Triggers:
- push to `dev`
- manual `workflow_dispatch`

Path filters keep it narrow:
- `supabase/migrations/**`
- `supabase/config.toml`
- `.github/workflows/supabase-staging-db-push.yml`

So unrelated code pushes do not trigger database deployment.

---

## What is deferred

Deferred for later:
- production database auto-deploy
- production approval / gated release workflow
- PR-time migration test workflow using local Supabase containers
- type generation automation
- branch-to-environment expansion beyond current `dev -> staging`

---

## Recommended next step

Immediate next step:
- add the three staging GitHub environment secrets
- create and commit the first baseline migration from staging if the repo does not already represent the current schema
- then test with a tiny safe migration on `dev`
