# Doc Restructure — 2026-05-05

**Type:** Structural / operational  
**Branch:** dev  
**Commit:** 82445eb

---

## What Was Done

Consolidated 56 documentation files from five scattered source directories into `docs/modules/` organized by module. Source directories were deleted after the move.

**Source directories removed:**
- `docs/slices/`
- `docs/audits/`
- `docs/archive/stale-2026-05-02/` and `docs/archive/`
- `docs/actions/slices/`
- `docs/actions/architecture/`

**Destination modules used:**
- `docs/modules/estimate/` — estimate, proposal, worksheet slice reports and archived planning docs
- `docs/modules/pricing/` — pricing and catalog audits and planning docs
- `docs/modules/platform/` — cross-cutting worksheet audits, bugfix records, shared foundation, permission architecture

---

## Grouping Rules Applied

**Estimate and proposal are the same module.** All slice reports (numbered and unnumbered) go to `estimate/` regardless of whether they describe estimate-side or proposal-side work. The proposal is an output artifact of the estimate; they share a pipeline.

**Pricing and catalog are the same module.** Catalog is the item identity layer that feeds pricing sources. Audit records for both belong together in `pricing/`.

**Worksheet, bugfix, shared, and platform docs go together.** These are not specific to any single product module. Worksheet audits describe cross-cutting infrastructure work on the shared table engine. Bugfix sweeps and foundation records are repo-wide. Permission architecture is platform-level infrastructure.

**Archive files split by module rather than kept in a single archive folder.** Each stale doc was assigned to the module its subject belongs to. Version numbering (r01, r02 being earlier than r03) provides sufficient staleness signal without a separate archive directory.

---

## Files Moved

### `docs/modules/estimate/` — 34 files

| File | Source | Reason |
|---|---|---|
| `slice_06_estimate_entity_report.md` | `docs/slices/` | Estimate entity schema slice report |
| `slice_06_5_estimate_schema_cleanup_report.md` | `docs/slices/` | Estimate schema cleanup slice report |
| `slice_07_bind_worksheet_report.md` | `docs/slices/` | Worksheet-to-estimate binding slice report |
| `slice_08_remove_scope_takeoff_ui.md` | `docs/slices/` | Removing old takeoff UI; estimate/worksheet module work |
| `slice_09_worksheet_completion.md` | `docs/slices/` | Worksheet persistence completion slice report |
| `slice_09_5_write_path_hardening.md` | `docs/slices/` | Write path hardening; estimate persistence work |
| `slice_10_import_export.md` | `docs/slices/` | CSV import/export for estimate worksheets |
| `slice_11_proposal_summary.md` | `docs/slices/` | Proposal summary; proposal is part of estimate module |
| `slice_12_proposal_builder.md` | `docs/slices/` | Proposal builder slice report |
| `slice_12_5_builder_sync_lock.md` | `docs/slices/` | Builder sync and lock slice report |
| `slice_13_proposal_preview.md` | `docs/slices/` | Proposal preview slice report |
| `slice_14_shared_pdf_output.md` | `docs/slices/` | PDF output for proposals |
| `slice_15_document_snapshot_send_foundation.md` | `docs/slices/` | Document snapshot and send foundation |
| `slice_16_send_workflow.md` | `docs/slices/` | Proposal send workflow slice report |
| `slice_17_pricing_link.md` | `docs/slices/` | Pricing link feature implemented in estimate/worksheet codebase |
| `slice_18_pricing_link_hardening.md` | `docs/slices/` | Pricing link hardening; estimate/worksheet work |
| `slice_19_estimate_lock.md` | `docs/actions/slices/` | Estimate lock/status guardrails slice report |
| `slice_20_worksheet_persistence_guardrails.md` | `docs/actions/slices/` | Worksheet persistence server-action guardrails |
| `slice_21_job_worksheet_items_rls.md` | `docs/actions/slices/` | RLS enforcement on worksheet items |
| `slice_22_estimate_health_indicators.md` | `docs/actions/slices/` | Estimate health indicator UI |
| `slice_23_send_validation.md` | `docs/actions/slices/` | Pre-send validation; part of send pipeline |
| `slice_24_estimate_permissions.md` | `docs/actions/slices/` | Estimate permission enforcement slice report |
| `slice_25_rls_service_role_audit.md` | `docs/actions/slices/` | RLS and service role audit; slice report, grouped with estimate work |
| `slice_26_proposal_document_permission_guards.md` | `docs/actions/slices/` | Proposal document permission guards |
| `slice_27_lockProposal_resolution.md` | `docs/actions/slices/` | lockProposal resolution slice report |
| `slice_28_set_active_estimate_rpc_audit.md` | `docs/actions/slices/` | set_active_estimate RPC audit |
| `slice_29_archive_restore_fix.md` | `docs/actions/slices/` | Archive and restore behavior fix |
| `slice_30_stage_estimate_action.md` | `docs/actions/slices/` | Stage estimate server action |
| `slice_31_stage_unstage_ui.md` | `docs/actions/slices/` | Stage/unstage UI wiring |
| `slice_32_reject_and_lock.md` | `docs/actions/slices/` | Reject and permanent lock |
| `slice_33_send_rpc_atomic_status_cleanup.md` | `docs/actions/slices/` | Send RPC atomic status cleanup |
| `anchor.md` | `docs/archive/stale-2026-05-02/` | Takeoff V1.1 execution anchor; takeoff is now part of estimate module |
| `estimate_proposal_consolidation_plan_r01.md` | `docs/archive/stale-2026-05-02/` | Estimate/proposal consolidation planning; estimate module |
| `takeoff_estimate_unified_design_r01.md` | `docs/archive/stale-2026-05-02/` | Takeoff + estimate unified design; superseded by r02 already in estimate/ |

