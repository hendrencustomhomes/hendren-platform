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
}
