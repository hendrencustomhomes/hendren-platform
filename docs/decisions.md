# \# Hendren Custom Homes — Platform Decisions Log

# Last updated: 2026-03-29

# 

# \## Project Overview

# Internal field operations platform for Hendren Custom Homes, a high-end custom home builder in Indiana. Currently in Tim-only testing phase. No external deployment until platform is legitimately useful for real management replacing Houzz.

# 

# Team:

# \- Mike — Owner/PM (admin role)

# \- Tim — PM (admin role, primary tester)

# \- Paul — PM

# \- John — Estimator (primary takeoff/price sheet)

# \- Kristi — Bookkeeper

# 

# Peak load: \~30 active jobs, \~5 per PM currently.

# 

# \---

# 

# \## Stack

# | Layer | Technology |

# |---|---|

# | Frontend | Next.js 16.2.1 (App Router, TypeScript) |

# | Hosting | Vercel (auto-deploy from GitHub main) |

# | Database | Supabase Postgres + RLS + Auth |

# | Storage | Supabase Storage (job-files bucket) |

# | Repo | GitHub hendrencustomhomes/hendren-platform |

# | Codespace | special-dollop-wrw4gxpv4g7725r45.github.dev |

# | Live URL | hendren-platform.vercel.app |

# | Supabase | oiyujpkqfbqmjyxefwbj |

# 

# Cost target: \~$27/mo at 30-job scale. Upgrade Vercel Hobby → Pro ($20/mo) at company launch.

# 

# \---

# 

# \## Branch / Deployment Strategy

# \- All development on `dev` branch

# \- Vercel auto-creates preview URL for every branch push

# \- Merge `dev` → `main` only when tested and ready

# \- Never push directly to main during active development

# \- Limit deployments — only deploy after meaningful tested increments

# 

# \---

# 

# \## Terminology (locked)

# \- \*\*Takeoff\*\* — raw material counts, all quantities needed for a job (John primary, PM also)

# \- \*\*Estimate\*\* — cost summary by cost code from takeoff + overhead + markup + GCs → becomes Proposal

# \- \*\*Proposal\*\* — client-facing estimate requiring signature

# \- \*\*Change Order\*\* — same structure as estimate/proposal, post-contract, requires signature + down payment + draw schedule addition

# \- \*\*Process\*\* — job lifecycle workflow steps (NOT called checklist)

# \- \*\*Punchlist\*\* — per-sub scope items to complete during scheduled time

# \- \*\*Quality Checklist\*\* — PM/field QC items based on historical issues + manual additions

# 

# \---

# 

# \## Navigation Architecture

# 

# \### Mobile (bottom tab bar — field use)

# 1\. Today — subs on site, orders due, open issues across all jobs

# 2\. Jobs — job list → job detail

# 3\. Log — fast log entry with voice capture

# 4\. Schedule — what's coming up, sub status

# 5\. More — overflow

# 

# \### Desktop (left sidebar — office/PM workflow)

# \- Dashboard / Today

# \- All Jobs (with job sub-nav)

# \- Master Schedule

# \- Admin (COI, W9, contracts, staff)

# \- Settings

# 

# \### Job Detail Tabs (both platforms)

# Process · Schedule · Procurement · Selections · Takeoff · Estimate · Budget · Files · Log · Issues

# 

# \---

# 

# \## Job Pipeline (fluid, not strict gates)

# 9 stages as status labels: intake → takeoff → estimate → contract → selections → procurement → schedule → draws → construction

# 

# Two hard gates only:

# 1\. Contract signed → unlocks procurement ordering and sub scheduling

# 2\. Selections locked per item → unlocks procurement for selection-dependent items

# 

# Everything else is advisory — flags and dashboard alerts, not blockers.

# 

# \---

# 

# \## File Structure

# Per job: contracts / plans / photos / selections / permits / lien-waivers / change-orders / other

# \- Add folder available in every category

# \- Upload via browser (local files) → Supabase Storage

