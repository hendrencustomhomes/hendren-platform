# Hendren Platform — Execution

## 1. Purpose

This document is the execution, strategy, toolbelt, prompt, checklist, QA, and handoff source of truth for the Hendren Platform.

It defines:
- how work is performed
- which tool is used for which kind of task
- how sessions start
- how repo reality is refreshed
- how slices are chosen
- how modules are designed before build
- how prompts are written
- how QA is performed
- how handoffs stay lean without losing truth

This file exists to prevent:
- regressions
- repeated planning
- stale assumptions
- bloated prompts
- scope drift
- fake completion
- handoffs that are either too vague or too long

## 2. Maintenance Rule

This file is one of only two permanent memory docs:
- `hendren_platform_architecture.md`
- `hendren_platform_execution.md`

Rules:
- only one active copy of this file should exist in project memory
- when this file is updated, replace it in full
- delete old copies rather than keeping revisions in memory
- read this file at the beginning of every new chat before planning or execution
- rewrite this file when execution rules or workflow meaningfully change
- do not let random handoff text become a shadow strategy doc

These two docs are the permanent source of truth.
Handoffs are temporary and lean.

## 3. Core Operating Standard

Primary standard:

**Efficient and accurate beats fast and sloppy.**

Corollaries:
- regression is inefficient
- repeated planning is inefficient
- fake completion is inaccurate
- polish before truth is inefficient
- broad prompts that force guessing are inefficient
- hidden assumptions are inaccurate

Do not call a pass complete until it survives real use for its defined slice.

## 4. Fixed Operating Model / Toolbelt

### 4.1 ChatGPT
Use first whenever possible for:
- planning
- architecture
- scope definition
- repo inspection
- fresh repo search
- code review
- audits
- QA reasoning
- new-file repo writes when connector workflow supports it
- stitching together current truth across repo + memory docs

### 4.2 GitHub connector / repo search
For any task involving existing code, perform a fresh repo search first.

Use repo search for:
- current target files
- current route/module state
- table names / helper names / permission patterns
- recent repo reality relevant to the task
- recent commits/PRs/issues if relevant

Do not rely on memory or handoff alone for current code truth.

### 4.3 Claude Code
Use only when terminal / repo surgery is genuinely required.

Examples:
- existing-file overwrite problems
- multi-file stitch/swap
- large-file patching when connector overwrite surfaces are unreliable
- terminal commands
- surgical repo operations

Claude Code is an executor, not a planner.

### 4.4 Claude Chat
Use only for live DB / SQL work.

Examples:
- running SQL manually
- validating live schema
- checking actual table shape
- DB troubleshooting in the live environment

Do not mix repo work and SQL work in one Claude prompt.

### 4.5 Manual mode
Use only for:
- short deterministic command blocks
- small direct paste operations
- situations where tool friction is lower than orchestration overhead

### 4.6 Persistent memory rule
Long-term truth lives only in:
- `hendren_platform_architecture.md`
- `hendren_platform_execution.md`

Do not create extra permanent memory docs unless a future change makes that unavoidable.

## 5. Branch / Environment Rules

- work on `dev`
- never target `main` unless explicitly intended
- do not push directly to `main` during active development
- protect against accidental main changes
- do not assume staging is the normal SQL test path
- treat production changes as deliberate promotion, not casual experimentation

Repo write reality:
- direct new-file writes may work
- existing-file overwrite/delete may be unreliable through connector surfaces
- adjacent-file + stitch/swap is a valid fallback
- large existing-file patching may require Claude Code or a deterministic low-level fallback rather than blind full-file overwrite through the connector
- when using a fallback, keep it deterministic and surgical

## 6. Session Start Protocol

Every new chat or resumed work session should follow this order:

1. read `hendren_platform_architecture.md`
2. read `hendren_platform_execution.md`
3. identify the active user request or active module
4. perform a fresh repo search before making implementation claims
5. reconcile repo reality against the two memory docs
6. identify:
   - what is already true in code
   - what is target direction only
   - what is unresolved
