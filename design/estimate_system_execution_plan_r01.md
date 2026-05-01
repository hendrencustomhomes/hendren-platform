# ESTIMATE SYSTEM EXECUTION PLAN — r01

**Date:** 2026-05-01  
**Status:** LOCKED EXECUTION SEQUENCE  
**Scope:** Estimate + Proposal system, Scope removal, Takeoff consolidation, pricing integration

---

## 1. Overview

This document defines the exact execution sequence and architecture for the Hendren Platform estimating system.

It is the design source of truth for:
- Estimate system
- Proposal system
- Import/export behavior
- Removal of Scope + Takeoff modules
- Integration with Selections, Bids, and Price Sheets

All implementation must follow this structure.

No deviation without a new revision.

---

## 2. Core Architecture

```text
Job
 ├── Estimate (one or many; internal working system)
 │     └── Worksheet (scope + quantities + pricing)
 │
 └── Proposal (one per active estimate)
       ├── Summary (default)
       ├── Builder Settings
       ├── Preview
       └── PDF Export
```

### Locked Rules

- Estimate is the internal truth.
- Proposal is the presentation/output layer.
- There is no standalone Scope module.
- There is no separate Takeoff module.
- There is one unified Estimate worksheet.
- Proposal Summary replaces the old Scope concept for rollup/health/readiness.

---

## 3. Estimate System

### 3.1 Estimate Selector

Each job supports multiple estimates.

Estimate statuses:
- `draft`
- `active`
- `approved` (future lock state)
- `archived`

Required actions:
- create blank estimate
- duplicate estimate
- import estimate
- export estimate
- archive estimate
- select active estimate

Only one estimate should be active per job.

### 3.2 Estimate Worksheet

The Estimate tab is the worksheet. Do not split it into takeoff view vs estimate view.

Worksheet must support:
- detailed takeoff rows
- parent/child rows
- one-level hierarchy
- collapsible parent rows
- line items
- assemblies
- notes
- allowances
- sort/filter by column later
- pricing/source metadata later

### 3.3 Column Order

Column order is locked for now. Do not build a saved-view system yet.

Core estimate fields left:

```text
Description | Qty | Unit | Unit Price | Total
```

Editable metadata next:

```text
Location | Cost Code | Catalog SKU | Source SKU | Vendor | Notes
```

System/derived metadata far right:

```text
Pricing Status | Selection Status | Source Type | Health Flags
```

Rules:
- Core estimating fields stay left.
- Editable metadata comes before system/derived metadata.
- System/derived metadata stays far right.
- Do not create column category abstractions yet.
- Do not create saved views yet.

---

## 4. Proposal System

Proposal is the summary and output system for the active estimate.

Route/window structure:

```text
Proposal
 ├── Summary (default)
 ├── Builder Settings
 ├── Preview
 └── PDF Export
```

### 4.1 Summary

Summary is the default window in Proposal.

It should show:
- estimate totals
- cost rollups
- allowance totals
- missing quantities
- missing prices
- missing cost codes
- missing source/selection data when relevant
- estimate health
- proposal readiness

### 4.2 Builder Settings

Builder settings should infer approximately 90% from:
- job type
- estimate structure
- allowances
- alternates/options

Still allow overrides:
- show/hide groups
- rename proposal sections
- select detail level
- include/exclude allowances
- include/exclude alternates
- notes/exclusions

### 4.3 Preview

Preview must mirror final proposal output.

Rules:
- no duplicate PDF-only structure if avoidable
- read-only preview
- reflects builder settings

### 4.4 PDF Export

PDF export belongs to Proposal, not Estimate.

Rules:
- generate from preview structure
- block export on critical proposal readiness failures
- preserve estimate/proposal traceability

---

## 5. Import / Export

### 5.1 Estimate Import

Import is for creating new estimates only.

Rules:
- strict template only
- no mapping wizard
- no merge logic
- never edits an existing estimate
- never overwrites existing rows
- creates a new draft estimate
- row IDs are auto-generated
- full validation before insert
- reject invalid files before writing anything
- no partial imports

Supported formats:
- CSV
- XLSX

### 5.2 Estimate Export

Export applies to the selected estimate.

Rules:
- export full estimate
- template-compatible output
- CSV and XLSX support
- export should be usable as a starting template for a new imported estimate

