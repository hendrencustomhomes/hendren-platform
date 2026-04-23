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

Pricing is the proving ground for this architecture.
