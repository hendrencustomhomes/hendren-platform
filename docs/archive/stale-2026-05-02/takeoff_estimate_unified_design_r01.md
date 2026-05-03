# Takeoff + Estimate Unified Worksheet — R01

**Date:** 2026-04-25  
**Status:** Approved design direction  
**Locked sequence position:** Step 3 of 4 — Takeoff / Estimate

---

## Status

**APPROVED — replaces any prior assumption that Scope, Takeoff, and Estimate are separate conversion steps.**

This document does not replace the Pricing Sources or Catalog architecture. It builds on them.

---

## Core Principle — LOCKED

There is **no conversion pipeline**.

Scope, Takeoff, Estimate, and Proposal Prep are different views of the **same underlying job scope row set**.

Rejected model:

```text
scope → takeoff → estimate → proposal
```

Why rejected:

- duplicate rows
- data loss at handoff points
- excessive manual re-entry
- stale quantities
- unclear source of truth
- unnecessary complexity

Correct model:

```text
One job-cost worksheet
Multiple views / modes over the same rows
```

---

## Mental Model

```text
Catalog = what the item is
Pricing Sources = where source pricing options live
Scope / Takeoff / Estimate = what this job needs and how it is priced/sold
Proposal = packaging, filtering, wording, sending, and signature handoff
```

---

## Primary Working Entity

Use one shared row set, conceptually:

```text
job_scope_items
```

Each row represents one unit of job scope tied to catalog identity.

Required identity:

```text
job_scope_item_id
catalog_sku
```

Core row fields should include:

```text
catalog_sku
description_snapshot
trade_id
cost_code_id
```

These fields anchor the row across Scope, Takeoff, Estimate, and Proposal Prep views.

---

## View-Based Field Ownership

### 1. Scope View

Purpose:

```text
Define WHAT is included in the job.
```

Fields / responsibilities:

```text
catalog_sku
description_snapshot
location / area / room grouping
included / excluded / alternate status
internal scope notes
```

Rules:

- no pricing required
- no quantity required, though quantity may be entered if known
- no proposal wording required
- no conversion step into Takeoff

---

### 2. Takeoff View

Purpose:

```text
Define HOW MUCH of each scope item exists.
```

Fields / responsibilities:

```text
quantity
unit
takeoff_notes
measurement basis / waste factor later if needed
```

Rules:

- quantity can exist while price is null
- takeoff owns quantity truth
- no separate estimator-facing takeoff copy
- no conversion step into Estimate

---

### 3. Estimate View

Purpose:

```text
Turn job scope + quantity + pricing source into cost and sell value.
```

Fields / responsibilities:

```text
selected_source_sku
pricing_type
unit_price
cost_total
markup
sell_price
allowance/package handling
estimator_notes
is_upgrade
```

Rules:

- Estimate owns markup and commercial math
- Proposal does not calculate pricing math
- Estimate may carry incomplete pricing while in draft
- proposal-ready/send checks happen later, not inside Catalog or Pricing Sources
- `is_upgrade` marks optional add-on / upgrade items above the base proposal

---

### 4. Proposal Prep View

Purpose:

```text
Prepare approved estimate data for client-facing presentation.
```

Fields / responsibilities:

```text
client_visible
proposal_group
client_description_override
inclusion / exclusion display flags
allowance presentation mode
is_upgrade
```

Rules:

- no pricing math here
- no quantity truth here
- no source pricing edits here
- Proposal Prep can decide visibility/grouping/presentation
- `is_upgrade` allows optional add-on items to be separated from base proposal content

---

## Optional Add-On / Upgrade Rule

The worksheet must support an optional add-on flag:

```text
is_upgrade boolean default false
```

Meaning:

```text
false = base proposal / normal scope item
true = optional upgrade or add-on above the base proposal
```

This is not the same as excluded scope.

Recommended distinction:

| State | Meaning |
|---|---|
| base item | included in base proposal total |
| excluded item | not included / explicitly excluded |
| alternate item | alternate path or option, may or may not be chosen |
| `is_upgrade = true` | optional add-on or upgrade presented separately from base |

Rules:

- upgrade items still use the same row model
- upgrade items can have quantity, source pricing, markup, and sell price
- upgrade items should not require a separate worksheet or copied rows
- Proposal can package upgrades separately, but should not recalculate their math
- Estimate remains the math owner

Devil’s advocate: this flag must not become a junk drawer for every optional condition. If an item changes base scope logic, use inclusion/alternate/exclusion status. Use `is_upgrade` specifically for add-ons/upgrades that can be presented separately from the base proposal.

---

## Proposal Boundary

Proposal is not the estimating worksheet.

Proposal owns:

```text
document layout
client-facing grouping
client-facing typed inclusions / exclusions
visibility filtering
send workflow
signature capture handoff
```

Proposal does not own:

```text
quantity
pricing source selection
markup
sell-price math
row-level cost calculations
```

Correct boundary:

```text
Estimate calculates.
Proposal communicates.
Signoff executes.
```

