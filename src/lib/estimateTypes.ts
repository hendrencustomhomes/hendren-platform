// Estimate lifecycle statuses.
// Editable:      draft, active
// Recoverable:   archived (restores to draft)
// Terminal/locked: staged, sent, signed, rejected, voided
export type EstimateStatus =
  | 'draft'     // editable option
  | 'active'    // selected editable working estimate
  | 'staged'    // locked for management review/send
  | 'sent'      // proposal sent; permanently locked
  | 'signed'    // client accepted; permanently locked
  | 'rejected'  // rejected; permanently locked; may duplicate manually
  | 'voided'    // canceled; permanently locked; may duplicate manually
  | 'archived'  // hidden/recoverable; only draft/active may be archived

export type Estimate = {
  id: string
  job_id: string
  title: string
  status: EstimateStatus
  is_change_order: boolean
  parent_estimate_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  locked_at: string | null
  locked_by: string | null
}

export const ESTIMATE_SELECT =
  'id, job_id, title, status, is_change_order, parent_estimate_id, created_by, created_at, updated_at, locked_at, locked_by'

// Single source of truth for estimate mutability.
// Only draft and active estimates are editable, and only when not locked.
export function isEstimateEditable(estimate: Pick<Estimate, 'status' | 'locked_at'>): boolean {
  return (estimate.status === 'draft' || estimate.status === 'active') && !estimate.locked_at
}

// Statuses that may NOT be archived. Only draft and active are archivable.
export const NON_ARCHIVABLE_STATUSES: EstimateStatus[] = [
  'staged', 'sent', 'signed', 'rejected', 'voided',
]
