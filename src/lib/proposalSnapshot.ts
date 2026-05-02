// Types for immutable proposal document snapshots stored in proposal_documents.

export type ProposalSnapshotItem = {
  id: string
  depth: number
  description: string
  quantity: number | string | null
  unit: string | null
  unit_price: number | string | null
  row_kind: string
  line_total: number
}

export type ProposalSnapshotSection = {
  id: string
  title: string
  subtotal: number
  items: ProposalSnapshotItem[]
}

export type ProposalSnapshotJson = {
  version: 1
  captured_at: string       // ISO 8601 timestamp
  proposal_status: string   // proposal_structures.proposal_status at capture time
  job_name: string
  estimate_title: string
  grand_total: number
  sections: ProposalSnapshotSection[]
}

export type ProposalDocStatus = 'draft_snapshot' | 'sent' | 'signed' | 'voided'

export type ProposalDocumentRecord = {
  id: string
  job_id: string
  estimate_id: string
  doc_status: ProposalDocStatus
  title: string
  snapshot_json: ProposalSnapshotJson
  created_by: string | null
  created_at: string
  voided_at: string | null
  superseded_by_id: string | null
}