# \- Admin files (COI, W9, contracts) never shareable externally

# \- Job files shareable only from: plans, selections folders

# \- Pricing and admin job files not shareable unless explicitly moved to shareable folder

# 

# \---

# 

# \## Auth Architecture

# 

# \### Internal Staff

# \- Email + password

# \- Requirements: 8+ chars, upper + lower + special character

# \- Password reset via email

# \- No self-signup — invite only

# \- Roles: admin, pm, bookkeeper, estimator

# 

# \### External Users (subs, vendors, clients)

# \- Email + 4-digit PIN (memorable, can't be forgotten)

# \- PIN reset sends new PIN to email

# \- No self-signup — invite only from internal PM

# \- First user invited to a company = company admin for their org

# \- Company admins can invite others from their org, assign contact types

# \- Contact types: Admin, Bookkeeping, Project Manager, Scheduler, Insurance, Estimator, Primary Rep, Safety Officer, Owner's Rep

# 

# \---

# 

# \## User Roles \& Permissions

# 

# \### Internal

# | Role | Access |

# |---|---|

# | admin | Full access all jobs + Admin module |

# | pm | Full access all jobs |

# | bookkeeper | Full access all jobs, focus financial tabs |

# | estimator | Full access all jobs, focus takeoff/estimate |

# 

# \### External

# | Role | Access |

# |---|---|

# | client (fixed price) | Proposal, COs pending approval, invoices only |

# | client (cost plus) | Above + live price sheet + draw schedule |

# | sub | Schedule + punchlist on assigned jobs only. Zero cost data. |

# | vendor | Same as sub for now |

# 

# Open book internally — all internal roles see all jobs.

# 

# \---

# 

# \## Admin Module (Company Operations)

# 

# \### Subcontractor \& Vendor Management

# \- Company directory (name, type: sub/vendor/both, contacts with roles)

# \- COI tracking:

# &#x20; - Types: General Liability, Workers Compensation, Both

# &#x20; - Expiration date required on upload

# &#x20; - Alert at 14 days: email to Admin + sub's insurance contact

# &#x20; - Option to upload in reminder email

# &#x20; - GL and WC can be same or separate files

# \- W9 collection — request via email or manual upload

# \- General Contract (master sub agreement) — send for e-signature, email Admin on sign

# \- Monthly email to Admin only listing any sub/vendor missing COI, W9, or General Contract

# \- Compliance dashboard — one view of every sub/vendor's document status

# 

# \### Staff Management

# \- Team roster, roles, permissions

# \- Activity log

# 

# \### Company Settings

# \- Default markup/overhead percentages

# \- Master Process checklist editor

# \- Master price sheet (John's rate card)

# \- Notification preferences

# 

# \---

# 

# \## Subcontractor / Vendor Onboarding Flow

# 1\. PM adds sub/vendor to system

# 2\. System sends email requesting: COI upload, W9 upload, General Contract signature

# 3\. Each document tracked independently (don't require simultaneous)

# 4\. COI requires: expiration date, type (GL/WC/Both)

# 5\. Monthly reminder email to Admin for any incomplete compliance

# 

# \---

# 

# \## Schedule \& Procurement Views

# \- Calendar view

# \- List view

# \- Gantt view

# \- Client-facing schedule: phase-level only (unless renovation → full schedule)

# \- Client tasks shown only if specifically assigned (e.g. selection deadlines)

# 

# \---

# 

# \## Field Log Capture

# \- Primary: browser Web Speech API (hold to record, release to save)

# \- One-tap microphone button on Log tab

# \- Auto-attach to current job

# \- Waveform shown while recording

# \- Text fallback always available

# \- Future upgrade: Whisper API for better construction terminology accuracy

# 

# \---

# 

# \## Documents \& Signatures

# \- Proposals require client signature

# \- Change Orders require client signature + down payment + draw schedule addition

# \- Signature capture: canvas draw-to-sign on client portal OR PM override (PM pulls up on device, hands to client)

