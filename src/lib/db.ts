import { SupabaseClient } from '@supabase/supabase-js';

export type JobFile = {
  id: string;
  category: string;
  filename: string;
  display_name: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string;
  client_visible: boolean;
  created_at: string;
  uploaded_by: string;
};

export type CompanyCompliance = {
  has_coi_gl: boolean;
  coi_gl_expired: boolean;
  has_coi_wc: boolean;
  coi_wc_expired: boolean;
  has_w9: boolean;
  has_general_contract: boolean;
  is_compliant: boolean;
};

export type JobDetailIssue = {
  id: string;
  severity: string;
  resolved: boolean;
};

export type JobSubSchedule = {
  id: string;
  status: string;
  start_date: string;
  trade: string;
  sub_name: string;
};

export type ProcurementItem = {
  id: string;
  status: string;
  order_by_date: string | null;
  description: string;
  trade: string;
};

export type JobWithDetails = Record<string, unknown> & {
  profiles: { full_name: string } | null;
  issues: JobDetailIssue[];
  sub_schedule: JobSubSchedule[];
  procurement_items: ProcurementItem[];
};

export type CompanyType = 'sub' | 'vendor' | 'both';

export type CompanyRow = {
  id: string;
  name: string;
  type: 'sub' | 'vendor';
  email: string | null;
  phone: string | null;
  is_active: boolean;
  coi_gl_expires: string | null;
  coi_wc_expires: string | null;
  w9_received_at: string | null;
  general_contract_signed_at: string | null;
};

export async function getJobFiles(
  supabase: SupabaseClient, 
  jobId: string,
): Promise<JobFile[]> {
  const { data, error } = await supabase.rpc(
    'get_job_files',
    { p_job_id: jobId },
  );
  if (error) throw error;
  return (data ?? []) as JobFile[];
}

export async function getCompanyCompliance(
  supabase: SupabaseClient,
  companyId: string,
): Promise<CompanyCompliance> {
  const { data, error } = await supabase.rpc(
    'get_company_compliance',
    { p_company_id: companyId },
  );
  if (error || !data) throw error ?? new Error('Company compliance not found');
  return data as CompanyCompliance;
}

export async function getJobWithDetails(
  supabase: SupabaseClient,
  jobId: string,
): Promise<JobWithDetails> {
  const { data, error } = await supabase
    .from('jobs')
    .select(
      '*, profiles!jobs_pm_id_fkey(full_name), issues(id,severity,resolved), sub_schedule(id,status,start_date,trade,sub_name), procurement_items(id,status,order_by_date,description,trade)',
    )
    .eq('id', jobId)
    .single();
  if (error || !data) throw error ?? new Error('Job not found');
  return data as JobWithDetails;
}

export async function getCompanies(
  supabase: SupabaseClient,
  type?: CompanyType,
): Promise<CompanyRow[]> {
  const query = supabase
    .from('companies')
    .select(
      'id,name,type,email,phone,is_active,coi_gl_expires,coi_wc_expires,w9_received_at,general_contract_signed_at',
    )
    .order('name');

  if (type && type !== 'both') {
    query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CompanyRow[];
}