---

## Versioning Model

Avoiding conversion does not mean everything remains mutable forever.

### Working State

```text
Live worksheet = mutable working state
```

### Approved Estimate

Create an estimate version/snapshot at approval.

Conceptual table:

```text
estimate_versions
```

Stores:

```text
approved row state
totals
upgrade/add-on rows
approval metadata
approved_by
approved_at
```

### Change Orders

Change orders are child estimates / child versions.

Rules:

- base estimate is never silently modified
- approved change orders add to approved base
- job total = approved base + approved change orders

---

## Pricing Integration

Preserved model:

```text
Catalog → Pricing Sources → Scope/Takeoff/Estimate → Proposal → Signoff
```

Identity and source resolution:

```text
catalog_sku → multiple source_sku options → selected_source_sku
```

Rules:

- `catalog_sku` remains item identity
- `source_sku` remains source-side option identity
- never merge `catalog_sku` and `source_sku`
- bid requests originate from Takeoff / job scope items, not Catalog
- Catalog can seed generic/price-sheet pricing, but not bid requests

---

## Allowance Behavior — Preserved

Estimate math:

```text
quantity × unit_price = estimate total
```

Proposal display behavior:

```text
show allowance rate / basis as appropriate
hide detailed total if presentation requires it
```

Proposal does not alter the math.

---

## Package Behavior — Preserved

Package / lump-sum source rows may cover multiple catalog items.

Rules:

- package lines do not require item-level pricing
- package budget can be authoritative when used
- do not force fake item-level precision

---

## Worksheet Architecture

Scope / Takeoff / Estimate should reuse the proven worksheet family architecture where practical:

```text
EditableDataTable
adapter layer
state layer
persistence layer
```

But do not prematurely generalize pricing-specific logic.

Recommended implementation model:

```text
mode = scope | takeoff | estimate | proposal_prep
```

Each mode controls:

```text
visible columns
editable fields
validation/warnings
actions
```

Modes must not create duplicate row storage.

---

## Example Column Ownership

| Field | Scope | Takeoff | Estimate | Proposal Prep |
|---|---:|---:|---:|---:|
| catalog_sku | visible | visible | visible | visible |
| description_snapshot | editable | visible | visible | visible/override |
| quantity | optional | editable | visible | hidden/read-only |
| unit | optional | editable | visible | hidden/read-only |
| selected_source_sku | hidden | hidden | editable | hidden |
| pricing_type | hidden | hidden | visible | hidden |
| unit_price | hidden | hidden | visible/editable by source rules | hidden |
| markup | hidden | hidden | editable | hidden |
| sell_price | hidden | hidden | derived | visible/read-only |
| client_visible | hidden | hidden | hidden | editable |
| is_upgrade | optional | optional | editable | editable/displayed |

---

## Critical Rules — LOCKED

1. No row duplication between Scope, Takeoff, and Estimate.
2. No conversion step from Takeoff to Estimate.
3. No pricing edits in Catalog.
4. No bid requests from Catalog.
5. Bid requests originate from Takeoff/job scope rows.
6. Estimate owns markup and sell-price math.
7. Proposal does not silently recalculate prices.
8. Proposal packages, filters, writes client-facing scope, sends, and hands off to signature capture.
9. `is_upgrade` marks optional add-ons/upgrades without creating a separate row system.
10. Approved estimates must be snapshotted/versioned.

---

## Known Risks

### 1. UI complexity

One worksheet with multiple modes can become confusing.

Mitigation:

```text
strict mode-based column visibility and editing rules
```

### 2. Overloaded row model

Too many fields can turn one row into a junk drawer.

Mitigation:

```text
clear field ownership by mode
```

### 3. Version drift

If approved snapshots are weak, live edits can corrupt approved history.

Mitigation:

```text
estimate version snapshots are mandatory before proposal/signoff
```

### 4. Upgrade ambiguity

`is_upgrade` could be misused for alternates, exclusions, or vague options.

Mitigation:

```text
keep separate inclusion/alternate/exclusion status and reserve is_upgrade for add-ons above base proposal
```

---

## Regression Check

Preserved from current architecture:

- Pricing Sources remain the source of source pricing options
- Catalog remains item identity + read-only source visibility
- Takeoff can have quantity with null pricing
- Estimate owns markup and sell-price math
- Proposal owns packaging/presentation/signature handoff
- `catalog_sku` and `source_sku` remain separate
- `$0 → NULL` pricing rule remains intact
- allowance behavior remains intact
- package/lump-sum behavior remains intact
- change orders remain child estimate/version records

Changed / clarified in this revision:

- Scope, Takeoff, Estimate, and Proposal Prep are explicitly views over the same row set
- no conversion pipeline
- `is_upgrade` added as optional add-on/upgrade flag

---

## Next Step

Before code, design the exact implementation plan for:

```text
job scope row schema
view/mode definitions
adapter/state/persistence boundaries
version snapshot model
upgrade/add-on handling
```

Do not start Proposal implementation yet.
