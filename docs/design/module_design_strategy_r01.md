# Hendren Platform — Module Design Strategy (R01)

Status: active planning strategy
Branch target: `dev`
Purpose: define how module restructuring decisions should be made before further architecture and implementation work proceeds.

---

## 1. Why this doc exists

The platform has reached the point where incremental feature work is no longer enough by itself.

We now need a stronger module design structure so that:
- module boundaries stay clear
- reusable patterns do not become accidental coupling
- reference data is governed consistently
- shared UI families do not force the wrong data model
- later modules can be built faster with less drift and less rework

This document is the design-strategy layer.
It does not try to finalize every architecture detail.
It defines the decision rules for the restructuring pass.

---

## 2. Core objective

Restructure the platform so each module is:
- responsible for one clear kind of truth
- internally coherent
- externally composable
- safe to evolve without hidden regression in adjacent modules

The goal is not maximum abstraction.
The goal is durable module boundaries with practical reuse.

---

## 3. Required outcomes of the restructuring pass

The restructuring pass should produce:
- clearer module ownership
- clearer distinction between business objects, reference data, and derived views
- a reusable pattern library for naturally tabular modules
- a reusable pattern library for settings/reference modules
- cleaner downstream dependency flow
- reduced need for one-off exceptions in future modules

If a restructuring idea increases cleverness but weakens ownership clarity, it should be rejected.

---

## 4. First-principles design rules

### 4.1 One module = one primary truth responsibility

A module may display related information from other modules, but it should only own one primary truth domain.

Examples:
- Takeoff owns quantity/scope truth
- Pricing Sources / Bids owns available pricing-source truth
- Selections owns chosen-source truth
- Estimate owns internal cost-rollup truth
- Financials owns live money truth

Do not let one module quietly become the backup owner of another module's truth.

### 4.2 Separate business objects from reference data

Not every reusable thing deserves first-class module status.

We should distinguish:
- **business objects**: jobs, price sheets, bids, takeoff records, proposals, invoices
- **reference data**: units of measure, managed statuses, lookup lists, controlled settings
- **derived views**: dashboards, summaries, warnings, rollups

A recurring source of drift is treating reference data like operational records or treating operational records like simple settings.

### 4.3 Reuse patterns, not accidental structure

Shared UI should follow shared behavior.
Shared UI should not force unrelated modules into the same data model.

Use shared families when the module behavior is genuinely similar:
- worksheet-family modules
- list/detail admin modules
- settings/reference modules
- document/render/export modules

Do not unify modules just because they all use tables.

### 4.4 Settings should collect generic managed reference data

A generic settings area should exist for managed reusable reference data that is:
- used by multiple modules
- low-frequency admin managed
- not itself a full operational workflow

Likely examples:
- units of measure
- controlled option lists
- other generic reusable lookup data approved later

Likely non-examples:
- companies
- jobs
- internal users
- schedule records

### 4.5 Restructuring should reduce future exceptions

A good redesign lowers the number of special-case rules needed later.
If a proposed structure solves one current pain point but introduces more future caveats, it is probably the wrong structure.

---

## 5. Module taxonomy

The platform should increasingly be reasoned about in these categories.

### 5.1 Backbone transactional modules

These define or resolve core operational truth.

Examples:
- Pipeline
- Intake
- Takeoff
- Pricing Sources / Bids
- Selections
- Estimate
- Financials
- Change Orders
- Procurement
- Schedule

### 5.2 Shared operational directories

These are real business records used across modules, but not generic settings.

Examples:
- Companies
- Internal Users / Permissions
- External Access
- Files
- Documents

### 5.3 Controlled reference/settings modules

These are governed reusable configuration layers, not deep operational workflows.

Examples now or likely soon:
- Units of Measure
- future reusable settings lists explicitly approved later

### 5.4 Derived / oversight modules

These should not become silent truth owners.

Examples:
- Summary
- Risks
- dashboards
- readouts
- validation views

