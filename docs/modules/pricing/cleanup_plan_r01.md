# Pricing Module Cleanup Plan — R01

Status: active cleanup plan
Branch target: `dev`
Purpose: define the pricing-module cleanup sequence so restructuring does not get lost across chat handoffs.

---

## 1. Why this doc exists

The pricing area is now the first real module that should be brought into the new module structure strategy rather than continued in the old pattern.

Shared foundation work is already in place.
That means the next work is no longer generic infrastructure work.
The next work is targeted pricing cleanup.

This doc exists so that if chat context gets large or fragmented, the cleanup sequence is still written in repo and the next session can resume without re-planning from scratch.

---

## 2. Current repo reality

At time of writing, pricing-related structure still has these major issues:

### 2.1 Price Sheets list page is still old-style

`src/app/more/price-sheets/page.tsx`
- large self-contained client page
- owns loading, filtering, create flow, layout, and presentation together
- still repeats local structure instead of inheriting the new module pattern

### 2.2 Price Sheets detail route is thin but depends on an oversized shared component

`src/app/more/price-sheets/[id]/page.tsx`
- thin route wrapper
- delegates nearly everything to a single shared worksheet component

### 2.3 Shared worksheet logic is still too concentrated

`src/components/pricing/PricingWorksheetPage.tsx`
- owns too much worksheet behavior in one file
- mixes shell, header, meta display, row creation, grid editing, mobile rendering, local save state, active cell behavior, and formatting helpers
- is the current structural bottleneck for both Price Sheets and Bids

### 2.4 Pricing domain logic is still too concentrated

`src/lib/pricing-sources.ts`
- owns too many pricing concerns in one file
- mixes lookups, headers, rows, catalog, revisions, and generation helpers
- weakens ownership clarity and makes future expansion riskier

### 2.5 Transitional stitch artifact still exists

`src/components/pricing/PricingWorksheetPage.stitch.ts`
- should be treated as transitional debt
- should not become part of the long-term structure

---

## 3. Cleanup goal

The goal is not a repo-wide rewrite in one shot.

The goal is:
- split the pricing bottlenecks
- bring Price Sheets into the approved module pattern
- establish the shared worksheet-family pricing pattern cleanly
- allow Price Sheets work to continue without deepening structural debt
- give Bids a clean shared pricing pattern to inherit later

This cleanup should preserve current product scope.
It should not turn into a broad redesign of pricing behavior.

---

## 4. What is already done and should not be repeated first

Shared foundation work is already present.
That means the next cleanup should use these files rather than creating more generic groundwork first:

- `src/lib/shared/numbers.ts`
- `src/lib/shared/dates.ts`
- `src/components/layout/PageShell.tsx`
- `src/components/layout/SectionHeader.tsx`
- `src/components/ui/Card.tsx`
- `src/components/feedback/LoadingState.tsx`
- `src/components/feedback/EmptyState.tsx`
- `src/components/feedback/ErrorMessage.tsx`
- `src/components/data-display/StatusPill.tsx`

The cleanup should consume these immediately where they fit.
Do not pause for another generic shared-foundation session unless a true blocker appears.

---

## 5. Cleanup principles for pricing

### 5.1 Do not keep building on the current pricing bottlenecks

Do not continue feature work by making these files larger:
- `src/app/more/price-sheets/page.tsx`
- `src/components/pricing/PricingWorksheetPage.tsx`
- `src/lib/pricing-sources.ts`

### 5.2 Split shared pattern before expanding module behavior

Price Sheets and Bids both depend on the worksheet-family pricing pattern.
That shared pattern should be split first so that future work lands on clean structure instead of the current monolith.

### 5.3 Keep the pass bounded

This is a pricing cleanup pass, not a full repo cleanup pass.
Only touch unrelated global structure if it is required to keep the pricing cleanup clean.

### 5.4 Preserve behavior unless explicitly changing it

