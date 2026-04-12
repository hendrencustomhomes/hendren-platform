import type { SupabaseClient } from '@supabase/supabase-js'
import type { LinkedLog, LogOwnerType, LogType } from './types'

export async function createLinkedLog(
  supabase: SupabaseClient,
  input: {
    ownerType: LogOwnerType
    ownerId: string
    jobId: string | null
    logType: LogType | null
    note: string | null
    createdBy: string | null
  }
): Promise<LinkedLog> {
  const { data, error } = await supabase
    .from('linked_logs')
    .insert({
      owner_type: input.ownerType,
      owner_id: input.ownerId,
      job_id: input.jobId,
      log_type: input.logType,
      note: input.note,
      created_by: input.createdBy,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as LinkedLog
}

export async function getLogsForOwner(
  supabase: SupabaseClient,
  ownerType: LogOwnerType,
  ownerId: string
): Promise<LinkedLog[]> {
  const { data, error } = await supabase
    .from('linked_logs')
    .select('*')
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as LinkedLog[]
}