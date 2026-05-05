# Takeoff V1.1 — Execution Anchor (R01)

## Purpose

This doc anchors the next takeoff execution pass to current repo reality.

Takeoff is **not** greenfield anymore.
The repo already has:
- a live `TakeoffTab`
- job-level takeoff wiring
- managed `trades` lookup
- managed `cost_codes` lookup
- structured upstream scope capture

The next pass is an **upgrade to an estimator-usable workspace**, not a full takeoff build from scratch.

## Current Repo Reality

Existing takeoff behavior in repo:
- add takeoff item
- edit takeoff item
- managed trade lookup
- managed cost code lookup
- quantity and unit entry
- notes entry
- refresh persistence

Current limitations:
- stacked record cards instead of a working grid
- no desktop/mobile renderer split
- no searchable selects
- no keyboard-first workflow
- no filtering or grouped review
- no costing surface in UI
- no scope context bridge inside takeoff

## Locked Rules

- one route, adaptive UI by breakpoint
- desktop = fuller working view
- mobile = concise contextual view
- no separate mobile/desktop URLs
- required managed lookup fields must use real live lookup data
- do not weaken required managed lookup fields into free-text fallback
- 16px+ input/select/textarea sizing on mobile

## Package A Scope

Package A is the foundation pass.

It should do two things:
1. reconcile the real takeoff field surface against live schema
2. replace the current stacked-card takeoff surface with a responsive working surface

Package A should **not** build:
- estimate logic
- proposal logic
- selections generation
- procurement generation
- import/template logic
- broad automation

## Target Workspace Shape

### Desktop
- compact table/grid feel
- faster review and editing
- row-oriented workflow

### Mobile
- concise row list
- contextual editing
- only field-necessary data visible by default

## Immediate Checks Before UI Rewrite

Confirm live `takeoff_items` support for:
- `unit_cost`
- `extended_cost`
- any other already-live cost columns

Confirm whether `extended_cost` should be:
- UI-derived
- DB-derived
- or both with DB as source of truth

## Stop Condition For Package A

Package A is done when:
- takeoff field truth is reconciled with live schema
- the takeoff tab becomes a responsive working surface
- repo still uses one route and one source of truth
- no downstream module drift has been introduced
