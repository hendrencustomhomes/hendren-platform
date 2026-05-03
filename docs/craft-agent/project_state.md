# Hendren Platform — Project State

> Managed by Craft Agent. Updated after each slice or significant decision.
> Any session: read this file first, then confirm current position.

---

## Current Position

**Last completed:** Slice 16 — Atomic Send Workflow
- `send_proposal()` Postgres RPC — validates draft status FOR UPDATE, locks estimate, transitions proposal to sent, inserts snapshot. All or nothing. "Send proposal" button replaces "Mark as sent", redirects to new document on success.

**Active execution track:** Estimate / Proposal system (Slices 06–16 complete). Next slice TBD — see Next Up.

**Next up (decide before coding):**
- Estimate Dashboard (replaces old Scope tab) — internal-facing, shows estimate health/completeness
- Pricing columns in estimate (pull unit price from awarded bid or price sheet)
- Bid-specific behavior (award/reject controls, request/email flow)
- Company Directory UI

---

## What's Built

**Infrastructure**
- Login, dashboard, job detail, master schedule, dark mode, nav
- Files tab — `job-files` Supabase Storage bucket
- Permissions V1 — 8 templates, 6 roles, 104-cell matrix
- Company Directory schema V1 — `companies`, `company_contacts`, `company_trade_assignments`, `company_compliance_documents`
- Schedule module — dependencies, baselines, duration/buffer/lock columns
- `is_internal()` RLS — SECURITY DEFINER, no recursion, reads `internal_access.is_active` only

**Pricing Module (Price Sheets + Bids)**
- Shared pricing-family architecture — one system, two business modes
- `src/lib/pricing/headerKinds.ts` — domain config (Price Sheet vs Bid)
- `src/components/patterns/pricing/headers/PricingHeadersPageClient.tsx` + `usePricingHeadersPage.ts` — shared list UI/logic
- `src/components/pricing/PricingWorksheetPage.tsx` → `PricingWorksheetPageOrchestrator` → `PricingWorksheetTableAdapter`
- Bids list live via shared system; Price Sheets old route-local files deleted
- Worksheet centralization Slice 3 was attempted but reverted (regression in mobile/state/virtualization). Live route still uses original full-behavior page.

**Estimate / Worksheet / Proposal / Send (Slices 06–16)**
- `job_worksheet_items` — estimate worksheet with hierarchy, row kinds (`line_item`, `assembly`, `allowance`, `note`), pricing types (`unit`, `lump_sum`, `allowance`, `manual`, `unpriced`)
- `estimates` table — job → many estimates, one active per job, `set_active_estimate()` atomic RPC
- `proposal_structures` — JSONB builder with `deriveDefaultStructure` / `reconcileStructure` / `applyStructure` pipeline
- `proposal_documents` — immutable JSONB snapshots with RLS
- `send_proposal()` Postgres RPC — atomic lock + status transition + snapshot in one transaction
- Routes: `/jobs/[id]/takeoff` (worksheet), `/jobs/[id]/proposal/builder`, `/jobs/[id]/proposal/preview`, `/jobs/[id]/proposal/pdf`, `/jobs/[id]/proposal/documents/[documentId]`

---

## Active Architecture Decisions

| Decision | Ruled out |
|---|---|
| Takeoff + Estimate = one tab, one `job_worksheet_items` dataset | Separate Takeoff vs Estimate tables |
| Scope tab replaced by Estimate Dashboard | Scope as a standalone module |
| Assembly = any row with children (not a separate row_kind gate) | Separate `assembly` row type enforcement |
| Proposal is presentation layer only | Proposal as a source of pricing truth |
| Price Sheets + Bids are siblings, not separate modules | Forked worksheet UI per pricing type |
| `supabase/migrations/` is retired — Supabase MCP is sole authority | Running DDL outside `apply_migration` |
| No Supabase JS SDK generics on `.rpc()` or `.from()` | Generic type params on Supabase v2 calls |

---

## Open Issues / Follow-up Items

- Worksheet centralization Slice 3: parity work still needed (virtualization, mobile props, state hook completeness) before orchestrator can replace full-behavior page
- `send_proposal()` report should be checked: confirm no old "mark sent then snapshot later" path remains reachable
- Schedule: `sub_status` enum mismatch (from April 7 audit — may be fixed)
- Task create: fails with due date (from April 7 audit — may be fixed)

---

## Critical Rules (non-negotiable)

- `apply_migration` for ALL schema writes. `execute_sql` for reads only. Never raw DDL outside a migration.
- No Supabase JS SDK generics on `.rpc()` or `.from()` — cast at return boundary only.
- `dev` branch only. One commit per slice. Push only to `dev`.
- Additive-only unless explicitly authorized for destructive changes.
- No regression. No architecture invention. No combining slices. No touching unrelated modules.
- If design conflicts → STOP and document the issue, do not patch around it.
- `createAdminClient()` for server-side ops that bypass RLS.
- `procurement_items.order_by_date` is GENERATED ALWAYS AS — never write to it.
- `company_contacts`: `full_name` (not `name`), `title` (not `position`).

---

## Key File Paths (quick reference)

- Active execution plan: `design/estimate_system_execution_plan_r02.md`
- Slice reports: `docs/claude/`
- Module design docs: `docs/modules/`
- Shared worksheet engine: `src/components/data-display/worksheet/`
- Job worksheet adapter: `src/components/patterns/estimate/`
- Pricing orchestrator: `src/components/patterns/pricing/PricingWorksheetPageOrchestrator.tsx`
- Pricing domain config: `src/lib/pricing/headerKinds.ts`
- Shared pricing list: `src/components/patterns/pricing/headers/`

---

*Last updated: 2026-05-02*