7. define the next bounded slice
8. only then draft implementation or prompts

Do not begin by assuming the last chat’s memory of repo state is still correct.

## 7. Fresh Repo Search Rule

Before proposing changes to existing code, always search the repo fresh.

At minimum, search:
- target route/module name
- likely file paths
- relevant table names / helper names
- existing permission / action / query patterns
- recent implementation status for the active area

For broader work, also search:
- adjacent modules
- shared libs/helpers
- recent commits if they may affect the area
- permission-related helpers if access is involved

Goals of the fresh repo search:
- avoid stale assumptions
- avoid duplicate work
- avoid contradicting current code
- avoid giving prompts against nonexistent files or outdated table shapes
- catch drift before it becomes regression

If repo reality conflicts with the memory docs:
- trust repo reality for current implementation facts
- trust the memory docs for intended direction
- explicitly call out the difference
- do not silently blend them

## 8. Planning Before Execution

For any non-trivial change:
- plan first
- code second

Before execution, define:
- the exact output desired
- the exact current state
- the upstream dependency
- the downstream effect
- the stop condition

If the change cannot be described clearly, the slice is still too big.

## 9. Slice Selection Rules

### 9.1 Default slice size
Choose the narrowest correct usable slice.

A slice is done enough when it has:
- data model
- core relationships
- minimal create/view/update
- no major downstream blocker

A slice is not done because it is:
- pretty
- fully featured
- highly optimized
- theoretically complete

### 9.2 Stop rules
Stop when:
- the defined usable slice is real
- the next step becomes a different logical change
- the task starts touching multiple modules
- prerequisites are missing
- a “quick extra tweak” starts expanding scope

### 9.3 Takeoff exception
Takeoff may go deeper before stopping because it is backbone architecture, not a side module.

### 9.4 Hard no-scope-drift rule
Do not expand a task because a neighboring cleanup is tempting.

## 10. Pre-Build Declaration Rule

No new module or major expansion is ready to build until these are declared:

1. source of truth
2. upstream dependencies
3. downstream systems affected
4. module boundaries
5. managed lookups
6. minimum V1 data shape
7. desktop default view
8. mobile default view
9. UI pattern type
10. save model
11. permissions / enforcement expectation
12. stop condition

If these are not defined, the build is not ready.

## 11. Module Build System

Use this for every new module or major module expansion.

### 11.1 Module identity
Define:
- module name
- module type: tabular / form-detail / hybrid
- primary owner/user
- primary job phase
- why the module exists
- what real work it supports
- what downstream problem it prevents or enables

### 11.2 Source-of-truth definition
Define:
- primary source of truth
- upstream dependencies
- downstream systems affected
- what the module is not allowed to define

This must match the architecture file.

### 11.3 Managed reference data check
For every field, classify it:
- managed lookup
- derived
- user-entered
- computed
- DB-owned

For each managed lookup, verify:
- real table name
- actual live columns
- actual query conditions
- rows truly exist

Rules:
- required managed fields must use real live data
- do not weaken a managed field into free text just to unblock a pass
- do not assume generic columns like `name`, `code`, or `is_active`
- verify live schema before enforcing dropdown/select behavior

### 11.4 Minimum data shape
Define:
- required in V1
- allowed later
- must not be added in this pass

Only add fields necessary for:
- identifying the record
- performing the work
- preserving downstream usefulness

Do not add “might be useful later” fields.

### 11.5 Create / View / Update definition
Before coding, state:
- what minimum record can be created
- by whom
- with what required fields
- what must be visible by default
- what can be edited in V1
- what is intentionally not editable yet
- whether delete/archive/deactivate exists now, later, or not needed

## 12. Responsive UI Rule

Use:
- one route
- one data model
- one set of actions
- different renderers by breakpoint when needed

Do not create separate mobile and desktop URLs by default.

Desktop should be the full working view.
Mobile should be the concise contextual view.

Mobile is not a shrunken desktop UI.