# \- Signature stored as PNG in Supabase Storage, linked to document record

# \- Timestamp + IP logged

# 

# \---

# 

# \## Financial Architecture

# \- Payments issued through QuickBooks — no sub payment tracking in platform

# \- Draw schedule tied to lender — draw requests formatted for lender submission (AIA G702/G703 format, Excel template to be provided)

# \- CO approval triggers: down payment + new draw milestone added to schedule

# \- Cost tracking (actuals vs estimate) — PM + Kristi tool, separate from price sheet

# 

# \---

# 

# \## Permits \& Inspections

# \- Pulled in-house primarily, some subs pull own permits by jurisdiction

# \- Job onboarding classifies required permits and inspections by city/county

# \- Track: permit status, inspection hold points, inspection results

# 

# \---

# 

# \## Closeout / Warranty

# \- Final walkthrough required (bare minimum)

# \- Certificate of occupancy tracking

# \- Formal warranty period process (to be detailed)

# 

# \---

# 

# \## Client Chat

# \- In-platform messaging between PM and client

# \- Includes file sharing

# \- Scoped to job

# 

# \---

# 

# \## Database — Key Tables (Live in Supabase)

# profiles, jobs, job\_assignments, job\_deadlines, job\_drive\_links,

# checklist\_items, job\_checklist\_state,

# sub\_schedule, procurement\_items, estimate\_items,

# takeoff\_items, estimates, estimate\_line\_items,

# selections, punchlist\_items, file\_attachments,

# issues, risk\_overrides, job\_logs, stage\_history,

# documents, document\_line\_items, invoice\_line\_items, shared\_documents,

# master\_price\_sheet

# 

# RLS helper functions: is\_internal(), is\_assigned\_to\_job(), is\_client\_on\_job(),

# is\_sub\_on\_job(), is\_cost\_plus\_client(), is\_internal\_email()

# 

# \---

# 

# \## What Is Built and Working

# \- Login (email + password for internal)

# \- Dashboard with real jobs from Supabase

# \- New job creation

# \- Job detail page (pipeline, Process tab, Issues, Log, Schedule, Procurement, Selections, Takeoff, Estimate, Files tabs — interactive)

# \- Master schedule (/schedule) with sub + order tables, alert flags

# \- Add sub entry form (/schedule/sub/new)

# \- Add material order form (/schedule/order/new) with live order-by date preview

# \- Dark mode via CSS variables matching device settings

# \- Hamburger nav with sidebar: Dashboard, Schedule, All Jobs, New Job

# \- All Jobs page with progress bars and status counts

# 

# \## What Is NOT Built Yet

# \- Dev branch / staging environment

# \- Interactive checklist saving (JobTabs.tsx deployment is currently broken — fix by pasting provided file)

# \- Supabase Storage bucket `job-files` needs to be created in Supabase dashboard

# \- Edit forms for subs and orders

# \- Voice log capture

# \- Admin module (COI, W9, General Contract)

# \- Client / sub / vendor portals

# \- Document signatures

# \- Permit tracking

# \- Closeout / warranty workflow

# \- Client chat

# \- Mobile bottom tab nav

# \- Desktop sidebar nav (currently hamburger only)

# \- Draw schedule builder

# \- Budget vs actuals

# \- External user auth (PIN system)

# \- Company/org management for external users

# \- Invite flow for Tim, Paul, John, Kristi

# 

# \---

# 

# \## Immediate Next Steps (in order)

# 1\. Fix deployment error: paste JobTabs.tsx into src/app/jobs/\[id]/JobTabs.tsx, commit, push

# 2\. Set up `dev` branch for all future development

# 3\. Create `job-files` storage bucket in Supabase dashboard

# 4\. Plan and build mobile/desktop responsive nav properly

# 5\. Build Admin module (COI workflow is highest operational value)

# 6\. Auth rework for external users

# ```

# 

# \---

# 

# \## Opening Prompt for Next Chat

