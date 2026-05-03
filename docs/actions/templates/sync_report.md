# Actions GPT Template — Sync Report

Use this template at the start of every fresh Actions GPT session after reading:

1. `docs/actions/START_HERE.md`
2. `docs/actions/current.md`
3. only the active read-list named in `current.md`

---

## Sync Report

```markdown
# Sync Report — [DATE]

Branch target: `dev`
Session scope: [ONE-SENTENCE SCOPE]

---

## 1. Files read

Required Actions files:
- `docs/actions/START_HERE.md`
- `docs/actions/current.md`

Active read-list files:
- `[FILE]`
- `[FILE]`

Additional files read for verification:
- `[FILE]`

---

## 2. Current state

- Active execution track:
- Last completed slice:
- Current module/system:
- Verified source-of-truth doc:

---

## 3. Repo reality check

Verified in code/docs:

- [ ] Branch target is `dev`
- [ ] Active files exist
- [ ] Current docs match code
- [ ] No obvious stale-doc conflict blocks this session

Findings:
- 
- 

---

## 4. Conflicts / stale docs

Known conflicts found during sync:

| Conflict | Impact | Action |
|---|---|---|
|  |  |  |

If none:

`No blocking doc/code conflicts found during sync.`

---

## 5. Recommended next 1–3 slices

1. **[Slice name]** — [bounded objective]
2. **[Slice name]** — [bounded objective]
3. **[Slice name]** — [bounded objective]

---

## 6. Stop conditions

Stop this session if:

- docs and code disagree in a way that changes implementation direction
- scope expands beyond 1–3 slices
- DB/schema work becomes necessary but was not explicitly in scope
- build/log errors point outside the active slice

---

## 7. What NOT to touch

- [MODULE / FILE / AREA]
- [MODULE / FILE / AREA]

---

## 8. Proposed immediate action

[ONE CLEAR NEXT ACTION]
```

---

## Notes for Actions GPT

A sync report should be short, concrete, and tied to repo evidence.

Do not use sync as a planning essay.
Do not read the entire repo unless the task explicitly requires a broad audit.
Do not proceed to implementation until the current state and next slice are clear.
