// Worksheet-lifecycle statuses (extends legacy estimate_status enum in DB)
export type EstimateStatus = 'draft' | 'active' | 'approved' | 'archived'

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