Default rule:
- structure changes should preserve current behavior
- do not smuggle feature redesign into the cleanup pass unless explicitly approved

---

## 6. Target structure for the pricing cleanup

### 6.1 Price Sheets module target

```text
src/app/more/price-sheets/
  page.tsx
  actions.ts
  _components/
    PriceSheetsPage.tsx
    PriceSheetsList.tsx
    NewPriceSheetForm.tsx
  _hooks/
    usePriceSheetsPage.ts
  _lib/
    filters.ts
    formOptions.ts
    selectors.ts
  [id]/
    page.tsx
    _components/
      PriceSheetWorksheetPage.tsx
      sections/
        HeaderSection.tsx
        WorksheetSection.tsx
    _hooks/
      usePriceSheetDetail.ts
    _lib/
      formatters.ts
      selectors.ts
```

Notes:
- `page.tsx` files should remain thin
- list/create behavior moves out of the route file
- detail route stays thin but wraps a route-local module component
- route-local formatting and selection logic should not live in global pricing files unless truly shared

### 6.2 Shared pricing pattern target

```text
src/components/patterns/pricing/
  PricingWorksheetPage.tsx
  PricingWorksheetHeader.tsx
  PricingWorksheetGrid.tsx
  PricingWorksheetMetaBar.tsx
  PricingWorksheetNewRowBar.tsx
  PricingWorksheetMobileList.tsx
```

Notes:
- this is the shared worksheet-family pricing pattern
- it should be reused by Price Sheets and later Bids
- it should no longer live under the old `src/components/pricing/` path long-term

### 6.3 Pricing domain target

```text
src/lib/pricing/
  access.ts
  catalog.ts
  headers.ts
  lookups.ts
  revisions.ts
  rows.ts
  types.ts
  worksheet.ts
```

Notes:
- exact naming may adjust slightly if repo reality requires it
- the key rule is that header/row/catalog/revision behavior must stop living in one god file
- `worksheet.ts` should only hold worksheet-specific orchestration that is genuinely shared

---

## 7. Exact slice sequence

This is the cleanup order.
Do not skip ahead unless a strong reason appears.

### Slice 1 — Shared pricing worksheet split

Goal:
- break apart `src/components/pricing/PricingWorksheetPage.tsx`
- establish the shared worksheet-family pricing pattern layer

Scope:
- create `src/components/patterns/pricing/`
- split current worksheet file into shell + subcomponents
- move only the UI/pattern pieces that are genuinely shared
- do not yet perform large module-level route cleanup

Expected result:
- no single giant worksheet UI file remains
- the shared pattern exists in a form that Price Sheets can wrap cleanly

### Slice 2 — Pricing domain split

Goal:
- break apart `src/lib/pricing-sources.ts`
- normalize pricing domain ownership by concern

Scope:
- create `src/lib/pricing/`
- move types out of `pricing-sources-types.ts` into `src/lib/pricing/types.ts`
- split functions by concern: headers, rows, catalog, revisions, lookups, access if needed
- keep temporary compatibility exports only if needed during the transition

Expected result:
- no more pricing domain god file
- file ownership becomes obvious
- later module wrappers do not depend on one huge shared domain file

### Slice 3 — Price Sheets list restructure

Goal:
- bring the list/create route into the module pattern

Scope:
- thin `src/app/more/price-sheets/page.tsx`
- move list/create behavior into `_components/PriceSheetsPage.tsx`
- split list rendering from create form
- move local filter/form option shaping into `_lib`
- use foundation files (`PageShell`, `Card`, `SectionHeader`, `ErrorMessage`, `LoadingState`, `EmptyState`, `StatusPill`)

Expected result:
- Price Sheets list route no longer behaves like an old-style self-contained page
- structure becomes route shell + module-local internals

### Slice 4 — Price Sheets detail restructure

Goal:
- make the detail route module-local rather than a thin wrapper around a giant shared file