## 13. Desktop / Mobile Standards

### 13.1 Desktop default
Desktop should prefer:
- denser layouts
- more visible columns
- spreadsheet/grid behavior where appropriate
- keyboard-first interaction for tabular modules

### 13.2 Mobile default
Mobile should prefer:
- fewer visible fields by default
- only the information necessary for field use
- expanded detail only when needed
- larger touch targets
- no browser auto-zoom issues

### 13.3 Mobile input rule
- input/select/textarea text should be 16px or larger
- compactness should come from layout and density, not tiny text

### 13.4 Mobile visibility test
Ask:
- what is this row?
- what do I need to do right now?
- what minimum context is required to do it correctly?

If a field does not help answer one of those:
- hide it by default on mobile
- show it in expanded detail
- or reserve it for desktop

## 14. UI Pattern Rule

Choose one pattern intentionally:

### Pattern A — Grid-first tabular editor
Use when:
- many records
- repeated entry
- scan/compare matters
- speed matters

### Pattern B — Form/detail editor
Use when:
- record depth matters more than row volume
- setup/config is primary
- records are fewer and richer

### Pattern C — Hybrid
Use only when clearly justified.

Tabular module rule:
naturally row/column operational modules should default toward grid-first editing.

Do not let naturally tabular modules drift into stacked card editors as the long-term default.

### 14.1 Worksheet-family direction
For worksheet-family modules such as Pricing Sources / Bids, Takeoff, Estimate, and Catalog workspaces where appropriate:
- keep one logical worksheet record
- desktop should trend toward spreadsheet-like interaction
- mobile may use a simplified contextual renderer
- do not paginate a worksheet business object just to manage UI density
- paginate/search/filter list surfaces and large lookup surfaces instead
- use virtualization/windowing for large worksheets

## 15. Breakpoint Behavior Rule

Before building a module, define:

### Mobile
- what renderer shows
- what actions are allowed
- what is hidden

### Tablet
- what renderer shows
- what compromises are made

### Desktop
- what renderer shows
- what working density is expected

## 16. Save Behavior Rule

Before UI build, define:
- immediate cell save / row save / form save / mixed
- whether persistence occurs on blur / button / enter-tab / row action
- what fields are DB-owned and must never be written directly by UI

Never casually write DB-owned fields from the client.

### 16.1 Worksheet-family save rule
For worksheet-family modules:
- user movement must stay local and fast
- network persistence must not block navigation
- do not require waiting for one cell save before entering the next cell
- prefer local draft state plus background persistence over direct blur-to-network coupling

### 16.2 Worksheet-family persistence rule
Default target model:
- active cell state
- local draft state
- committed value snapshot
- dirty tracking
- row-level coalesced save queue
- background flush
- save status indicator

Preferred behavior:
- typing is always local first
- navigation commits locally first
- save queue coalesces by row
- repeated edits before flush should collapse into the latest row payload
- save status should be visible but lightweight
- inactive rows/cells should avoid heavy interactive rendering when possible

### 16.3 Worksheet-family keyboard contract
Default desktop contract for worksheet-family modules:
- focus selects/highlights the full editable cell text
- `Tab` moves right
- `Shift+Tab` moves left
- `Enter` moves down in the same column
- `Shift+Enter` moves up in the same column
- `Esc` abandons active-cell draft changes and restores the last committed value
- `Ctrl+Z` / `Cmd+Z` undoes the last committed worksheet edit in-session
- `Ctrl+Enter` creates a new item/row where that module’s flow defines “new item”
- do not overload plain `Enter` at the bottom row to create a new item by default

### 16.4 Worksheet-family scale rule
Assume the platform must safely handle:
- common sheets under ~50 rows
- larger operational sheets around 500+ rows
- especially large catalog-style datasets beyond that

Rules:
- do not use hard row caps plus fake page 2/page 3 worksheet splitting
- use virtualization/windowing for large sheets
- use server-side search/filter/paging for catalog/list surfaces
- keep one logical worksheet record even when the renderer windows it

