import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Company = {
  id: string
  company_name: string
  is_vendor: boolean
  is_subcontractor: boolean
  is_service_company: boolean
  primary_address: string | null
  billing_same_as_primary: boolean
  billing_address: string | null
  phone: string | null
  email: string | null
  is_active: boolean
  created_at: string | null
}

export type CompanyContact = {
  id: string
  company_id: string
  full_name: string
  title: string | null
  phone: string | null
  email: string | null
  created_at: string | null
}

export type CompanyComplianceDocument = {
  id: string
  company_id: string
  doc_type: 'coi_gl' | 'coi_wc' | 'w9' | 'general_contract'
  expires_at: string | null
  created_at: string | null
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export function companyTypeTags(
  c: Pick<Company, 'is_subcontractor' | 'is_vendor' | 'is_service_company'>
): string[] {
  const tags: string[] = []
  if (c.is_subcontractor) tags.push('Sub')
  if (c.is_vendor) tags.push('Vendor')
  if (c.is_service_company) tags.push('Service')
  return tags
}

export const DOC_TYPE_LABELS: Record<CompanyComplianceDocument['doc_type'], string> = {
  coi_gl: 'GL COI',
  coi_wc: 'WC COI',
  w9: 'W9',
  general_contract: 'General Contract',
}

/** Returns 'ok' | 'expiring' | 'expired' | 'missing' */
export function complianceDocStatus(
  doc: CompanyComplianceDocument | undefined
): 'ok' | 'expiring' | 'expired' | 'missing' {
  if (!doc) return 'missing'
  if (!doc.expires_at) return 'ok' // W9 / general contract — no expiry required
  const today = new Date().toISOString().slice(0, 10)
  const daysUntil = Math.round(
    (new Date(doc.expires_at).getTime() - new Date(today).getTime()) / 86400000
  )
  if (daysUntil < 0) return 'expired'
  if (daysUntil <= 14) return 'expiring'
  return 'ok'
}

// ─── Query helpers ────────────────────────────────────────────────────────────

const COMPANY_COLS = `
  id,
  company_name,
  is_vendor,
  is_subcontractor,
  is_service_company,
  primary_address,
  billing_same_as_primary,
  billing_address,
  phone,
  email,
  is_active,
  created_at
`

export async function getCompanies(supabase: SupabaseClient): Promise<Company[]> {
  const { data, error } = await supabase
    .from('companies')
    .select(COMPANY_COLS)
    .order('company_name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Company[]
}

export async function getCompany(
  supabase: SupabaseClient,
  id: string
): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .select(COMPANY_COLS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Company | null
}

export async function createCompany(
  supabase: SupabaseClient,
  payload: Omit<Company, 'id' | 'created_at'>
): Promise<string> {
  // Include legacy `name` column (NOT NULL, no default) to satisfy the old schema
  // while the app has migrated to company_name.
  const insertPayload = { ...payload, name: payload.company_name ?? '' }
  const { data, error } = await supabase
    .from('companies')
    .insert(insertPayload)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

export async function updateCompany(
  supabase: SupabaseClient,
  id: string,
  payload: Partial<Omit<Company, 'id' | 'created_at'>>
): Promise<void> {
  const { error } = await supabase.from('companies').update(payload).eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function getCompanyContacts(
  supabase: SupabaseClient,
  companyId: string
): Promise<CompanyContact[]> {
  const { data, error } = await supabase
    .from('company_contacts')
    .select('id, company_id, full_name, title, phone, email, created_at')
    .eq('company_id', companyId)
    .order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as CompanyContact[]
}

export async function createCompanyContact(
  supabase: SupabaseClient,
  payload: Omit<CompanyContact, 'id' | 'created_at'>
): Promise<void> {
  const { error } = await supabase.from('company_contacts').insert(payload)
  if (error) throw new Error(error.message)
}

export async function updateCompanyContact(
  supabase: SupabaseClient,
  id: string,
  payload: Partial<Omit<CompanyContact, 'id' | 'company_id' | 'created_at'>>
): Promise<void> {
  const { error } = await supabase.from('company_contacts').update(payload).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteCompanyContact(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from('company_contacts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Trade assignments ────────────────────────────────────────────────────────

export async function getCompanyTradeIds(
  supabase: SupabaseClient,
  companyId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('company_trade_assignments')
    .select('trade_id')
    .eq('company_id', companyId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: { trade_id: string }) => r.trade_id)
}

export async function setCompanyTrades(
  supabase: SupabaseClient,
  companyId: string,
  tradeIds: string[]
): Promise<void> {
  const { error: delError } = await supabase
    .from('company_trade_assignments')
    .delete()
    .eq('company_id', companyId)
  if (delError) throw new Error(delError.message)

  if (tradeIds.length === 0) return

  const rows = tradeIds.map((trade_id) => ({ company_id: companyId, trade_id }))
  const { error: insError } = await supabase
    .from('company_trade_assignments')
    .insert(rows)
  if (insError) throw new Error(insError.message)
}

// ─── Compliance documents ─────────────────────────────────────────────────────

export async function getCompanyComplianceDocs(
  supabase: SupabaseClient,
  companyId: string
): Promise<CompanyComplianceDocument[]> {
  const { data, error } = await supabase
    .from('company_compliance_documents')
    .select('id, company_id, doc_type, expires_at, created_at')
    .eq('company_id', companyId)
    .order('doc_type')
  if (error) throw new Error(error.message)
  return (data ?? []) as CompanyComplianceDocument[]
}
