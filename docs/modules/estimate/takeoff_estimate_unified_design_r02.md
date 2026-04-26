# Takeoff + Estimate Unified Worksheet — R02

**Date:** 2026-04-25  
**Status:** Active implementation design  
**Branch target:** `dev`  
**Supersedes:** `docs/modules/estimate/takeoff_estimate_unified_design_r01.md`

---

## 1. Status

R02 preserves the R01 architectural principle, but replaces the conceptual table plan with the actual live DB direction now applied through Claude Chat SQL.

The live DB now has the new unified worksheet tables:

```text
job_worksheet_items
estimate_versions
estimate_version_items
```

Legacy tables remain present and untouched:

```text
job_scope_items
takeoff_items
estimate_items
estimate_line_items
```

Those legacy tables are not the new unified worksheet system.

---

## 2. Core Principle — Preserved From R01

There is still **no conversion pipeline**.

Rejected model:

```text
scope -> takeoff -> estimate -> proposal
```

Correct model:

```text
One job worksheet row set
Multiple modes / views over the same rows
```

Scope, Takeoff, Estimate, and Proposal Prep are different views over the same live worksheet rows.

No row duplication between stages.
No Takeoff-to-Estimate conversion step.
No separate estimator-facing copy of takeoff rows.

---

## 3. Mental Model — Preserved

```text
Catalog = what the item is
Pricing Sources = where source pricing options live
Job Worksheet = what this job needs, how much, and how it is priced/sold
Proposal = packaging, filtering, wording, sending, and signature handoff
```

The full flow remains:

```text
Catalog -> Pricing Sources -> Job Worksheet -> Proposal -> Signoff
```

---

## 4. Source-of-Truth Tables

### 4.1 Live mutable worksheet truth

```text
job_worksheet_items
```

This is the live editable row set for:

```text
scope
takeoff
estimate
proposal prep
```

### 4.2 Approved estimate/version truth

```text
estimate_versions
estimate_version_items
```

Live worksheet rows can keep changing.
Approved estimate history must not silently change.

---

## 5. Live DB Reality — job_worksheet_items

### 5.1 Row identity and hierarchy

The live worksheet row table includes:

```text
id uuid primary key
job_id uuid not null
parent_id uuid null
sort_order integer not null default 0
row_kind worksheet_row_kind not null default 'line_item'
```

`parent_id` supports grouping rows under an assembly.

### 5.2 Row kinds

The live enum is:

```text
worksheet_row_kind:
- line_item
- assembly
- note
- allowance
```

R02 intentionally accepts `line_item` instead of R01's generic `item` naming.

Rules:

- `line_item` = normal scope/takeoff/estimate row
- `assembly` = grouped/rolled-up scope, package, or assembly concept
- `allowance` = allowance row that can later be resolved through selections
- `note` = non-priced note/context row

`package` is not a row kind. Package behavior is represented by `assembly`.

---

## 6. Scope Model

### 6.1 Live scope fields

```text
description text not null
location text null
notes text null
scope_status worksheet_scope_status not null default 'included'
is_upgrade boolean not null default false
replaces_item_id uuid null
```

The live enum is:

```text
worksheet_scope_status:
- included
- excluded
```

### 6.2 Location simplification

R02 consolidates R01's location / area / room concept into one field:

```text
location
```

Examples:

```text
Kitchen
Primary Bath
Exterior
Garage
Whole House
```

Do not add separate `area` or `room` fields for the first implementation pass.

### 6.3 Upgrade / replacement model

R02 removes the separate `alternate` status.

Use:

```text
is_upgrade
replaces_item_id
```

Meaning:

```text
Base item:
is_upgrade = false
replaces_item_id = null

Additive upgrade:
is_upgrade = true
replaces_item_id = null

Replacement upgrade:
is_upgrade = true
replaces_item_id = base row id
```

Important rule:

```text
The upgrade/replacement row points to the base row it replaces.
The base row does not point to the upgrade.
```

This allows multiple upgrade options to point at the same base row later if needed.

---

## 7. Takeoff Model

Live takeoff fields:

```text
quantity numeric null
unit text null
```

Rules:

- quantity may be null
- unit may be null
- quantity truth belongs on the worksheet row
- no separate takeoff row system should be created for new implementation

Legacy `takeoff_items` remains untouched for now, but it is not the new source of truth.

---

## 8. Pricing Source Integration

Live pricing/source fields:

```text
pricing_source_row_id uuid null
pricing_header_id uuid null
catalog_sku text null
source_sku text null
unit_price numeric null
total_price numeric null
pricing_type worksheet_pricing_type not null default 'unpriced'
```

The live enum is:

```text
worksheet_pricing_type:
- unit
- lump_sum
- allowance
- manual
- unpriced
```

Rules preserved from R01:

- `catalog_sku` = item identity
- `source_sku` = pricing/source option identity
- never merge `catalog_sku` and `source_sku`
- pricing source selection belongs in the worksheet/estimate flow, not Catalog
- Catalog may expose source visibility, but Catalog does not mutate pricing

### 8.1 total_price behavior

`total_price` is intentionally a plain nullable numeric field, not a generated column.

