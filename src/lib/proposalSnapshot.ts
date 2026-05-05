// Types for immutable proposal document snapshots stored in proposal_documents.
//
// AUDIT-ARTIFACT CONTRACT
// snapshot_json is a write-once, point-in-time record. Once inserted into
// proposal_documents it is never updated. No app or server action may read
// snapshot_json back to resolve estimate status, scope, or pricing — those
// always come from estimates and job_worksheet_items.
// The only valid reader of snapshot_json is a display-only document page
// (e.g., /proposal/documents/[documentId]) that renders the historical record
// to a user. All other reads are a contract violation.

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
