export type LogOwnerType =
  | 'schedule_item'
  | 'task'
  | 'job'
  | 'manual'

export type LogType =
  | 'call_log'
  | 'qc'
  | 'schedule_change'
  | 'note'
  | 'other'

export type LinkedLog = {
  id: string
  owner_type: LogOwnerType
  owner_id: string
  job_id: string | null
  log_type: LogType | null
  note: string | null
  created_by: string | null
  created_at: string
}