# ```

# Read decisions.md carefully before we start. This is the Hendren Custom Homes field operations platform — Next.js 16 + Supabase + Vercel.

# 

# RULE: Do not write any code until we have explicitly agreed on the architecture for the current task. Plan first, code second.

# 

# DEPLOYMENT RULE: All development on `dev` branch. Only merge to `main` when tested. Minimize deployments.

# 

# Current state: Core job management works on production. Latest deployment is broken (incomplete JobTabs.tsx push). First task is to fix that, then move all dev to a `dev` branch.

# 

# Infrastructure:

# \- Codespace: special-dollop-wrw4gxpv4g7725r45.github.dev

# \- Supabase: oiyujpkqfbqmjyxefwbj

# \- Vercel: hendren-platform.vercel.app

# \- GitHub: hendrencustomhomes/hendren-platform

# \- Vercel MCP: connected

# \- Supabase MCP: connected

# \- GitHub MCP: connected

# 

# After fixing the deployment error, our planned build order is:

# 1\. Dev branch setup

# 2\. Create job-files storage bucket in Supabase

# 3\. Mobile/desktop responsive nav

# 4\. Admin module (COI, W9, General Contract for subs/vendors)

# 5\. External user auth (PIN-based)

# 6\. Client and sub portals

# 

# Do not start building until I confirm which item we're working on.


# Hendren Custom Homes — Platform Decisions Log

Last updated: 2026-03-26
Conversation: Initial architecture + Supabase schema design

---

## Project Overview

Building a field operations platform for Hendren Custom Homes, a high-end custom home builder in Indiana. Migrating from a single-file localStorage app (`index.html`) to a full-stack web application.

**Team (internal users):**
- Mike — Owner/PM, admin role
- Tim — PM
- Paul — PM
- John — Estimator (PM role in system)
- Kristi — Bookkeeper (PM role in system, focuses on financial tabs)

**External users:** ~100 subs, vendors, clients with read-only access via magic link

---

## Stack

| Layer | Technology | Decision rationale |
|---|---|---|
| Frontend | Next.js | SSR + API routes in one framework, Vercel-native |
| Hosting | Vercel | Auto-deploy from GitHub main, preview deploys on branches |
| Database | Supabase Postgres | RLS, realtime, auth, storage bundled |
| Auth | Supabase Auth | Magic link for all users |
| Storage | Supabase Storage | job-files + exports buckets |
| Repo | GitHub (hendren-platform) | Codespaces for web-based editing |
| AI editing | GitHub Codespaces + Copilot | Web-based, no local install required |
| UI scaffolding | Vercel v0 | Generate Next.js components from prompts |

**Cost target:** ~$27/month at full 30-job scale

---

## User Roles

Replaced generic `external` role with distinct types. All stored in `user_role` enum.

| Role | Access level | Who |
|---|---|---|
| `admin` | Full access, all jobs | Mike |
| `pm` | Full access, all jobs | Tim, Paul, John |
| `bookkeeper` | Full access, all jobs | Kristi |
| `sub` | Schedule + punchlist on assigned jobs only. Zero cost data. | Subcontractors |
| `client` | Explicitly shared documents only (standard). Open book on cost-plus. | Homeowners |
| `vendor` | Same as sub for now. Distinct role reserved for future use. | Vendors |

**Key rule:** Internal = admin + pm + bookkeeper. All internal roles see everything on all jobs. External = sub + client + vendor.

---

## Authentication

- **Method:** Magic link (email) for ALL users — internal and external
- **Flow:** PM invites external user via `inviteUserByEmail()` with `full_name` and `role` in `raw_user_meta_data`. Supabase auto-creates profile via `handle_new_user()` trigger.
- **External user dashboard:** One magic link → dashboard showing all their assigned jobs. Never multiple links.
- **Account management:** Any internal PM can invite an external user from the job detail page. No self-serve signup.
- **Profile auto-creation:** Trigger `on_auth_user_created` fires on every new auth user, inserts into `profiles` table automatically.