## 17. Derivation / Automation Boundary

For each module, explicitly state:

Derived now:
- [items]

Manual now:
- [items]

Explicitly deferred:
- [items]

Rules:
- do not quietly introduce automation because it “seems convenient”
- deterministic linked structure beats hidden magic
- if automation could create destructive ambiguity, defer it until rules are explicit

## 18. Risk / Validation Check

For each major pass, ask:
- what is the most likely data-drift failure?
- what is the most likely lookup failure?
- what is the most likely mobile usability failure?
- what is the most likely downstream linkage failure?

Then define:
- one validation to catch each early
- one thing not to build yet to avoid drift

Additional worksheet-family risks to check:
- lag from whole-grid rerenders
- lag from duplicate blur/save behavior
- lag from one-request-per-cell coupling
- crash/soft-freeze from mounting too many live inputs
- undo/revert bugs around draft vs committed state

## 19. Execution Mode Decision

Before implementation, choose:

### Surgical edits only if:
- the change is tiny
- risk is low
- it is under a couple of safe edits

### Full-file replacement if:
- mobile/manual editing friction is high
- file drift is already happening
- the change touches multiple related parts
- previous patch churn has already created rework

### Claude Code / repo-surgery fallback if:
- connector overwrite on a large existing file is unreliable
- the risk of blind connector rewrite is high
- the change is a deterministic stitch/swap that terminal/repo tooling can perform more safely

If complexity rises, switch early rather than forcing a brittle connector edit.

## 20. Prompt Rules

### 20.1 General rule
Prompts should be:
- curated
- minimal
- precise
- task-specific

Do not send broad philosophy, long history, or irrelevant context to the executor.

### 20.2 Claude Code prompt standard
Every Claude Code prompt should contain only:
1. start instruction
2. task
3. required context
4. constraints + push target

Default start:
`Pull/rebase from dev.`

Default end:
`Push only to dev.`

Default constraints:
- do not expand scope
- do not refactor unrelated code
- do not modify unrelated files

Default size target:
- one logical change
- one module only
- one small slice only

Allowed typical task types:
1. add field
2. add table
3. add relationship
4. add minimal UI
5. make one small targeted adjustment inside an existing module

If a prompt starts needing multiple major changes, split it.

### Standard minimal Claude Code template

```text
Pull/rebase from dev.

Task: [one specific task]

Context:
- [only critical facts needed]
- [one or two real constraints/invariants if needed]

Files:
- [target files]

Do:
- [explicit step]
- [explicit step]

Do not:
- expand scope
- refactor unrelated code
- modify unrelated files

Push only to dev.
```

### 20.3 Claude Chat / SQL prompt standard
Use only for live DB / SQL work.

Prompt should include:
- environment target
- exact SQL task
- known live schema facts
- risk warning if destructive
- whether the output should be raw SQL only

Do not include repo/file tasks.

### Standard minimal Claude Chat template

```text
Target: live DB SQL only.

Task: [one exact SQL task]

Known facts:
- [live table/schema fact]
- [one important invariant or risk]

Do:
- write only the SQL needed for this task
- keep it scoped to this change

Do not:
- include repo/file instructions
- redesign adjacent schema
- add unrelated cleanup
```

### 20.4 When to add context
Add extra context only if the executor could reasonably guess wrong without it.

Examples:
- existing schema pattern
- FK relationship
- naming rule
- permission invariant
- managed lookup rule
- DB-owned field rule
- interaction model that must be preserved

### 20.5 When to stop and re-scope
Split the task if:
- multiple modules are involved
- prerequisites are missing
- the instructions start getting long
- the change cannot be described clearly in a few bullets

## 21. QA Completion Gates

A pass is not complete until these are answered:

### Build
- deploy/build passes

### Create
- minimum valid record can be created

### View
- record appears correctly after refresh

### Update
- intended V1 fields can be edited

### Lookup
- required managed dropdowns load real live data

### Persistence
- refresh keeps data

