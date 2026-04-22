import type {
  CreatePricingHeaderInput,
  DbClient,
  ListPricingHeadersFilters,
  PricingHeader,
  UpdatePricingHeaderPatch,
} from './types'

const PRICING_HEADER_COLS =
  'id, kind, job_id, company_id, trade_id, cost_code_id, title, revision, status, effective_date, received_at, supersedes_header_id, notes, is_active, created_at, updated_at'

async function derivePricingHeaderTitle(
  supabase: DbClient,
  input: CreatePricingHeaderInput
): Promise<string> {
  const [companyResult, tradeResult, costCodeResult, jobResult] = await Promise.all([
    supabase
      .from('companies')
      .select('company_name, name')
      .eq('id', input.company_id)
      .single(),
    supabase.from('trades').select('name').eq('id', input.trade_id).single(),
    supabase
      .from('cost_codes')
      .select('cost_code, title')
      .eq('id', input.cost_code_id)
      .single(),
    input.kind === 'bid' && input.job_id
      ? supabase
          .from('jobs')
          .select('job_name, project_address')
          .eq('id', input.job_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (companyResult.error) throw companyResult.error
  if (tradeResult.error) throw tradeResult.error
  if (costCodeResult.error) throw costCodeResult.error
  if (jobResult && 'error' in jobResult && jobResult.error) throw jobResult.error

  const companyLabel = String(
    companyResult.data.company_name ?? companyResult.data.name ?? 'Company'
  ).trim()
  const tradeLabel = String(tradeResult.data.name ?? 'Trade').trim()
  const costCodeLabel = String(costCodeResult.data.cost_code ?? 'Cost Code').trim()

  if (input.kind === 'bid') {
    const jobLabel = String(
      jobResult && 'data' in jobResult
        ? jobResult.data?.job_name ?? jobResult.data?.project_address ?? 'Job'
        : 'Job'
    ).trim()
    return `${jobLabel} - ${companyLabel} - ${tradeLabel} - ${costCodeLabel}`
  }

  return `${companyLabel} - ${tradeLabel} - ${costCodeLabel}`
}

export async function listPricingHeaders(
  supabase: DbClient,
  filters: ListPricingHeadersFilters = {}
): Promise<PricingHeader[]> {
  let query = supabase.from('pricing_headers').select(PRICING_HEADER_COLS)

  if (filters.kind) query = query.eq('kind', filters.kind)
  if (filters.job_id) query = query.eq('job_id', filters.job_id)
  if (filters.company_id) query = query.eq('company_id', filters.company_id)
  if (filters.trade_id) query = query.eq('trade_id', filters.trade_id)
  if (filters.cost_code_id) query = query.eq('cost_code_id', filters.cost_code_id)
  if (typeof filters.is_active === 'boolean') query = query.eq('is_active', filters.is_active)

  query = query.order('updated_at', { ascending: false }).order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as PricingHeader[]
}

export async function getPricingHeader(
  supabase: DbClient,
  id: string
): Promise<PricingHeader | null> {
  const { data, error } = await supabase
    .from('pricing_headers')
    .select(PRICING_HEADER_COLS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return (data as PricingHeader | null) ?? null
}

export async function createPricingHeader(
  supabase: DbClient,
  input: CreatePricingHeaderInput
): Promise<PricingHeader> {
  if (input.kind === 'bid' && !input.job_id) {
    throw new Error('job_id is required when kind is bid')
  }
  if (input.kind === 'price_sheet' && input.job_id) {
    throw new Error('job_id must be null when kind is price_sheet')
  }

  const title = input.title?.trim() || (await derivePricingHeaderTitle(supabase, input))

  const { data, error } = await supabase
    .from('pricing_headers')
    .insert({
      kind: input.kind,
      job_id: input.kind === 'bid' ? input.job_id ?? null : null,
      company_id: input.company_id,
      trade_id: input.trade_id,
      cost_code_id: input.cost_code_id,
      title,
      status: input.status,
      effective_date: input.effective_date ?? null,
      received_at: input.received_at ?? null,
      notes: input.notes?.trim() || null,
      is_active: input.is_active ?? true,
    })
    .select(PRICING_HEADER_COLS)
    .single()

  if (error) throw error
  return data as PricingHeader
}

export async function updatePricingHeader(
  supabase: DbClient,
  id: string,
  patch: UpdatePricingHeaderPatch
): Promise<PricingHeader> {
  const payload = {
    ...patch,
    title: typeof patch.title === 'string' ? patch.title.trim() : patch.title,
    notes: typeof patch.notes === 'string' ? patch.notes.trim() || null : patch.notes,
  }

  const { data, error } = await supabase
    .from('pricing_headers')
    .update(payload)
    .eq('id', id)
    .select(PRICING_HEADER_COLS)
    .single()

  if (error) throw error
  return data as PricingHeader
}
