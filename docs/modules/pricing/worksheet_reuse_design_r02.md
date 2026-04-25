# Worksheet Reuse Design — R02

Status: active design/control document
Last updated: 2026-04-22 America/Chicago
Branch target: `dev`
Supersedes: prior worksheet reuse design revisions
Purpose: define the worksheet-reuse design after pricing successfully cut over to the orchestrated worksheet stack, while preserving discipline around what is truly reusable versus what is still pricing-local.

---

## 1. Why this document exists

This document exists because pricing is no longer in the transitional state described by earlier worksheet-reuse revisions.

Pricing has now been cut over live to the orchestrated worksheet stack and the branch is green.
That means this document must stand on its own as the current design/control source for worksheet reuse.

---

## 2. Current worksheet-reuse truth

### 2.1 What is now proven

The repo now has a working live worksheet stack in pricing that includes:

- shared UI primitive via `EditableDataTable`
- pricing adapter layer
- pricing state layer
- pricing persistence layer
- thin orchestrated composition layer
- live wrapper routing through the orchestrated stack

### 2.2 What is still not proven

```text
shared worksheet primitive exists
pricing is now the active reference implementation
shared multi-module worksheet reuse is not yet proven
```

---

## 3. Pricing → Estimate Integration (NEW)

### Identity separation

```text
catalog_sku = item identity
source_sku = pricing option
```

These must never be merged.

### Estimate behavior

```text
Estimate starts from catalog
Source is resolved from pricing sources
Estimate stores snapshots (no silent mutation)
```

### Pricing modes

```text
unit
lump_sum
allowance
```

Worksheet must support all three.

### Package support

```text
One estimate line may cover many catalog items
```

Covered items track scope, not required pricing.

### Zero rule

```text
All pricing fields:
0 → NULL
```

---

## 4. Directive

- Pricing remains reference implementation
- Estimate will be next adopter
- Do not generalize prematurely
- Extract only proven shared behavior