Reason:

- lump-sum pricing may not equal quantity times unit price
- manual pricing must remain possible
- allowance behavior may need controlled presentation and rounding
- application/service logic owns calculation behavior

### 8.2 Pricing math behavior

Target behavior:

```text
unit:
  total_price = quantity x unit_price

allowance:
  total_price = quantity x unit_price, unless business logic explicitly stores an approved override

lump_sum:
  total_price may be entered directly or derived from unit_price depending on UI rule

manual:
  total_price may be manually entered

unpriced:
  total_price should remain null
```

---

## 9. Estimate Math Ownership

R01 required Estimate to own markup and commercial math.
That requirement is preserved.

Current live table has:

```text
unit_price
total_price
pricing_type
```

But it does **not yet fully model** all future estimate math fields such as:

```text
markup_percent
markup_amount
sell_total
cost_total
```

This is a known schema/design gap before a complete estimating UI.

Do not erase the R01 requirement just because the first live table pass is narrower.

Implementation must decide before full estimate build whether to:

1. add explicit markup/sell fields to `job_worksheet_items`, or
2. compute and store them through a related estimate/pricing layer, or
3. defer markup until a later controlled pass while keeping early worksheet entry limited.

Non-negotiable rule:

```text
Proposal does not calculate commercial math.
Estimate / worksheet estimate logic owns math.
```

---

## 10. Proposal Prep Boundary

R01's proposal boundary remains locked.

Proposal owns:

```text
document layout
client-facing grouping
client-facing wording
visibility filtering
send workflow
signature handoff
```

Proposal does not own:

```text
quantity truth
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

Current live `job_worksheet_items` does not yet include all proposal-prep fields from R01, such as:

```text
client_visible
proposal_group
client_description_override
proposal_notes
allowance_display_mode
```

That is a known future schema gap before Proposal Prep implementation.
Do not start Proposal implementation until those fields/boundaries are deliberately designed.

---

## 11. Allowances and Selections

Allowance rows are now first-class via:

```text
row_kind = allowance
pricing_type = allowance
```

Selections are separate from worksheet row identity.

Correct relationship for later:

```text
job_worksheet_items -> selection records
```

Selection meaning:

```text
Selection = choosing the actual labor/material/source inside an allowance or open spec.
```

Selection does not replace worksheet math ownership.
Selection does not choose between alternates, because R02 does not use a separate alternate model.

A selection may later:

- reference a worksheet allowance row
- choose an actual material/source/labor option
- create variance against allowance
- feed procurement
- possibly trigger approval/change-order behavior

Do not build this selection linkage until the worksheet row implementation is stable.

---

## 12. Assembly Behavior

`assembly` replaces R01 package/lump-sum package terminology.

Rules:

- assembly may group child line items
- assembly may represent a rolled-up/lump-sum package concept
- assembly is not blocked from carrying pricing/quantity at the DB level
- application logic controls whether assembly-level pricing or child-level pricing is authoritative

Do not force fake item-level precision.
Do not force every assembly to derive only from children.

---

## 13. Estimate Versioning

### 13.1 estimate_versions

Purpose:

```text
Approved/durable estimate header snapshot.
```

Live rows remain mutable.
Estimate versions preserve approved history.

Live status enum:

```text
estimate_version_status:
- draft
- approved
- superseded
- void
```

Rules:

- approved estimates must be snapshotted/versioned
- approved base estimate should not be silently modified
- change orders should be additive child versions or otherwise explicitly related
- approval requires approved_by and approved_at in the live DB

### 13.2 estimate_version_items

Purpose:

```text
Immutable row snapshots belonging to an estimate version.
```

Snapshot rows include `pricing_type` and nullable `replaces_item_id` so approved history can preserve pricing behavior and replacement-upgrade relationships.

Snapshot table uses plain numeric totals, not generated totals.

JSON snapshots or stored row snapshots are acceptable because this table is historical evidence, not the live editable workflow state.

---

## 14. RLS / Access Status

The three new tables are now protected with internal-only RLS.

Tables:

```text
job_worksheet_items
estimate_versions
estimate_version_items
```

Current policy stance:

```text
authenticated internal users only
public.is_internal()
```

Allowed for internal users:

```text
select
insert
update
delete
```

Not yet allowed:

```text
client access
sub access
vendor access
anonymous access
```

Do not broaden RLS until the UI boundary and client/proposal workflows are explicitly designed.

---

## 15. Legacy Table Boundary

Legacy tables remain untouched:

```text
job_scope_items
takeoff_items
estimate_items
estimate_line_items
```

Current meaning:

```text
job_scope_items = legacy scope/intake questionnaire
takeoff_items = legacy takeoff rows
estimate_items = legacy orphan estimate item table
estimate_line_items = legacy estimate/proposal line table
```

Rules:

- do not destructively migrate legacy tables yet
- do not build new unified UI on legacy tables
- do not assume `job_scope_items.value_number` means quantity
- do not assume `estimate_items` belongs to `estimates`; live audit showed it has no FK to estimates
- do not create another conversion pipeline from legacy rows into estimate rows

Future migration/import may be designed later after the new worksheet flow is stable.

---

## 16. Worksheet Architecture

Reuse the proven worksheet-family architecture where practical:

```text
EditableDataTable
shared worksheet interaction hooks
shared worksheet virtualization hooks
module adapter
module state
module persistence
thin composition layer
```

Rules:

- shared table UI must not own business logic
- module adapter owns columns and formatting
- module state owns draft/dirty/undo/save queue behavior
- module persistence owns DB operations and access-aware loading/saving
- do not generalize beyond proven behavior
- do not touch Pricing Sources or Catalog while building the first worksheet adopter

Modes remain:

```text
scope
takeoff
estimate
proposal_prep
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

