# Slice 10 — Import / Export Foundation

**Date:** 2026-05-01
**Branch:** claude/audit-worksheet-stability-nIwtF
**Reference:** design/estimate_system_execution_plan_r02.md, docs/slices/slice_09_worksheet_completion.md

---

## Objective

Add CSV export and CSV import to the Estimate Worksheet.

- **Export:** Client-side only. Reads `localRows` in the orchestrator and generates a CSV download in the browser. No server round-trip. No new API.
- **Import:** Server-side only. Reads CSV text, validates it, creates a **new draft estimate**, and bulk-inserts the parsed rows. Never modifies any existing estimate.

---

## Invariants

| Rule | Enforcement |
|---|---|
| Import always creates a new estimate | `importEstimate` inserts a new `estimates` row; returns `estimateId` |
| Import never touches existing estimates | No UPDATE/DELETE on existing estimates anywhere in the import path |
| Import on error leaves no ghost estimates | On parse or insert failure, the newly created estimate is immediately deleted |
| Export is read-only | Pure client-side; no server calls, no DB writes |
| Draft rows are excluded from export | Rows with `id.startsWith('draft_')` are skipped |

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/worksheetCsv.ts` | New — RFC-4180 CSV parser + `parseImportCsv` |
| `src/app/actions/estimate-actions.ts` | Added `importEstimate` server action |
| `src/components/patterns/estimate/JobWorksheetPageOrchestrator.tsx` | Added Export/Import buttons + inline export helper |

---

## `src/lib/worksheetCsv.ts`

Shared server-safe utilities (no React, no browser APIs).

**`parseCsvText(text)`** — minimal RFC-4180 parser. Handles:
- Quoted fields with embedded commas, double-quote escapes (`""`), and embedded newlines
- `\r\n` and `\r` normalized to `\n`
- Trailing partial row (no trailing newline required)

**`parseImportCsv(csvText, estimateId, jobId)`** — validates and transforms CSV into `WorksheetImportRow[]`:
- Requires a header row with at least a `description` column
- Silently skips blank-description rows
- `depth` column: integer 0–8; invalid values collapse to 0
- `row_kind`: validated against `{ line_item, assembly, note, allowance }`; defaults to `line_item`
- `quantity` / `unit_price`: parsed as float; empty → null; unparseable → null
- `parent_id` reconstructed from `depth` column using a depth-stack (`parentIdAtDepth` map); deeper entries evicted when depth steps back up
- UUIDs pre-generated via `crypto.randomUUID()` so parent_id references are resolvable within the same CSV

---

## `importEstimate` Server Action

```typescript
export async function importEstimate(
  jobId: string,
  csvText: string,
): Promise<{ estimateId: string } | { error: string }>
```

**Steps:**
1. Authenticate user via `requireUser()`
2. INSERT new estimate: `{ job_id: jobId, title: 'Imported Estimate', status: 'draft', created_by: user.id }`
3. `parseImportCsv(csvText, newEstimate.id, jobId)`
4. If parse errors: DELETE the new estimate → return `{ error }`
5. Bulk INSERT all `WorksheetImportRow[]` into `job_worksheet_items`
6. If insert error: DELETE the new estimate → return `{ error }`
7. `revalidateWorksheet(jobId)` → return `{ estimateId: newEstimate.id }`

**Rollback:** The cleanup DELETE on the newly created estimate is a best-effort cleanup. If it fails (e.g., network), the estimate will appear as an empty draft in the selector — the user can archive it. No data is corrupted.

---

## Export — Client-Side Implementation

Inline in `JobWorksheetPageOrchestrator`:

```
CSV header: depth,description,quantity,unit,unit_price,location,notes,row_kind
```

Depth is computed by walking the parent chain in `rowsById` (built from `localRows`), capped at 8 to prevent infinite loops. Draft rows (`id.startsWith('draft_')`) are excluded from the output.

Fields are RFC-4180 escaped: values containing `,`, `"`, or `\n` are wrapped in quotes with internal `"` doubled.

The file is downloaded as `worksheet.csv` via a temporary anchor element and `URL.createObjectURL`.

---

## Import UI Flow

1. User clicks **Import CSV** → hidden `<input type="file" accept=".csv">` is triggered
2. User selects a file; `handleImportFileChange` fires
3. Extension validated client-side (`.csv` only)
4. `FileReader.readAsText` reads file contents
5. `importEstimate(jobId, text)` called inside `useTransition` — non-blocking
6. Button shows "Importing…" while pending
7. Result shown inline for 6 seconds (success or error message), then auto-dismissed

---

## Depth Column Format

The `depth` column encodes hierarchy level:

| depth | meaning |
|---|---|
| 0 | Top-level row (no parent) |
| 1 | Child of the most recent depth-0 row |
| 2 | Child of the most recent depth-1 row |
| … | |

Stepping back up (e.g., depth 2 → depth 0) evicts the deeper parent tracking so the next depth-0 row starts a fresh subtree.

---

## Validation Run

| Stage | Result |
|---|---|
| Compilation (Turbopack) | Pass — 5.6s |
| TypeScript | Pass — 8.9s |
| Static prerender | Pre-existing Supabase env-var failure — unrelated |

---

## Intentionally Not Changed

- No modal or import preview — file picker only
- No column mapping UI — CSV must match the expected header names exactly
- No partial-import progress — all rows inserted in one bulk INSERT or none
- Import does not set the new estimate as active — user must click "Use" in EstimateSelector
- No export format version header — simple flat CSV, easy to edit in Excel/Sheets