---

### `docs/modules/pricing/` — 7 files

| File | Source | Reason |
|---|---|---|
| `catalog_audit_r01.md` | `docs/audits/` | Catalog audit; catalog feeds pricing, same module |
| `catalog_identity_edit_r01.md` | `docs/audits/` | Catalog identity edit audit |
| `catalog_stress_audit_r01.md` | `docs/audits/` | Catalog stress audit |
| `pricing_stabilization_audit_r01.md` | `docs/audits/` | Pricing stabilization audit |
| `pricing_worksheet_stitch.md` | `docs/slices/` | Pricing-to-worksheet integration record |
| `cleanup_plan_r01.md` | `docs/archive/stale-2026-05-02/` | Pricing module cleanup plan r01; superseded by r03 already in pricing/ |
| `cleanup_plan_r02.md` | `docs/archive/stale-2026-05-02/` | Pricing module cleanup plan r02; superseded by r03 |

---

### `docs/modules/platform/` — 15 files

| File | Source | Reason |
|---|---|---|
| `bugfix_sweep_01.md` | `docs/slices/` | Cross-cutting bugfix sweep; not specific to any module |
| `bugfix_sweep_02.md` | `docs/slices/` | Cross-cutting bugfix sweep |
| `shared_foundation_r01.md` | `docs/slices/` | Shared UI foundation build; cross-cutting platform work |
| `permission_status_rewrite.md` | `docs/actions/architecture/` | Permission/status architecture design; platform-level infrastructure |
| `worksheet_cleanup_slice_r01.md` | `docs/audits/` | Worksheet cleanup audit pass; cross-cutting table engine work |
| `worksheet_cleanup_slice_r02.md` | `docs/audits/` | Worksheet cleanup audit pass |
| `worksheet_cleanup_slice_r03.md` | `docs/audits/` | Worksheet cleanup audit pass |
| `worksheet_cleanup_slice_r04.md` | `docs/audits/` | Worksheet cleanup audit pass |
| `worksheet_cleanup_slice_r05a.md` | `docs/audits/` | Worksheet cleanup audit pass |
| `worksheet_cleanup_slice_r05b.md` | `docs/audits/` | Worksheet cleanup audit pass |
| `worksheet_stability_audit_r01.md` | `docs/audits/` | Worksheet stability audit; cross-cutting |
| `worksheet_takeoff_reuse_audit_r01.md` | `docs/audits/` | Worksheet/takeoff reuse audit; cross-cutting |
| `worksheet_centralization_handoff_r01.md` | `docs/archive/stale-2026-05-02/` | Worksheet centralization planning; superseded by r02 already in pricing/ |
| `worksheet_reuse_design_r01.md` | `docs/archive/stale-2026-05-02/` | Worksheet reuse design r01; superseded by r03 already in pricing/ |
| `worksheet_reuse_design_r02.md` | `docs/archive/stale-2026-05-02/` | Worksheet reuse design r02; superseded by r03 |
