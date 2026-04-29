'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { WorksheetActiveCell, WorksheetCellDraftValue, WorksheetRowSaveState } from '@/components/data-display/worksheet/worksheetTypes'
import { parseNumber } from '@/lib/shared/numbers'
import type { JobWorksheetEditableCellKey, JobWorksheetRow } from '../JobWorksheetTableAdapter'
import type { CreateJobWorksheetRowInput, UpdateJobWorksheetRowPatch, WorksheetSortOrderUpdate } from './useJobWorksheetPersistence'

const ALLOWED_UNITS = ['flat','ea','sqft','lnft','cuft']

// ...unchanged helpers omitted for brevity...

function applyEditableCellValue(
  row: JobWorksheetRow,
  field: JobWorksheetEditableCellKey,
  draftValue: WorksheetCellDraftValue
): JobWorksheetRow {
  switch (field) {
    case 'description': {
      const next = String(draftValue ?? '').trim()
      return next ? { ...row, description: next } : row
    }
    case 'location':
      return { ...row, location: String(draftValue ?? '') || null }
    case 'quantity':
      return { ...row, quantity: parseNumber(String(draftValue ?? '')) ?? 1 }
    case 'unit': {
      const val = String(draftValue ?? '')
      return { ...row, unit: ALLOWED_UNITS.includes(val) ? val : row.unit }
    }
    case 'unit_price':
      return { ...row, unit_price: parseNumber(String(draftValue ?? '')) }
    case 'notes':
      return { ...row, notes: String(draftValue ?? '') || null }
  }
}

function buildPatch(row: JobWorksheetRow): UpdateJobWorksheetRowPatch {
  return {
    description: row.description,
    location: row.location,
    quantity: row.quantity,
    unit: row.unit,
    unit_price: row.unit_price,
    notes: row.notes,
  }
}

function buildCreateInput(jobId: string, row: JobWorksheetRow): CreateJobWorksheetRowInput {
  return {
    job_id: jobId,
    parent_id: row.parent_id,
    sort_order: row.sort_order,
    row_kind: row.row_kind,
    description: row.description,
    location: row.location,
    quantity: row.quantity ?? 1,
    unit: row.unit ?? 'ea',
    unit_price: row.unit_price,
    notes: row.notes,
    scope_status: 'included',
    is_upgrade: false,
    pricing_type: 'unpriced',
  }
}

function createDraftRow(jobId: string, sourceRow: JobWorksheetRow | null, asChild: boolean): JobWorksheetRow {
  return {
    id: `draft_${Date.now()}`,
    parent_id: asChild ? sourceRow?.id ?? null : sourceRow?.parent_id ?? null,
    sort_order: 0,
    row_kind: 'line_item',
    description: '',
    location: null,
    notes: null,
    scope_status: 'included',
    is_upgrade: false,
    replaces_item_id: null,
    quantity: 1,
    unit: 'ea',
    pricing_source_row_id: null,
    pricing_header_id: null,
    catalog_sku: null,
    source_sku: null,
    unit_price: null,
    total_price: null,
    pricing_type: 'unpriced',
  }
}

// rest unchanged
