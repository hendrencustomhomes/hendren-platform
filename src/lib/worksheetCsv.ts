// Server-safe CSV utilities for worksheet import.
// No React, no browser APIs. crypto.randomUUID() is available in Node 18+ and browsers.

export const WORKSHEET_CSV_HEADERS = [
  'depth',
  'description',
  'quantity',
  'unit',
  'unit_price',
  'location',
  'notes',
  'row_kind',
] as const

export type WorksheetImportRow = {
  id: string
  estimate_id: string
  job_id: string
  parent_id: string | null
  sort_order: number
  row_kind: 'line_item' | 'assembly' | 'note' | 'allowance'
  description: string
  location: string | null
  quantity: number | null
  unit: string | null
  unit_price: number | null
  notes: string | null
  scope_status: 'included'
  is_upgrade: false
  pricing_type: 'unpriced'
}

// --- CSV parser (minimal RFC-4180 compliant) ---

function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuote = false
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQuote) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') inQuote = false
      else field += ch
    } else {
      if (ch === '"') inQuote = true
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else field += ch
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

const VALID_ROW_KINDS = new Set(['line_item', 'assembly', 'note', 'allowance'])

export function parseImportCsv(
  csvText: string,
  estimateId: string,
  jobId: string,
): { rows: WorksheetImportRow[]; errors: string[] } {
  const parsed = parseCsvText(csvText.trim())

  if (parsed.length < 2) {
    return { rows: [], errors: ['CSV must have a header row and at least one data row.'] }
  }

  // Map header names to column indexes
  const headerRow = parsed[0].map((h) => h.trim().toLowerCase())
  const col: Partial<Record<string, number>> = {}
  for (const h of WORKSHEET_CSV_HEADERS) {
    const idx = headerRow.indexOf(h)
    if (idx >= 0) col[h] = idx
  }

  if (col['description'] === undefined) {
    return { rows: [], errors: ['CSV must contain a "description" column.'] }
  }

  const get = (raw: string[], key: string): string =>
    col[key] !== undefined ? (raw[col[key]!] ?? '').trim() : ''

  const rows: WorksheetImportRow[] = []
  // Track the last row ID inserted at each depth level to reconstruct parent_id
  const parentIdAtDepth: Record<number, string> = {}

  for (let i = 1; i < parsed.length; i++) {
    const raw = parsed[i]
    const description = get(raw, 'description')
    if (!description) continue // skip blank rows silently

    const rawDepth = parseInt(get(raw, 'depth') || '0', 10)
    const depth = Number.isNaN(rawDepth) || rawDepth < 0 ? 0 : Math.min(rawDepth, 8)

    const rawKind = get(raw, 'row_kind')
    const row_kind = (VALID_ROW_KINDS.has(rawKind) ? rawKind : 'line_item') as WorksheetImportRow['row_kind']

    const rawQty = get(raw, 'quantity')
    const quantity = rawQty !== '' ? (parseFloat(rawQty) || null) : null

    const rawPrice = get(raw, 'unit_price')
    const unit_price = rawPrice !== '' ? (parseFloat(rawPrice) || null) : null

    const unit = get(raw, 'unit') || null
    const location = get(raw, 'location') || null
    const notes = get(raw, 'notes') || null

    const id = crypto.randomUUID()
    const parent_id = depth > 0 ? (parentIdAtDepth[depth - 1] ?? null) : null

    parentIdAtDepth[depth] = id
    // Evict deeper levels — stepping out of a subtree resets their parent tracking
    for (const d of Object.keys(parentIdAtDepth).map(Number)) {
      if (d > depth) delete parentIdAtDepth[d]
    }

    rows.push({
      id,
      estimate_id: estimateId,
      job_id: jobId,
      parent_id,
      sort_order: rows.length + 1,
      row_kind,
      description,
      location,
      quantity,
      unit,
      unit_price,
      notes,
      scope_status: 'included',
      is_upgrade: false,
      pricing_type: 'unpriced',
    })
  }

  if (rows.length === 0) {
    return { rows: [], errors: ['No valid rows found. Each row requires a non-empty "description".'] }
  }

  return { rows, errors: [] }
}