---

## Database Schema

17 tables. Full SQL in `schema_current.sql`.

**Creation order (dependency chain):**
1. Extensions + types
2. `handle_updated_at()` function
3. `profiles` (referenced by jobs.pm_id)
4. `master_price_sheet` (no job dependency)
5. `jobs`
6. All job-dependent tables in order: `job_assignments`, `job_drive_links`, `job_deadlines`, `checklist_items`, `job_checklist_state`, `price_sheet_items`, `draw_schedule`, `issues`, `risk_overrides`, `job_logs`, `stage_history`, `sub_schedule`, `punchlist_items`, `file_attachments`
7. `documents`, `document_line_items`, `invoice_line_items`, `shared_documents`
8. Deferred FKs: `price_sheet_items.change_order_id` and `draw_schedule.change_order_id` added after documents exists

**Key table notes:**
- `checklist_items`: `job_id IS NULL` = master template item. `job_id IS NOT NULL` = AI-generated or manual job-specific item.
- `job_checklist_state`: decoupled from item definitions. Updating master checklist doesn't break existing job state.
- `stage_history`: append-only, never delete rows. Audit trail for client disputes and lender requirements.
- `risk_overrides`: `UNIQUE(job_id, risk_id)` — one active override per risk per job.
- `price_sheet_items.change_order_id`: FK to documents, added after documents table created.
- `draw_schedule.change_order_id`: FK to documents, added after documents table created.

---

## Job Pipeline

9 stages in order:
`intake → takeoff → estimate → contract → selections → procurement → schedule → draws → construction`

Stored as `job_stage` enum. Current stage on `jobs.current_stage`.

---

## Contract Types

```sql
CREATE TYPE contract_type AS ENUM ('fixed_price', 'cost_plus');
```

Stored on `jobs.contract_type`. Defaults to `fixed_price`.

**This is the open book gate.** Contract type determines what clients can see:
- `fixed_price`: client sees only explicitly shared documents
- `cost_plus`: client gets read access to `price_sheet_items` + `draw_schedule` for their job (open book on costs)

Checklist item added to contract stage: "Contract type confirmed in system (fixed price or cost plus)" — required.

---

## RLS Architecture

Four helper functions drive all policies:

```sql
is_internal()              -- admin/pm/bookkeeper, is_active = true
is_assigned_to_job(UUID)   -- has a job_assignments row
is_client_on_job(UUID)     -- assigned + role = 'client'
is_sub_on_job(UUID)        -- assigned + role IN ('sub','vendor')
is_cost_plus_client(UUID)  -- is_client_on_job + job.contract_type = 'cost_plus'
```

**Access matrix by table:**

| Table | Internal | Client (fixed) | Client (cost-plus) | Sub/Vendor |
|---|---|---|---|---|
| jobs | Full | Read (assigned) | Read (assigned) | Read (assigned) |
| price_sheet_items | Full | ✗ | Read | ✗ |
| draw_schedule | Full | ✗ | Read | ✗ |
| master_price_sheet | Full | ✗ | ✗ | ✗ |
| documents | Full | Shared only | Shared only | ✗ |
| document_line_items | Full | Shared only | Shared only | ✗ |
| invoice_line_items | Full | Shared only | Shared only | ✗ |
| issues | Full | ✗ | ✗ | ✗ |
| job_logs | Full | ✗ | ✗ | ✗ |
| risk_overrides | Full | ✗ | ✗ | ✗ |
| checklist_items | Full | ✗ | ✗ | ✗ |
| job_checklist_state | Full | ✗ | ✗ | ✗ |
| job_deadlines | Full | ✗ | ✗ | ✗ |
| sub_schedule | Full | ✗ | ✗ | Own rows only |
| punchlist_items | Full | ✗ | ✗ | Own rows, can mark done |
| stage_history | Full | Read (assigned) | Read (assigned) | ✗ |
| job_drive_links | Full | Read (assigned) | Read (assigned) | ✗ |
| shared_documents | Full | Own rows | Own rows | ✗ |
| file_attachments | Full | ✗ | ✗ | ✗ |

