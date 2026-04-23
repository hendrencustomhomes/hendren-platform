# Pricing — Cleanup Plan (R02)

Status: active
Branch: dev

---

## Progress

Completed:
- Slice 1 — worksheet split
- Slice 2 — state + persistence extraction

Current architecture:

EditableDataTable
usePricingWorksheetState
usePricingWorksheetPersistence
PricingWorksheetPage (overloaded)

---

## Slice 3 — Adapter + Page Reduction

### Goal

Complete worksheet centralization.

### Work

- create PricingWorksheetTableAdapter
- create pricingWorksheetColumns
- rewrite PricingWorksheetPage as orchestrator
- remove grid usage

### Critical Rule

Clean cutover only.
No hybrid state.

---

## Architectural Lock

- source-first rows
- catalog deferred
- worksheet primary interface
- shared table behavior
- isolated persistence

---

## Next

- remove legacy grid
- finalize keyboard behavior
- extend to bids
- move to estimate baseline
