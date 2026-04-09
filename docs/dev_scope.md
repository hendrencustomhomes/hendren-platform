# Hendren Platform — Dev Scope

Last updated: 2026-04-09

## Purpose

This file is the compact architectural and operational baseline for implementation work on the Hendren Platform.

It exists to:
- reduce handoff token usage
- preserve critical system context between sessions
- prevent scope drift
- prevent stale assumptions from overriding current decisions

Use this file for durable project truth.

---

## Core Operating Model

- `dev` is the canonical development branch
- `main` must remain deployable at all times
- all active work flows through `dev`
- architecture first, code second
- Claude implements only within approved scope
- ChatGPT handles architecture, sequencing, and guardrails

---

## Required Branch Discipline

Before any implementation work:
- pull latest `dev`
- align local state to `dev`
- do not create or continue work from stale local state

After implementation:
- push completed work to `dev`
- do not leave source-of-truth changes local only
- do not push partial or broken work to `main`

---

## Documentation Model

Two-doc runtime model:

1. `docs/instructions.md`
   - task execution contract for Claude
   - how to behave on every prompt
   - what to report before and after coding

2. `docs/dev_scope.md`
   - durable project truth
   - architecture constraints
   - current system reality worth preserving across sessions

If either doc is outdated, update it deliberately on `dev`.

---

## Architecture Rules

- no coding before architecture agreement for the task at hand
- no schema changes without explicit approval
- no invention of new architecture or data model patterns
- no scope expansion beyond the defined task
- no silent deviation from locked decisions

If implementation reveals an architecture conflict, stop and flag it.

---

## Current System Reality

### Platform
- Next.js App Router + TypeScript
- Supabase for Postgres, Auth, Storage, and RLS
- Vercel for deployment
- GitHub repo: `hendrencustomhomes/hendren-platform`

### Deployment / Data Reality
- active development branch: `dev`
- production branch: `main`
- single production Supabase project
- no dev/prod DB separation
- schema changes hit production DB

### Current Working Areas
- internal login
- dashboard / all jobs
- job detail core shell
- schedule page

### Not Yet Built / Not Stable Enough to Treat as Finished
- full files UX
- job info sheet
- invited company flow
- admin / compliance module
- external auth / portals

---

## Key Product / Data Decisions

### External entity model
- `companies` is the core external entity
- do not model subcontractors and vendors as separate primary entities
- roles are contextual, not separate core identities

### Access model
- external access is company-based, not user-based
- users inherit access through company membership

### Job participation language
Use:
- Invite Company
- Invited Companies
- Company invited to job

### Locked terminology
- Takeoff = raw material counts
- Estimate = internal cost summary
- Proposal = client-facing estimate
- Change Order = post-contract estimate/proposal-like record
- Process = job lifecycle steps
- Punchlist = company/trade-specific completion list
- Quality Checklist = PM/QC checklist

---

## Files Architecture (Condensed)

### Categories
- plans
- photos
- admin
- other

### Storage
- bucket: `job-files`
- path: `jobs/{job_id}/{category}/{file_id}-{filename}`
- private bucket
- signed URLs generated server-side
- target expiry: 60 minutes

### File access model
- internal visibility is always implied
- external access is controlled by:
  - `client_visible`
  - `companies_visible`
  - `company_scope` = `all` or `selected`
- selected company access uses `file_attachment_access`
- `file_attachments` and `documents` are separate concepts

### Default visibility
- plans → client + all invited companies
- photos → all invited companies
- admin → internal only
- other → internal only

---

## Job Info Sheet v1

Required fields:
- Job Name
- Job Address
- Access Codes
  - Gate
  - Lockbox + Location
  - Garage
- PM name + phone
- Scope Summary
- Neighborhood Requirements

Exists as structured in-app data first. Export comes later.

---

## Implementation Constraints

- Supabase SDK v2: no generics at call sites
- use canonical helpers already in codebase
- every new table in this project has RLS enabled by default
- tables with RLS and no policy will silently fail
- inspect actual schema before migrations or assumptions
- use migrations for schema changes

---

## Known Risk Areas

- recursive RLS risk around `is_internal()` / `internal_access`
- silent RLS failures due to missing policies
- production DB exposure because there is no separate dev database
- stale assumptions from older sessions or docs

---

## Build Priority Direction

Current default order:
1. stabilize workflow and architecture discipline
2. fix broken flows blocking real testing
3. files foundation and files UX
4. job info sheet
5. invited company flow
6. admin / compliance
7. external portals
8. responsive nav completion
9. later cleanup / polish

---

## Change Control

Update `docs/dev_scope.md` when any of the following changes:
- durable architecture decisions
- branch / workflow rules
- system-wide constraints
- core data model direction
- implementation reality that future sessions must know

Do not bloat this file with narrow task notes.
Those belong in prompts or task-specific docs.

---

## Bottom Line

This file should stay compact, current, and durable.

It is not a backlog.
It is not a session transcript.
It is not a scratchpad.

It holds only the context that future implementation sessions cannot safely operate without.

