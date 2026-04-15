# Scope Intake V1 — R2

Date: 2026-04-15
Branch: `dev`
Status: partial execution

## Goal

Upgrade the existing Hendren scope layer from a generic freeform scope editor into a structured Scope Intake V1 — R2 flow, while preserving custom scope rows and staying upstream of takeoff.

## Repo baseline confirmed

Existing repo reality before this pass:
- `src/app/jobs/new/page.tsx` already acts as a basic intake shell and creates the job directly.
- `src/app/jobs/[id]/JobTabs.tsx` already exposes a `scope` tab.
- `src/app/jobs/[id]/ScopeTab.tsx` already exists but is still a generic freeform editor.
- `job_scope_items` is already in use and is the narrowest correct data model to extend for this pass.

## Work completed

### Added shared starter definition module

Created:
- `src/lib/scope.ts`

Purpose:
- defines the standard Scope Intake starter rows
- groups rows by section (`project`, `layout`, `features`)
- provides helpers to identify starter rows vs custom rows
- provides a helper to seed default scope starter rows for a job

Starter rows added in this file:
- `job_type`
- `project_category`
- `construction_type`
- `bedroom_count`
- `bathroom_count`
- `stories`
- `garage_stalls`
- `basement_type`
- `outdoor_living`
- `special_features`
- `scope_summary`

Commit created by ChatGPT GitHub write path:
- `df9d653c8ed27fa6d64ebcc60d104e060af8decd`

## Blocker hit during direct repo execution

The GitHub connector in this session can create new files cleanly, but the exposed write path is not supporting safe overwrite of existing files.

Observed behavior:
- creating a new file works
- attempting to overwrite an existing file returns a 422 asking for `sha`
- supplying `sha` is not accepted by the connector wrapper because the wrapper does not expose that argument

Meaning:
- this is not mainly a missing repo permission problem
- this is a connector capability mismatch for existing-file updates in this session
- reconnecting GitHub is unlikely to fix the specific overwrite limitation

## Files still needing code changes to complete Scope Intake V1 — R2

### 1. `src/app/jobs/[id]/ScopeTab.tsx`
Needs to change from:
- generic freeform scope row editor

To:
- structured starter-driven scope intake UI using `src/lib/scope.ts`
- grouped sections
- first-time starter initialization
- starter row editing
- preserved custom scope rows

### 2. `src/app/jobs/new/page.tsx`
Needs a small redirect change after job creation:
- from `/jobs/[id]`
- to `/jobs/[id]?tab=scope`

This makes the intake shell flow naturally into Scope Intake completion.

## Recommended next execution path

Because the missing changes are on existing files, the fastest clean completion path is:

1. use Claude Code or a real repo terminal workflow for the remaining existing-file edits
2. keep the new shared file `src/lib/scope.ts`
3. update `ScopeTab.tsx`
4. update the post-create redirect in `jobs/new/page.tsx`
5. push only to `dev`
6. verify build + scope tab behavior

## Scope boundary preserved

This pass still correctly avoids:
- takeoff automation
- downstream generation
- selections linkage
- import/template systems
- broad jobs-core rewrite

## Outcome

This session successfully established the shared R2 scope definition layer in the repo.

The module is not fully complete yet because the existing-file UI updates could not be applied through the current GitHub connector surface.