## 17. Mode Ownership — Updated

### Scope mode

Purpose:

```text
Define what is included/excluded and where it belongs.
```

Primary fields:

```text
description
location
scope_status
is_upgrade
replaces_item_id
catalog_sku
notes
```

### Takeoff mode

Purpose:

```text
Define quantity truth.
```

Primary fields:

```text
quantity
unit
parent_id
row_kind
```

### Estimate mode

Purpose:

```text
Resolve pricing source and pricing behavior.
```

Primary fields currently live:

```text
pricing_source_row_id
pricing_header_id
catalog_sku
source_sku
unit_price
total_price
pricing_type
```

Known gap:

```text
full markup / sell-price fields are not yet represented in live job_worksheet_items
```

### Proposal Prep mode

Purpose:

```text
Prepare approved estimate data for client-facing presentation.
```

Known gap:

```text
proposal-prep fields are not yet represented in live job_worksheet_items
```

Do not start Proposal implementation until those fields are deliberately added.

---

## 18. Critical Rules — Preserved / Updated

1. No row duplication between Scope, Takeoff, Estimate, and Proposal Prep.
2. No conversion step from Takeoff to Estimate.
3. No pricing edits in Catalog.
4. No bid requests from Catalog.
5. Bid/source resolution originates from job worksheet needs, not Catalog mutation.
6. Estimate owns commercial math.
7. Proposal does not silently recalculate prices.
8. Proposal packages, filters, writes client-facing scope, sends, and hands off to signature capture.
9. `is_upgrade` marks optional upgrades/add-ons.
10. `replaces_item_id` marks replacement upgrades.
11. There is no separate `alternate` scope status in R02.
12. Approved estimates must be snapshotted/versioned.
13. `catalog_sku` and `source_sku` must remain separate.
14. `assembly` replaces the package row concept.
15. `location` replaces separate location/area/room fields for now.

---

## 19. Known Risks / Gaps Before UI

### 19.1 Markup / sell math gap

Live table currently has `unit_price`, `total_price`, and `pricing_type`, but not full markup/sell fields.

Before full estimate UI, decide how markup and sell totals are represented.

### 19.2 Proposal prep field gap

Live table does not yet contain proposal-prep fields.

Do not start Proposal implementation until those fields are explicitly designed.

### 19.3 Legacy coexistence risk

Old tabs still use legacy tables.
New unified UI must avoid creating two active sources of truth for the same workflow.

### 19.4 Assembly pricing ambiguity

The DB allows assembly-level pricing and child-level pricing.
Application logic must make clear which is authoritative in each case.

### 19.5 Allowance/selection boundary

Allowance rows exist, but selection linkage is not built yet.
Do not fake selection behavior inside the worksheet row itself.

---

## 20. Regression Check Against R01

Preserved:

- one row set / multiple modes
- no conversion pipeline
- Catalog remains item identity
- Pricing Sources remain source options
- `catalog_sku` and `source_sku` remain separate
- Takeoff quantity can exist without pricing
- Estimate owns math
- Proposal owns presentation/signature handoff
- approved estimates are versioned/snapshotted
- change orders remain child/additive estimate/version records
- allowance behavior remains a first-class requirement
- lump-sum/package behavior remains supported through assembly
- worksheet adapter/state/persistence architecture remains the implementation direction

Changed intentionally:

- primary row table is `job_worksheet_items`, not conceptual `job_scope_items`
- `row_kind = line_item`, not `item`
- `row_kind = allowance` added
- package terminology removed; use `assembly`
- location/area/room consolidated to `location`
- no `alternate` scope status
- replacement upgrades use `replaces_item_id`
- `scope_status` only supports `included` and `excluded`
- `total_price` is plain numeric, not generated
- RLS is internal-only for now

---

## 21. Next Step

Before building UI:

1. confirm whether the first adopter is a new job worksheet workspace or a replacement for the existing Takeoff tab
2. decide the first mode to implement, likely `takeoff` or `scope + takeoff` only
3. decide how much estimate math is allowed before markup/sell fields are added
4. avoid touching Pricing Sources or Catalog
5. avoid replacing legacy tabs until the new worksheet has safe create/view/update behavior

Recommended next controlled implementation slice:

```text
Build the first internal-only job worksheet workspace against job_worksheet_items with line_item / assembly / allowance / note rows, quantity/unit entry, source identity placeholders, and no Proposal implementation.
```

Do not start Proposal implementation yet.
