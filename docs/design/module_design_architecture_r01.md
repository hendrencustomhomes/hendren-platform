# Hendren Platform — Module Design Architecture (R01)

Status: restructuring architecture pass
Branch target: `dev`
Purpose: define the updated structural model for modules after applying the module design strategy.

This document builds on the strategy doc and translates it into concrete structural direction.

---

## 1. Architectural intent

The platform architecture is being refined to:
- tighten module ownership boundaries
- separate operational truth from reusable reference data
- establish repeatable module patterns
- reduce coupling between modules
- enable faster, safer future development

This is not a rewrite of the entire system.
It is a structural correction layer.

---

## 2. Canonical module grouping

All modules should be categorized explicitly.

### 2.1 Backbone modules (transactional truth)

These modules define or resolve core business state.

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

Rules:
- each owns its own truth domain
- no duplicate ownership of the same truth
- cross-module data should be referenced, not re-owned

---

### 2.2 Directory modules (shared operational records)

These are reused across multiple backbone modules but are not generic settings.

- Companies
- Internal Users / Permissions
- External Access
- Files
- Documents

Rules:
- these are first-class modules
- they are not placed inside generic settings
- they may be referenced broadly but still own their own data

---

### 2.3 Settings / reference modules

These store controlled reusable configuration.

Initial scope:
- Units of Measure

Likely future candidates (only if justified):
- additional reusable lookup lists

Rules:
- no deep workflows here
- strong validation
- active/inactive where needed
- referenced by other modules, not duplicated

Route direction:
- `/more/settings/...`

---

### 2.4 Derived modules

These present computed or summarized data and must not become truth owners.

- Summary
- Risks
- dashboards and rollups

Rules:
- read from canonical modules
- never silently write back derived values as truth

---

### 2.5 Execution-support modules

These support job execution but should not absorb backbone responsibilities.

- Process
- QC / Quality Checklist
- Punchlist
- Logs
- Issues
- Notifications

---

## 3. Worksheet-family architecture

Worksheet-family modules should be treated as a shared architectural pattern, not just a UI pattern.

Applicable modules:
- Pricing Sources / Bids
- Takeoff (where appropriate)
- Estimate
- Catalog workspaces where appropriate

### 3.1 Core model

Each worksheet is:
- one logical business object
- composed of rows
- rows may reference other modules (catalog, companies, etc.)

### 3.2 Interaction model

Must follow:
- active-cell state
- local draft vs committed state
- row-level dirty tracking
- background save queue
- non-blocking navigation

This aligns with the execution rules for worksheet-family behavior. fileciteturn52file5

### 3.3 Scaling model

- virtualization/windowing for large row counts
- no fake pagination of a single worksheet
- list views (not worksheets) may paginate/search/filter

### 3.4 Reference data inside worksheets

Fields should follow this rule:
- if consistency matters downstream → reference controlled data
- if not → allow free text

Example direction:
- unit of measure → governed reference
- notes → free text

---

## 4. Reference data architecture

### 4.1 Centralized, not duplicated

Reference data should be:
- created in settings modules
- referenced by foreign key or controlled value
- not redefined per module

### 4.2 Progressive governance

Fields should evolve from free text to governed reference only when:
- reporting requires consistency
- lookup/join behavior depends on it
- user confusion becomes a real issue

Do not pre-govern everything.

---

## 5. Identifier architecture

### 5.1 Canonical identity

Each domain should have one primary business identifier.

Example (pricing domain):
- `catalog_sku` = canonical item identity
- `source_sku` = worksheet/source identity
- `vendor_sku` = optional external reference

Rules:
- avoid redundant identifiers
- do not create parallel identity systems
- keep identifiers stable and deterministic

### 5.2 Technical IDs vs business IDs

- database IDs (UUIDs) exist for storage and relations
- business IDs exist for user-facing identity and workflow clarity

Do not confuse the two.

---

## 6. Module boundary rules

### 6.1 No hidden write-through

A module must not:
- compute a value
- silently write it into another module's canonical data

All cross-module effects must be explicit.

### 6.2 Downstream flow only

Preferred direction:

Takeoff → Pricing Sources / Bids → Selections → Estimate → Financials

This aligns with the existing architecture pipeline. fileciteturn52file0

Do not create backward dependencies that blur ownership.

### 6.3 Shared UI ≠ shared ownership

Even if modules share UI components:
- their data models remain distinct
- their ownership remains distinct

---

## 7. Settings module introduction (initial)

### 7.1 Purpose

Provide a centralized place for reusable, governed reference data.

### 7.2 Initial implementation scope

Start with:
- Units of Measure

Do not expand prematurely.

### 7.3 UI expectations

- simple list/table editor
- inline editing acceptable
- strong validation
- minimal friction

### 7.4 Integration rule

Other modules should:
- read from settings
- not recreate the same reference data locally

---

## 8. Current known structural gaps

Based on current repo reality:

- worksheet engine is still a starter implementation
- reference data governance is incomplete (e.g., UOM)
- catalog linkage/import workflow is not yet built
- some modules still mix responsibilities at edges

These are expected and will be addressed after restructuring alignment.

---

## 9. Restructuring execution approach

### 9.1 Do not refactor blindly

Before changing code:
- confirm module classification
- confirm ownership boundaries
- confirm whether change belongs to structure or implementation

### 9.2 Prefer forward alignment over deep rewrites

Where possible:
- align new work with improved structure
- avoid unnecessary destructive rewrites of stable areas

### 9.3 Use controlled passes

Restructuring should happen in passes:
1. naming + classification
2. settings/reference extraction
3. worksheet-family standardization
4. module boundary cleanup

---

## 10. Relationship to existing architecture doc

This document does not replace the main architecture doc.

It refines:
- module grouping
- reference data placement
- worksheet-family structure

The existing architecture still defines:
- end-to-end system flow
- module responsibilities
- invariants and rules

---

## 11. Immediate next use

The next chat should:
- read this document
- read the strategy document
- propose the restructuring map
- confirm before any code changes

No implementation should begin until the restructuring direction is explicitly approved.

---

## 12. Stop condition

Stop restructuring when:
- module boundaries are clear
- reference data placement is defined
- worksheet-family pattern is consistent
- future modules can be built without redefining structure

Then resume normal module execution.