**Three things enforced at app layer, not RLS:**
1. `show_detail_to_client` column filtering on `document_line_items` — RLS controls row access, frontend controls which columns render
2. Invoice line item immutability once `status != 'draft'` — check status before writing in mutation functions
3. CO client approval only updates `status`, `approved_at`, `approved_by` — limit the UPDATE fields in the app call

---

## Document System

Three document types in one `documents` table, driven by `doc_type` enum:

```sql
CREATE TYPE document_type AS ENUM ('proposal', 'change_order', 'client_invoice');
```

**Status flows:**
- Proposal: `draft → sent → accepted → superseded`
- Change order: `draft → sent → approved → rejected → voided`
- Invoice: `draft → sent → paid`

**Proposal:**
- Line items summarized by trade from price sheet
- One active proposal per job (prior ones become `superseded` on re-issue)
- Shared with client automatically when sent via `shared_documents` row

**Change orders:**
- Client approval = button click in portal (digital, tracked in DB)
- `approved_at` + `approved_by` stored on documents row
- On approval, two things update automatically (atomic transaction, eventually Edge Function):
  1. Insert `price_sheet_items` rows from `document_line_items`
  2. Optionally insert a `draw_schedule` row if `adds_draw_milestone = true` on the CO
- Signed copy can be uploaded to `file_attachments` and linked

**Client invoices:**
- Not rigidly tied to draw milestones — PM decides when to bill
- Can reference a draw milestone (`draw_schedule_id`) or be standalone
- Use cases: deposits for upcoming work, billing for completed items
- Kristi marks paid (`paid_at`, `paid_by`)
- **Cost-plus invoicing:** line items are snapshot-copied from price sheet rows at send time. Frozen, immutable once sent. Prevents retroactive price sheet edits changing billing history.
- Standard job invoices: PM-entered amounts, not derived from price sheet

**Line item model — "detailed in, lump out":**
- PMs always enter: `trade` + `qty` + `unit` + `unit_cost` (same shape as price sheet)
- `client_label`: what client sees (defaults to description if null)
- `lump_amount`: what client sees when `show_detail_to_client = false`. App sets this = qty × unit_cost on save unless PM overrides.
- `show_detail_to_client`: false by default. PM can toggle per line item.
- On cost-plus jobs: app layer forces `show_detail_to_client = true` always (open book)
- On CO approval: each `document_line_items` row becomes a `price_sheet_items` row

**Sharing mechanism (`shared_documents` table):**
- Populated automatically when PM sends a document (status → 'sent')
- `first_read_at` set on first client portal open (read receipt)
- A document is visible to a client if: (a) `shared_documents` row exists for them, OR (b) job is `cost_plus` (handled at app layer, not additional RLS)

---

## Financial Data Access — Key Rules

1. **Subs and vendors never see cost data.** No exceptions. Not by trade, not by job.
2. **Clients on fixed-price jobs** see only: proposals, change orders (pending approval), Hendren's invoice to them. No price sheet, no draw table, no vendor costs.
3. **Clients on cost-plus jobs** see all of the above PLUS live read on `price_sheet_items` and `draw_schedule`.
4. **"Open book" means Hendren's costs and draws only.** Never vendor invoices, never internal issues or logs.
5. **Client invoices** = Hendren invoicing the client. Never vendor invoices to Hendren.

---

## Storage Buckets

Two private buckets in Supabase Storage:

**`job-files`** — all job documents
Path convention: `jobs/{job_id}/{category}/{filename}`
Categories: `contracts`, `plans`, `photos`, `selections`, `permits`, `lien-waivers`, `other`

**`exports`** — generated files (proposals, sworn statements)
Internal only.

Storage RLS: internal full access. Client read access path-matched to assigned job IDs. Subs/vendors no access.