---

## 6. Pricing Ecosystem Integration

Integration flow:

```text
Price Sheets / Bids → Selections → Estimate → Proposal
```

### 6.1 Price Sheets

Price Sheets are reusable pricing sources.

They provide standard pricing options but do not replace the estimate.

### 6.2 Bids

Bids are job-specific pricing sources.

They provide vendor/sub pricing options for a specific job.

### 6.3 Selections

Selections are the choice/finalization layer.

Selections decide which available option is selected, awarded, or client-approved.

Selections should not become a second estimate.

### 6.4 Estimate

Estimate consumes:
- quantity truth
- manual pricing
- price sheet pricing
- bid pricing
- selected/final pricing decisions

Estimate may store resolved pricing snapshots for stability, but source references must remain traceable.

### 6.5 Proposal

Proposal reads the estimate's resolved totals and readiness state.

Proposal should not care whether pricing came from manual entry, a bid, a price sheet, or a selection.

---

## 7. Required Execution Sequence

### Phase 1 — Foundation

#### 06 — Estimate Entity

Create estimate as a first-class entity.

Includes:
- estimates table
- estimate selector
- default estimate per job
- create/select/archive basics

Do not bind worksheet rows yet unless explicitly included in a later approved slice.

#### 07 — Bind Worksheet to Estimate

Includes:
- add `estimate_id` to worksheet rows
- migrate existing worksheet rows to default estimate
- update worksheet persistence to scope by estimate
- update local backup key to include estimate id

### Phase 2 — UI Structure

#### 08 — Route + UI Cleanup

Includes:
- remove Scope tab
- remove legacy Takeoff tab
- replace old Estimate/Worksheet entry with Estimate tab
- add Proposal tab/route shell
- redirect old worksheet route to new estimate route

### Phase 3 — Worksheet Completion

#### 09 — Worksheet Enhancements

Includes:
- collapsible parent rows
- state-level two-level hierarchy enforcement
- locked column order
- basic sort/filter if safe

### Phase 4 — Import / Export

#### 10 — Estimate Import/Export

Includes:
- strict CSV/XLSX template
- import creates new draft estimate only
- validation before insert
- export selected estimate

### Phase 5 — Proposal Foundation

#### 11 — Proposal Entity + Summary

Includes:
- proposals table
- proposal tied to active estimate
- Summary default page/window
- health and readiness indicators

### Phase 6 — Proposal Builder

#### 12 — Builder Settings

Includes:
- inferred defaults
- override controls
- settings stored on proposal entity

### Phase 7 — Output

#### 13 — Preview

Includes:
- proposal preview
- shared structure with PDF output

#### 14 — PDF Export

Includes:
- PDF generation
- readiness gating

### Phase 8 — Pricing Ecosystem

#### 15 — Pricing Columns in Estimate

Includes metadata fields:
- catalog sku
- source sku
- vendor
- pricing status
- selection status
- source type

#### 16 — Bids Integration

Includes:
- link estimate rows to bid line items
- snapshot selected bid pricing

#### 17 — Price Sheets Integration

Includes:
- reusable pricing source lookup
- row-level source selection

#### 18 — Selections Integration

Includes:
- selection/final-choice linkage
- selected vs available tracking

### Phase 9 — Polish / Safety

#### 19 — Validation + Health Refinement

Includes:
- refine row-kind rules
- readiness logic
- proposal gating

#### 20 — Performance + Stability

Includes:
- large estimate performance
- autosave tuning
- undo stack review

---

## 8. Critical Rules

- Do not reorder slices without revising this document.
- Do not combine unrelated slices.
- Do not remove legacy UI before estimate entity and worksheet binding are stable.
- Do not add proposal output before proposal summary/readiness exists.
- Do not wire Selections/Bids/Price Sheets before the estimate system is stable.
- Do not create a separate takeoff source of truth.
- Do not create a separate scope source of truth.
- Do not allow import to modify existing estimates.

---

## 9. Handoff Requirement

All future handoffs must reference this document until the plan is complete.

Required handoff line:

```text
Reference design/estimate_system_execution_plan_r01.md as the active execution sequence unless superseded by a newer revision.
```

If this plan changes, create a new revision and update the handoff reference.
