import { SupabaseClient } from '@supabase/supabase-js'

export type JobFile = {
  id: string
  category: string
  filename: string
  display_name: string
  storage_path: string
  size_bytes: number
  mime_type: string
  client_visible: boolean
  created_at: string
  uploaded_by: string
}

export type CompanyCompliance = {
  has_coi_gl: boolean
  coi_gl_expired: boolean
  has_coi_wc: boolean
  coi_wc_expired: boolean
  has_w9: boolean
  has_general_contract: boolean
  is_compliant: boolean
}

export type JobDetailIssue = {
  id: string
  severity: string
  resolved: boolean
}

export type ScheduleRiskLevel = 'none' | 'soon' | 'overdue'
export type OrderRiskLevel = 'none' | 'soon' | 'overdue'

export type JobSubSchedule = {
  id: string
  status: string
  start_date: string | null
  end_date: string | null
  trade: string
  sub_name: string | null
  notes: string | null

  // New schedule execution fields
  cost_code: string | null
  is_released: boolean | null
  release_date: string | null
  notification_window_days: number | null

  // Schedule engine fields
  confirmed_date?: string | null
  duration_working_days?: number | null
  buffer_working_days: number
  include_saturday: boolean
  include_sunday: boolean
  is_locked: boolean
}

export type ProcurementItem = {
  id: string
  status: string
  order_by_date: string | null
  required_on_site_date: string | null
  description: string
  trade: string
  vendor: string | null
  lead_days: number | null

  // New planning / dependency fields
  cost_code: string | null
  procurement_group: string | null
  linked_schedule_id: string | null
  is_client_supplied: boolean | null
  is_sub_supplied: boolean | null
  requires_tracking: boolean | null
  buffer_working_days: number
}

export type JobWithDetails = Record<string, unknown> & {
  profiles: { full_name: string } | null
  issues: JobDetailIssue[]
  sub_schedule: JobSubSchedule[]
  procurement_items: ProcurementItem[]
}

export type ScheduleItemDependency = {
  id: string
  job_id: string
  predecessor_type: 'schedule' | 'procurement'
  predecessor_id: string
  successor_type: 'schedule' | 'procurement'
  successor_id: string
  reference_point: 'start' | 'end'
  offset_working_days: number
  created_at: string
  updated_at: string
}

export type CompanyType = 'sub' | 'vendor' | 'both'

export type CompanyRow = {
  id: string
  name: string
  type: 'sub' | 'vendor' | 'both'
  email: string | null
  phone: string | null
  is_active: boolean
  coi_gl_expires: string | null
  coi_wc_expires: string | null
  w9_received_at: string | null
  general_contract_signed_at: string | null
  created_at: string | null
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000
  )
}

export function getScheduleRiskLevel(
  sub: Pick<JobSubSchedule, 'start_date' | 'status' | 'is_released' | 'notification_window_days'>
): ScheduleRiskLevel {
  if (!sub.start_date) return 'none'
  if (sub.status === 'complete' || sub.status === 'cancelled') return 'none'
  if (sub.status === 'on_site' || sub.status === 'confirmed') return 'none'

  const today = new Date().toISOString().slice(0, 10)
  const days = daysBetween(today, sub.start_date)
  const releaseWindow = sub.notification_window_days ?? 14

  // Still internal/draft and getting close
  if (!sub.is_released) {
    if (days < 0) return 'overdue'
    if (days <= releaseWindow) return 'soon'
    return 'none'
  }

  // Released but not yet confirmed
  if (sub.status !== 'confirmed') {
    if (days < 0) return 'overdue'
    if (days <= 7) return 'soon'
    return 'none'
  }

  return 'none'
}

export function getOrderRiskLevel(
  item: Pick<ProcurementItem, 'order_by_date' | 'status' | 'requires_tracking'>
): OrderRiskLevel {
  if (item.requires_tracking === false) return 'none'
  if (!item.order_by_date) return 'none'
  if (item.status !== 'Pending') return 'none'

  const today = new Date().toISOString().slice(0, 10)
  const days = daysBetween(today, item.order_by_date)

  if (days < 0) return 'overdue'
  if (days <= 7) return 'soon'
  return 'none'
}

export async function getJobFiles(
  supabase: SupabaseClient,
  jobId: string
): Promise<JobFile[]> {
  const { data, error } = await supabase.rpc('get_job_files', {
    p_job_id: jobId,
  })

  if (error) throw error
  return (data ?? []) as JobFile[]
}

export async function getCompanyCompliance(
  supabase: SupabaseClient,
  companyId: string
): Promise<CompanyCompliance> {
  const { data, error } = await supabase.rpc('get_company_compliance', {
    p_company_id: companyId,
  })

  if (error || !data) {
    throw error ?? new Error('Company compliance not found')
  }

  return data as CompanyCompliance
}

export async function getJobWithDetails(
  supabase: SupabaseClient,
  jobId: string
): Promise<JobWithDetails> {
  const { data, error } = await supabase
    .from('jobs')
    .select(
      `
      *,
      profiles!jobs_pm_id_fkey(full_name),
      issues(id,severity,resolved),
      sub_schedule(
        id,
        status,
        start_date,
        end_date,
        trade,
        sub_name,
        notes,
        cost_code,
        is_released,
        release_date,
        notification_window_days,
        duration_working_days,
        buffer_working_days,
        include_saturday,
        include_sunday,
        is_locked
      ),
      procurement_items(
        id,
        status,
        order_by_date,
        required_on_site_date,
        description,
        trade,
        vendor,
        lead_days,
        cost_code,
        procurement_group,
        linked_schedule_id,
        is_client_supplied,
        is_sub_supplied,
        requires_tracking,
        buffer_working_days
      )
    `
    )
    .eq('id', jobId)
    .single()

  if (error || !data) throw error ?? new Error('Job not found')
  return data as JobWithDetails
}

export async function getScheduleDependencies(
  supabase: SupabaseClient,
  jobId: string
): Promise<ScheduleItemDependency[]> {
  const { data, error } = await supabase
    .from('schedule_item_dependencies')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as ScheduleItemDependency[]
}

export async function getCompanies(
  supabase: SupabaseClient,
  type?: CompanyType
): Promise<CompanyRow[]> {
  const query = supabase
    .from('companies')
    .select(
      `
      id,
      name,
      type,
      email,
      phone,
      is_active,
      coi_gl_expires,
      coi_wc_expires,
      w9_received_at,
      general_contract_signed_at,
      created_at
    `
    )
    .order('name')

  if (type && type !== 'both') {
    query.eq('type', type)
  }

  const { data, error } = await query

  if (error) throw error
  return (data ?? []) as CompanyRow[]
}