Note: Storage RLS policies must be run AFTER buckets are created in dashboard. They are commented out in `schema_current.sql` for this reason.

---

## Realtime

Enabled on 5 tables only:
- `jobs`
- `job_checklist_state`
- `issues`
- `stage_history`
- `documents` (for CO approval — client clicks approve, PM sees it)
- `shared_documents` (PM sees when client opens a document)

NOT enabled on: `price_sheet_items`, `draw_schedule`, `master_price_sheet` — edit-heavy, poll on navigate instead.

---

## Checklist Architecture

Master items: `job_id IS NULL`, `source = 'master'`
AI-generated items: `job_id IS NOT NULL`, `source = 'ai_generated'`
Manual additions: `job_id IS NOT NULL`, `source = 'manual'`

Job checklist state decoupled from item definitions via `job_checklist_state` table. This means master checklist can be updated without breaking existing jobs.

AI interview (Claude API) generates custom checklist per job. Currently uses `claude-sonnet-4-20250514` model, called client-side with user's API key. Will need to move to server-side call (Next.js API route) when migrating from localStorage.

---

## Development Workflow

- **Code editing:** GitHub Codespaces (web-based VS Code, no local install)
- **AI assistance:** GitHub Copilot inside Codespaces for implementation, this Project for architecture
- **UI scaffolding:** Vercel v0 for component generation
- **Deploy:** Push to `main` → Vercel auto-deploys (~60-90 seconds)
- **Safe pattern:** Develop on feature branch → test on Vercel preview URL → merge to main
- **Database changes:** SQL migration files in `/supabase/migrations/`, run in Supabase SQL editor. Not yet set up — do before real data exists.

---

## Context Management (this Project)

Files to keep current in this Claude Project:
- `decisions.md` (this file) — update after any architectural decision
- `schema_current.sql` — update to reflect live schema after any DB change
- `ui_current.html` — re-upload when UI changes significantly

**Opening prompt for new conversations:**
"Read decisions.md and ui_current.html before we start."

**What Copilot won't know:** RLS model, document lifecycle, cost-plus architecture, role access matrix. Anything touching these decisions should be designed here first, then implemented in Codespaces.

**File maintenance rules:**
- Update `decisions.md` any time we make an architectural call not already in it. Not after every conversation — only when something structural changes or gets decided.
- Update `schema_current.sql` every time a schema change is successfully run in Supabase. Keep it as a copy of what is actually live, not what was drafted.
- Re-upload `index.html` when UI changes significantly. Once the build moves to Next.js, switch to uploading key component files instead of the monolithic HTML file.

---

## What Is Not Built Yet (as of 2026-03-26)

- [ ] Next.js project scaffolding (repo is still the single index.html)
- [ ] Supabase data layer (all data still in localStorage)
- [ ] Auth flow (login page, session management, role-based routing)
- [ ] Document system UI (proposals, change orders, invoices)
- [ ] Client portal
- [ ] Sub portal
- [ ] "Invite user to job" flow
- [ ] Change order approval transaction (Edge Function)
- [ ] Invoice snapshot logic (cost-plus)
- [ ] Supabase migrations setup
- [ ] Storage bucket policies (waiting on buckets being created)
- [ ] Moving Claude AI interview from client-side to server-side API route

---

## Open Questions / Deferred Decisions

- Invoice billing schedule: no fixed process yet. PM decides when to bill. Deposits for upcoming items and billing for completed items are the intended model. Exact schedule TBD.
- Storage RLS for clients: currently path-matched to job ID. May need category-level restrictions (clients shouldn't see internal plans vs. shared selections). Deferred to v2.
- Price sheet visibility for cost-plus clients: currently they see all columns including unit costs. May want to hide vendor names or individual unit costs and show trade subtotals only. Deferred to v2.
- Sub trade-level filtering on price sheet: deferred to v2. Currently subs see nothing financial.
- Vendor role differentiation from sub: currently identical access. Reserved for future use.