### Mobile
- no browser zoom on fields
- default view is concise and usable

### Desktop
- working view supports intended operational flow

### Permissions / Enforcement
- route access is correct
- UI visibility is correct
- server actions / writes are protected
- view/manage/assign semantics hold up
- restricted users do not regain access after refresh or state changes

For worksheet-family passes, also confirm:
- keyboard contract holds up
- save queue/background save does not block navigation
- scale behavior is acceptable at large row counts
- active-cell/draft/undo behavior does not corrupt data

If any of these fail, the pass is not complete.

## 22. Database / Migration Workflow

Safe SQL path:

1. write migration in repo when repo migration truth is still part of the chosen workflow
2. push to `dev`
3. apply using the currently approved SQL workflow for the active environment
4. validate in the active environment
5. later promote to production

Rules:
- do not assume staging is the normal SQL test path
- random dashboard SQL is not the normal workflow
- do not treat drafted SQL as live truth until it is actually applied and validated
- keep repo schema truth aligned with live schema reality
- if SQL execution workflow changes for the active period, state that explicitly in the session/handoff rather than assuming an older path still applies

## 23. Handoff Strategy

### 23.1 Core handoff principle
Handoffs should be lean because the two memory docs are the permanent source of truth.

A handoff is not the place to restate the whole platform.

A handoff should preserve:
- active task
- current repo-aligned status
- current blockers
- exact next step
- anything discovered in the session that the next chat would not safely infer

### 23.2 Before writing a handoff
At the end of a session, do this first:

1. confirm whether architecture changed
2. confirm whether execution rules changed
3. if yes, update the appropriate memory doc first
4. perform a quick fresh repo search of the touched area
5. verify the active module and actual current state
6. only then write the handoff

Do not write handoffs from memory alone.

### 23.3 What a handoff must include
A good lean handoff includes:
- active module
- exact task completed
- exact task still open
- key repo facts discovered this session
- files/routes/tables actually touched or searched when relevant
- blockers, errors, or risks still present
- next recommended step
- opening instruction for the next chat:
  - read architecture doc
  - read execution doc
  - perform fresh repo search before assuming continuity

### 23.4 What a handoff should not include
Do not bloat handoffs with:
- full platform architecture
- full roadmap
- old decisions already captured in the memory docs
- repeated workflow philosophy
- generic filler

If it is stable source-of-truth content, it belongs in one of the two memory docs, not the handoff.

### 23.5 When to suggest a handoff
Suggest a handoff when:
- the chat is getting long enough that continuity risk is rising
- the session has crossed multiple modules
- repo/state facts are starting to fragment
- the next step should start fresh from docs + repo search

### 23.6 Lean handoff template

```text
🔁 HENDREN PLATFORM — HANDOFF

Read these first:
- hendren_platform_architecture.md
- hendren_platform_execution.md

Then perform a fresh repo search on the active area before making any plan or code changes.

Branch/environment rule:
- work on dev only unless explicitly told otherwise

Active module:
- [module]

What was completed:
- [item]
- [item]

Current repo-aligned reality:
- [fact]
- [fact]

Still open / current blocker:
- [item]

Files / routes / tables searched or touched:
- [item]
- [item]

Next recommended step:
- [one exact next step]

Notes:
- [only anything the next chat could not safely infer from docs + repo search]
```

## 24. End-of-Session Close Checklist

Before ending a session, confirm:

1. did architecture meaningfully change?
2. did execution rules meaningfully change?
3. if yes, were the docs rewritten first?
4. was the active area searched fresh in the repo?
5. is the current state grounded in repo reality rather than memory?
6. is the next step narrow and clear?
7. does the handoff stay lean because stable truth already lives in the two docs?

## 25. Final Rule

Use this system every session:

- read the two source-of-truth docs
- refresh reality with a fresh repo search
- choose one bounded slice
- execute with the right tool
- validate against QA gates
- update the docs only if stable truth changed
- write a lean handoff that points back to the docs and requires a fresh repo search next time

That is the anti-regression system.
