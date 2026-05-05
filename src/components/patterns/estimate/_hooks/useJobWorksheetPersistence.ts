'use client'

import {
  persistWorksheetRow,
  createWorksheetRow,
  restoreWorksheetRows,
  deleteWorksheetRow,
  persistWorksheetSortOrders,
} from '@/app/actions/worksheet-item-actions'
import type { JobWorksheetRow, JobWorksheetRowKind } from '../JobWorksheetTableAdapter'

export type UpdateJobWorksheetRowPatch = {
  description: string
  location: string | null
  quantity: number | string | null
  unit: string | null
  notes: string | null
  unit_cost_manual: number | null
  unit_cost_override: number | null
  unit_cost_is_overridden: boolean
  pricing_source_row_id?: string | null
  pricing_header_id?: string | null
}

export type CreateJobWorksheetRowInput = {
  estimate_id: string
  job_id: string
  parent_id: string | null
  sort_order: number
  row_kind: JobWorksheetRowKind
  description: string
  location: string | null
  quantity: number | string | null
  unit: string | null
  unit_cost_manual: number | null
  unit_cost_source: number | null
  unit_cost_override: number | null
  unit_cost_is_overridden: boolean
  notes: string | null
  scope_status: 'included'
  is_upgrade: false
  pricing_type: 'unpriced'
}

export type WorksheetSortOrderUpdate = {
  id: string
  sort_order: number
}

export function useJobWorksheetPersistence(estimateId: string) {
  async function persistRow(rowId: string, patch: UpdateJobWorksheetRowPatch) {
    const result = await persistWorksheetRow(estimateId, rowId, patch)
    if ('error' in result) throw new Error(result.error)
    return result
  }

  async function createRow(input: CreateJobWorksheetRowInput) {
    const result = await createWorksheetRow(input)
    if ('error' in result) throw new Error(result.error)
    return result
  }

  async function restoreRows(rows: JobWorksheetRow[]) {
    const result = await restoreWorksheetRows(estimateId, rows)
    if ('error' in result) throw new Error(result.error)
    return result
  }

  async function deleteRow(rowId: string) {
    const result = await deleteWorksheetRow(estimateId, rowId)
    if ('error' in result) throw new Error(result.error)
  }

  async function persistSortOrders(updates: WorksheetSortOrderUpdate[]) {
    const result = await persistWorksheetSortOrders(estimateId, updates)
    if ('error' in result) throw new Error(result.error)
  }

  return { persistRow, createRow, restoreRows, deleteRow, persistSortOrders }
}
