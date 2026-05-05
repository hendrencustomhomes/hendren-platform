# Hendren Platform — Module Design Strategy (R02)

Status: active planning strategy (updated)
Branch target: `dev`
Purpose: extend R01 with worksheet-family standardization and layering rules.

---

## Key Addition — Worksheet Standardization

Worksheet-family modules must follow a unified interaction and architectural model.

### Required Characteristics

- spreadsheet-like navigation
- local-first editing
- background persistence
- keyboard-first UX
- high-density data interaction

---

## Worksheet Layering Model

```text
[ Shared UI Layer ]
EditableDataTable

[ Module Adapter Layer ]
<Module>WorksheetTableAdapter

[ Module State Layer ]
use<Module>WorksheetState

[ Module Persistence Layer ]
use<Module>WorksheetPersistence
```

### Ownership Rules

Shared layer owns:
- layout
- navigation
- focus/edit model
- selection behavior

Adapter owns:
- column definitions
- formatting
- mapping between domain and table

State owns:
- draft state
- dirty tracking
- undo
- autosave queue

Persistence owns:
- DB operations
- create/update logic
- access control

---

## Pricing → Estimate Direction (Added)

Worksheet-family modules now extend beyond Pricing into Estimate.

```text
Catalog → Price Sheets / Bids → Estimate
```

Rules:

- pricing modules define source data
- estimate consumes pricing data
- worksheet UI must remain generic
- pricing and estimate logic must NOT move into shared UI layer

---

## Pricing Resolution Model (New — REQUIRED)

Worksheet rows may exist in one of the following states:

- **Manual** (no pricing link)
- **Linked (live)** — values resolve from pricing source
- **Linked (overridden)** — source retained, but one or more fields overridden
- **Detached** (optional) — previously linked, now independent

### Source of Truth Rules

For each pricing field (starting with unit cost):

```text
IF overridden → use override
ELSE IF linked → use pricing source
ELSE → use manual value
```

These rules must be enforced in a centralized resolver, not spread across UI.

### Link Behavior Rules

- Linking is **live by default** — source changes propagate
- Overrides do **not break the link**
- Overrides are tracked per-field (not per-row)
- Source changes must never silently overwrite overrides

### Change Handling

When pricing source changes:
- linked rows update automatically if not overridden
- overridden rows retain override but must surface mismatch

### UI Principles

- Minimal UI: icons over text where intuitive
- No persistent badges for normal states
- Surface detail on hover/click only

State indicators:
- linked → chain icon
- overridden → chain + pencil
- source changed → subtle dot indicator
- detached → broken chain

### Architectural Rules

- Resolution logic lives in module state layer (not UI)
- Shared UI must not contain pricing logic
- Adapter maps resolved values to table display
- Persistence stores both source reference and override metadata

### Data Model Direction

Prefer explicit columns over JSON for V1:

- source reference (pricing row id)
- base/source value
- override value
- override flag

This ensures:
- queryability
- debuggability
- constraint enforcement

---

## Pricing Source Rules (Added)

- `catalog_sku` = identity
- `source_sku` = pricing option
- estimate must preserve both
- pricing rows require quantity and UOM
- $0 values are invalid → stored as NULL

---

## Interaction Contract (Required Direction)

- Enter / Shift+Enter → vertical navigation
- Tab / Shift+Tab → horizontal navigation
- Ctrl+Enter → create row
- Esc → abandon changes
- Arrow keys → context-aware navigation vs cursor movement

---

## Create Row Rule

Create-row UI may be shared.

But:
- data shape
- defaults
- validation
- persistence

must remain module-local.

---

## Anti-Patterns (New)

- worksheet god component
- duplicated table engines across modules
- shared table owning business logic
- hybrid state systems

---

## Directive

All worksheet-family modules must converge to this model.

Pricing is the proving ground.
Estimate is the next adopter after pricing stability is confirmed.
