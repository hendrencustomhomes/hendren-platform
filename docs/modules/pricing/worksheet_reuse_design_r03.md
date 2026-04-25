# Worksheet Reuse Design — R03

Status: active design/control document
Last updated: 2026-04-25 America/Chicago
Branch target: `dev`
Supersedes: `docs/modules/pricing/worksheet_reuse_design_r02.md`
Purpose: define worksheet reuse and pricing-type behavior before Estimate becomes the second worksheet adopter.

---

## 1. Why this document exists

Pricing is the active worksheet reference implementation. R03 adds the locked pricing-type behavior needed before Estimate can safely consume Pricing Sources.

Do not mutate older revision files. Future changes to this document must create a new revision file.

---

## 2. Current worksheet-reuse truth

### 2.1 What is now proven

The repo has a working live worksheet stack in pricing that includes:

- shared UI primitive via `EditableDataTable`
- shared worksheet interaction/virtualization hooks
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

## 3. Pricing → Estimate Integration

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

---

## 4. Pricing modes

Pricing Sources support:

```text
unit
lump_sum
allowance
```

The row field is `pricing_type`.

---

## 5. Pricing mode behavior

### 5.1 Unit

Unit pricing is normal quantity-based pricing.

```text
estimate_total = quantity × unit_price
proposal_display = quantity, unit, unit_price, and line total when proposal design calls for detail
```

### 5.2 Lump sum

Lump sum pricing is a package/total amount. It should not require fake quantity precision.

```text
estimate_total = unit_price
quantity = optional/null
unit = optional/null
proposal_display = lump sum amount or package label, depending on proposal design
```

Do not force `quantity = 1` simply to make math work.

### 5.3 Allowance

Allowance pricing has two different meanings depending on consumer.

For estimate math, allowance behaves like unit pricing:

```text
estimate_total = quantity × unit_price
```

For proposal allowance breakdown, allowance displays as a budget rate, not a calculated client-facing total:

```text
proposal_allowance_display = quantity + unit + allowance rate
proposal_allowance_display does not show calculated line total
proposal_allowance_display does not show summed quantity total
```

Example:

```text
Kitchen backsplash tile allowance
quantity = 100
unit = sqft
unit_price = 10
estimate_total = 100 × 10 = 1000
proposal allowance breakdown = 100 sqft at $10/sqft allowance
```

The proposal grand total still includes the estimate total. The allowance breakdown is explanatory/client-facing detail and must not double-total the allowance line.

---

## 6. Package support

```text
One estimate line may cover many catalog items
```

Covered items track scope, not required pricing. Package lines may cover multiple catalog items and do not require item-level pricing.

---

## 7. Zero rule

```text
All pricing fields:
0 → NULL
```

This remains especially important for `unit_price`; do not store $0 as a real price.

---

## 8. Directive

- Pricing remains reference implementation.
- Estimate will be next adopter only after pricing-type behavior is wired and verified.
- Do not generalize prematurely.
- Extract only proven shared behavior.
- Do not mutate older revision files; create a new revision file for future design updates.