### 5.5 Execution-support modules

These support execution control but should keep clear separation from backbone truth.

Examples:
- Process
- QC / Quality Checklist
- Punchlist
- Logs
- Issues
- Notifications

---

## 6. Shared UI family strategy

### 6.1 Worksheet-family modules

Use the worksheet family only where row/column speed, scan, compare, and repeated entry are truly central.

Likely worksheet-family modules:
- Pricing Sources / Bids
- Takeoff (where appropriate)
- Estimate
- Catalog workspaces where appropriate

Rules:
- one logical worksheet record
- desktop = high-function grid-first working view
- mobile = simplified contextual renderer
- virtualization/windowing instead of fake worksheet pagination
- reference fields should stay governed where required
- worksheet convenience must not weaken canonical ownership

### 6.2 Settings/reference modules

These should use a compact admin pattern rather than a worksheet-first pattern unless row density clearly demands otherwise.

Preferred characteristics:
- concise list/detail or inline table editor
- strong validation
- active/inactive handling where appropriate
- low ambiguity
- small, safe edit surface

### 6.3 Business workflow modules

Modules with richer lifecycle logic should not be forced into generic admin or worksheet patterns when their main problem is workflow state, not tabular editing.

---

## 7. Identifier strategy

Business identifiers should remain minimal and intentional.

### 7.1 Canonical identifiers should not be duplicated casually

If a domain already has a canonical business identifier, do not introduce a second parallel business identifier unless the problem truly requires it.

### 7.2 Example direction already emerging in pricing

The identifier model should prefer:
- `catalog_sku` = canonical catalog identifier
- `source_sku` = source-side worksheet identifier
- `vendor_sku` = optional external convenience identifier

Technical DB UUIDs may still exist for storage mechanics, but they should not become redundant user-facing business identity unless necessary.

---

## 8. Reference-data strategy

The platform needs a stricter stance on managed reference data.

### 8.1 Govern where drift is expensive

If inconsistent free text creates reporting, lookup, filtering, or linkage problems later, the field should move toward managed reference data.

Example pressures already visible:
- unit of measure
- possibly certain controlled statuses
- selected reusable classifications later

### 8.2 Do not over-govern prematurely

Not every text field should become managed reference data.
Only govern fields when the downstream cost of inconsistency is real.

### 8.3 Settings growth must remain curated

A settings area should not become a junk drawer.
Only move items there when they are genuinely shared, reusable, and low-frequency admin controlled.

---

## 9. Sequencing strategy for restructuring

The restructuring pass should occur in this general order:

1. clarify module taxonomy and naming
2. clarify which modules are backbone, directory, settings, or derived
3. identify shared UI families
4. identify managed reference data that needs governance
5. identify modules currently carrying mixed responsibility
6. redesign structure before broad new implementation continues
7. resume module execution using the improved structure

Do not start with code-level refactors before the module map is clear.

---

## 10. Stop/continue rule

Future chats should work in small enough slices to avoid drift and regression, but the target standard is complete modules, not "good enough for now" modules.

Interpretation:
- each chat should take a bounded slice
- slices should add up toward complete modules
- handoffs should occur before context decay creates risk
- repo docs should be updated when stable design truth changes

This means:
- small chat slices
- full-module intent
- no casual scope drift
- no pretending a module is complete when only one narrow slice is done

---

## 11. What this strategy explicitly rejects

Reject these failure modes:
- one giant mixed super-module
- free-text ungoverned drift where downstream linkage depends on consistency
- UI reuse that forces the wrong ownership model
- derived views becoming silent truth writers
- accidental duplicate identifiers
- settings becoming a dumping ground for operational modules
- patchwork local exceptions replacing a clear structure

---

## 12. Immediate use of this document

Use this strategy doc when restructuring:
- module map
- settings placement
- worksheet-family applicability
- identifier simplification
- managed reference-data scope
- next-pass planning before new implementation resumes

This document should be read together with the companion architecture doc for the restructuring pass.
