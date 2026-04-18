# Migration Drift Investigation — 2026-04-18

## Overview

Four migration versions exist in the remote Supabase project's `schema_migrations` history but have no corresponding files in the repo. This report documents findings from an investigation run on 2026-04-18 **without** making any schema changes, running `migration repair`, or applying migrations.

---

## Drift Versions Under Investigation

| Version | UTC Timestamp | CDT Equivalent |
|---|---|---|
| 20260418021526 | 02:15:26 | 9:15 PM Apr 17 |
| 20260418031132 | 03:11:32 | 10:11 PM Apr 17 |
| 20260418031431 | 03:14:31 | 10:14 PM Apr 17 |
| 20260418040045 | 04:00:45 | 11:00 PM Apr 17 |

---

## 1. Linked Project

**Project ref: `oiyujpkqfbqmjyxefwbj`**

Source: `decisions.md` (referenced twice as the platform Supabase project).

The Supabase CLI was **not linked** in the Codespace used for this investigation — `supabase/.temp/` contained only an empty `cli-latest` marker, Docker was not running, and no `SUPABASE_ACCESS_TOKEN` was present in the environment. `supabase migration list` could not be executed directly.

**Match with GitHub Actions staging target?**

The workflow `.github/workflows/supabase-staging-db-push.yml` uses `secrets.SUPABASE_STAGING_PROJECT_ID`. That secret's value is not readable from code. However, `decisions.md` references only one Supabase project across all documented sessions. **High confidence: same project.**

---

## 2. Remote Migration List

`supabase migration list` could not be executed — no access token or DB password was available in this Codespace session. The four drift versions are **unverifiable via CLI** from this environment.

To confirm remotely, run with credentials:

```bash
export SUPABASE_ACCESS_TOKEN=<token>
npx supabase link --project-ref oiyujpkqfbqmjyxefwbj --password <db-password>
npx supabase migration list
```

---

## 3. Migration Files in Repo

```
supabase/migrations/
  20260415000000_initial_schema.sql
  20260415041045_baseline_validation_test.sql
  20260416174500_takeoff_structure_foundation.sql
  20260418183000_jobs_trash_columns.sql
```

**None of the 4 drift versions exist in the repo.** Confirmed via:

```bash
ls supabase/migrations/ | grep -E "20260418021526|20260418031132|20260418031431|20260418040045"
# (no output)

git log --all --oneline -- "supabase/migrations/20260418021526*" ...
# (no output — never committed)
```

---

## 4. What the Drift Versions Changed

### Timing correlation

The four drift timestamps (02:15–04:00 UTC on April 18) correspond to 9:15 PM–11:00 PM CDT on April 17. Git history shows heavy auth + internal users development during that exact window — dozens of commits from `~edb568` ("add reset password action") through `~4dd7830` ("internal users: add update and deactivate actions"). The drift migrations were applied directly to the remote database via the Supabase dashboard SQL editor during that session and were never committed to the repo.

### Schema evidence — real changes, not orphan history

**Finding 1 — `profiles` table: missing `address` and `birthday` columns**

The initial schema (`20260415000000`) defines `profiles` without `address` or `birthday`:

```sql
CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" uuid,
    "full_name" text,
    "email" text,
    "role" user_role,
    "is_active" boolean,
    "company" text,
    "phone" text,
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "is_admin" boolean,
    "is_project_manager" boolean
    -- NO address
    -- NO birthday
);
```

`src/app/more/internal-users/actions.ts` (current HEAD) reads both:

```ts
admin.from('profiles').select('id, full_name, phone, address, birthday')
```

The internal users feature is deployed and functional on staging. These columns must exist on the remote — added by one of the drift versions.

**Finding 2 — `internal_access.role` CHECK constraint too narrow**

Initial schema constraint:

```sql
CONSTRAINT "internal_access_role_check" CHECK (
  role = ANY (ARRAY['project_manager', 'general'])
)
```

`src/lib/permissions.ts` defines five app roles: `admin`, `estimator`, `project_manager`, `bookkeeper`, `viewer`. `serializeRoles()` writes values like `'viewer'`, `'estimator'`, `'bookkeeper'`, and combinations. `createInternalUser()` upserts `role: 'viewer'`, which would violate the original constraint.

Since the internal users feature works on staging, the CHECK constraint was **dropped or altered** to allow the full role set. This happened in one of the drift versions.

**Finding 3 — `jobs.deleted_at` / `jobs.deleted_by`**

These are accounted for by the committed migration `20260418183000_jobs_trash_columns.sql`. Not a drift issue.

### Per-version estimate

| Version | Most likely content | Assessment |
|---|---|---|
| 20260418021526 | Added `address text` and `birthday text` to `profiles` | Real schema change |
| 20260418031132 | Dropped or altered `internal_access_role_check` constraint | Real schema change |
| 20260418031431 | Follow-up fix — constraint recreated or additional column | Real schema change (probable) |
| 20260418040045 | Additional role/permissions work or function | Real schema change (probable) |

Exact per-version SQL cannot be confirmed without running `supabase migration list` and querying `information_schema` on the live project.

---

## 5. Recommended Next Steps

**Do not** run `migration repair --status reverted` — the schema changes are real and the app depends on them. Marking them reverted would cause GitHub Actions to attempt re-applying schema that already exists.

**Do not** run `migration repair --status applied` without first verifying exact SQL content — it would permanently record history without knowing what it captures.

### Recommended repair sequence (requires credentials)

1. Obtain `SUPABASE_ACCESS_TOKEN` and `SUPABASE_STAGING_DB_PASSWORD`

2. Link project and confirm drift versions:
   ```bash
   npx supabase link --project-ref oiyujpkqfbqmjyxefwbj --password <db-password>
   npx supabase migration list
   ```

3. Query actual remote schema to determine exact changes:
   ```sql
   -- Confirm address/birthday on profiles
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'profiles'
   ORDER BY ordinal_position;

   -- Confirm internal_access constraint state
   SELECT conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid = 'public.internal_access'::regclass;
   ```

4. Write SQL migration files using the exact drift timestamps:
   ```
   supabase/migrations/20260418021526_profiles_address_birthday.sql
   supabase/migrations/20260418031132_internal_access_role_constraint.sql
   supabase/migrations/20260418031431_<name-after-inspection>.sql
   supabase/migrations/20260418040045_<name-after-inspection>.sql
   ```

5. Commit and push to `dev`. GitHub Actions (`supabase db push`) will see the timestamps already in remote history and skip re-applying them — no schema change will occur.

---

## Constraints Observed

- No schema changes made
- No `migration repair` executed
- No `db push` executed
- No guessing where verification was possible
