# ESTIMATE SYSTEM EXECUTION PLAN — r02

**Date:** 2026-05-01  
**Status:** LOCKED (REVISED)  
**Supersedes:** r01

---

## 1. Overview

This document refines r01 and reconciles it with overall platform architecture.

This plan intentionally **replaces the prior Takeoff/Summary structure** with a
unified Estimate Worksheet model.

---

## 2. Core Architecture (Revised)

Job
 ├── Estimate (versioned internal worksheet system)
 │     └── Worksheet (scope + quantity + cost source resolution)
 │
 ├── Proposal (presentation layer)
 │     ├── Summary
 │     ├── Builder
 │     ├── Preview
 │     └── PDF
 │
 ├── Financials (downstream; NOT replaced)
 │
 └── Documents / Files

### Clarifications

- Estimate Worksheet = unified replacement for Takeoff + Estimate
- Proposal Summary replaces Scope UI (NOT global Summary concept)
- Financials remain downstream of Estimate (not replaced)
- Documents store generated outputs (PDFs, exports)

---

## 3. Estimate System (Corrected Definition)

Estimate is NOT global truth. It is:

> The internal worksheet system that defines scope, quantity, and resolved cost.

It does NOT replace:
- Selections
- Bids
- Price Sheets
- Financials

---

## 4. Change Order Context (Added)

Estimates must support context:

- Base Estimate
- Change Order Estimate
- Alternate (future)

Rules:
- Multiple estimates per job
- Proposal may represent base or CO/addendum
- Do NOT duplicate job infrastructure

---

## 5. Cost Code Rule (Critical)

Cost codes must:
- be sourced from QuickBooks
- not be free text
- not create independent truth inside Hendren

---

## 6. Import / Export Safety (Added)

- Import = seed only
- Creates new estimate
- No linkage to original file
- No sync back to template

---

## 7. Documents / Files Boundary (Added)

- Proposal PDF → Document
- Estimate export (CSV/XLSX) → export artifact
- Import file → File
- Parsed data → Estimate rows

---

## 8. Permissions Requirement (Added)

Every slice must include:
- route protection
- server-side enforcement
- role-based access
- prevent exposure of internal pricing externally

---

## 9. Execution Sequence (Unchanged but clarified)

06 — Estimate entity
07 — Bind worksheet
08 — Remove Scope/Takeoff UI
09 — Worksheet completion
10 — Import/export
11 — Proposal summary
12 — Builder
13 — Preview
14 — PDF
15–18 — Pricing integrations
19–20 — polish

---

## 10. System Flow (Reaffirmed)

Price Sheets / Bids → Selections → Estimate → Proposal → Financials

---

## 11. Critical Corrections vs r01

- Clarified Estimate scope (not global truth)
- Reintroduced Financials boundary
- Added Change Order context
- Added QB cost code constraint
- Added Documents/Files separation
- Added permissions requirement
- Clarified import safety model

---

## 12. Handoff Rule (unchanged)

Reference this document in all future work until superseded.