Scope:
- keep route entry thin
- add `_components/PriceSheetWorksheetPage.tsx`
- add `sections/HeaderSection.tsx` and `sections/WorksheetSection.tsx`
- move route-local detail behavior into `_hooks` / `_lib` where appropriate
- route-local wrapper composes the shared pricing pattern

Expected result:
- detail route remains thin
- shared pricing pattern is reused cleanly
- module-specific detail behavior is route-local

### Slice 5 — Transitional debt cleanup

Goal:
- remove transition artifacts after replacements are live

Scope:
- delete `src/components/pricing/PricingWorksheetPage.stitch.ts`
- delete or retire old `src/components/pricing/` path once replacement is complete
- delete temporary compatibility shims if no longer needed
- update `docs/design/repo_tree`

Expected result:
- no stale pricing structure remains to confuse future work

### Slice 6 — Resume feature work cleanly

Goal:
- continue Price Sheets work on the cleaned structure

Scope:
- only after slices 1–5 are complete or explicitly bounded
- continue worksheet-family improvements, not before

Expected result:
- Price Sheets is no longer half-built on the old pattern
- future work lands on stable structure

---

## 8. Specific keep / split / move / delete map

### `src/app/more/price-sheets/page.tsx`
- **SPLIT**
- keep as thin route shell only
- move logic into module-local `_components`, `_hooks`, `_lib`

### `src/app/more/price-sheets/[id]/page.tsx`
- **KEEP THIN**
- route should stay small
- but it should wrap a route-local detail component rather than a giant shared file directly

### `src/components/pricing/PricingWorksheetPage.tsx`
- **SPLIT**
- decompose into shared pattern pieces
- move new long-term home to `src/components/patterns/pricing/`

### `src/components/pricing/PricingWorksheetPage.stitch.ts`
- **DELETE AFTER REPLACEMENT**
- transitional artifact only

### `src/lib/pricing-sources.ts`
- **SPLIT**
- move functions into `src/lib/pricing/` by concern

### `src/lib/pricing-sources-types.ts`
- **COMBINE INTO** `src/lib/pricing/types.ts`

### pricing access actions
- likely **KEEP IN PLACE** initially if current location remains appropriate
- only move if module-local or domain-local ownership becomes obviously better during the pass

### generic shared foundation files
- **KEEP AS IS**
- consume them during the module cleanup
- do not redo them first

---

## 9. Out of scope for this cleanup pass

Do not turn this pass into:
- a full Bids rewrite in parallel
- a broad rewrite of unrelated modules
- a repo-wide design-system vanity pass
- SQL/schema redesign unless a real blocker is found
- pricing behavior redesign beyond what structure demands

Bids should inherit the shared pricing pattern **after** Price Sheets and the shared pricing layer are cleaned enough to be stable.

---

## 10. Risks and watchouts

### 10.1 Biggest risk

Trying to continue feature work before the shared pricing worksheet split is done.
That would deepen the wrong structure and create more cleanup later.

### 10.2 Common failure mode

Stopping halfway through the split and leaving:
- old `src/components/pricing/`
- new `src/components/patterns/pricing/`
- old `src/lib/pricing-sources.ts`
- new `src/lib/pricing/`

all active at once for too long.

Transition overlap should be short-lived.

### 10.3 Another risk

Over-abstracting too early.
Only extract shared pattern pieces that are truly shared by Price Sheets and Bids.
Do not build hypothetical abstractions for modules that are not using them yet.

---

## 11. Recommended immediate next action

The next session should start with:

1. fresh repo search
2. confirm current pricing files still match this document
3. plan **Slice 1 only** in exact file terms
4. execute the shared pricing worksheet split
5. hand off before context gets too large

Do not try to complete all slices in one giant session.

---

## 12. Stop condition for this doc

This doc remains active until:
- shared pricing worksheet split is done
- pricing domain split is done
- Price Sheets list/detail follow the module pattern
- transitional pricing cleanup is complete

After that, this doc becomes historical record and the module can continue under normal implementation docs.
