'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getCurrentPricingAccess } from '@/app/actions/pricing-access-actions'
import { requireModuleAccess } from '@/lib/access-control-server'
import { isEstimateEditable } from '@/lib/estimateTypes'
import type { JobWorksheetRow } from '@/components/patterns/estimate/JobWorksheetTableAdapter'
import type { PricingHeader, PricingRow } from '@/lib/pricing/types'

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  return { supabase, user }
}

function revalidateWorksheet(jobId: string) {
  revalidatePath(`/jobs/${jobId}/worksheet`)
}

const PRICING_HEADER_COLS =
  'id, kind, title, is_active, company_id, trade_id, cost_code_id, job_id, revision, status, effective_date, received_at, supersedes_header_id, notes, created_at, updated_at'

const PRICING_ROW_COLS =
  'id, pricing_header_id, catalog_sku, cost_code_id, source_sku, vendor_sku, description_snapshot, pricing_type, quantity, unit, unit_price, lead_days, notes, sort_order, is_active, created_at, updated_at'

const WORKSHEET_COST_COLS =
  'id, job_id, pricing_source_row_id, unit_cost_manual, unit_cost_source, unit_cost_override, unit_cost_is_overridden'

// Returns active pricing headers the current user can see for the given job.
// Price sheets are global; bids are scoped to the current job only.
export async function getAvailablePricingHeaders(
  jobId: string,
): Promise<{ headers: PricingHeader[] } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const [priceSheetAccess, bidsAccess] = await Promise.all([
    getCurrentPricingAccess('pricing_sources'),
    getCurrentPricingAccess('bids'),
  ])

  const canViewPriceSheets = !priceSheetAccess.error && priceSheetAccess.canView
  const canViewBids = !bidsAccess.error && bidsAccess.canView

  if (!canViewPriceSheets && !canViewBids) {
    return { headers: [] }
  }

  const [priceSheetResult, bidsResult] = await Promise.all([
    canViewPriceSheets
      ? auth.supabase
          .from('pricing_headers')
          .select(PRICING_HEADER_COLS)
          .eq('is_active', true)
          .eq('kind', 'price_sheet')
          .order('title')
      : Promise.resolve({ data: [] as any[], error: null }),
    canViewBids
      ? auth.supabase
          .from('pricing_headers')
          .select(PRICING_HEADER_COLS)
          .eq('is_active', true)
          .eq('kind', 'bid')
          .eq('job_id', jobId)
          .order('title')
      : Promise.resolve({ data: [] as any[], error: null }),
  ])

  if (priceSheetResult.error) return { error: priceSheetResult.error.message }
  if (bidsResult.error) return { error: bidsResult.error.message }

  const headers = [
    ...(priceSheetResult.data ?? []),
    ...(bidsResult.data ?? []),
  ] as PricingHeader[]

  return { headers }
}

// Returns active pricing rows for the given header, enforcing kind-specific
// permission and bid-to-job scope.
export async function getAvailablePricingRows(
  headerId: string,
  jobId: string,
): Promise<{ rows: PricingRow[] } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const { data: header, error: headerError } = await auth.supabase
    .from('pricing_headers')
    .select('id, kind, job_id, is_active')
    .eq('id', headerId)
    .eq('is_active', true)
    .single()

  if (headerError || !header) {
    return { error: headerError?.message ?? 'Pricing source not found or not active' }
  }

  if ((header as any).kind === 'bid' && (header as any).job_id !== jobId) {
    return { error: 'Bid pricing source does not belong to this job' }
  }

  const access = await getCurrentPricingAccess(
    (header as any).kind === 'bid' ? 'bids' : 'pricing_sources',
  )
  if (access.error || !access.canView) {
    return { error: 'Access denied to this pricing source' }
  }

  const { data, error } = await auth.supabase
    .from('pricing_rows')
    .select(PRICING_ROW_COLS)
    .eq('pricing_header_id', headerId)
    .eq('is_active', true)
    .order('sort_order')

  if (error) return { error: error.message }
  return { rows: (data ?? []) as PricingRow[] }
}

export async function linkRowToPricing(
  rowId: string,
  estimateId: string,
  pricingRowId: string,
  jobId: string,
): Promise<{ row: JobWorksheetRow } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  // Round 1: fetch pricing row, worksheet item, and estimate status in parallel
  const [
    { data: pricingRow, error: pricingError },
    { data: worksheetItem, error: itemError },
    { data: estimate, error: estimateError },
  ] = await Promise.all([
    auth.supabase
      .from('pricing_rows')
      .select('id, pricing_header_id, unit_price, unit, catalog_sku, source_sku')
      .eq('id', pricingRowId)
      .eq('is_active', true)
      .single(),
    auth.supabase
      .from('job_worksheet_items')
      .select('unit, job_id, unit_cost_manual')
      .eq('id', rowId)
      .eq('estimate_id', estimateId)
      .single(),
    auth.supabase
      .from('estimates')
      .select('status, locked_at')
      .eq('id', estimateId)
      .single(),
  ])

  if (pricingError || !pricingRow) {
    return { error: pricingError?.message ?? 'Pricing row not found or not active' }
  }
  if (itemError || !worksheetItem) {
    return { error: itemError?.message ?? 'Worksheet item not found' }
  }
  if (estimateError || !estimate) {
    return { error: estimateError?.message ?? 'Estimate not found' }
  }
  if (!isEstimateEditable(estimate)) {
    return { error: 'Estimate is locked and cannot be modified' }
  }

  // Verify worksheet item belongs to this job
  if ((worksheetItem as any).job_id !== jobId) {
    return { error: 'Worksheet item does not belong to this job' }
  }

  // Round 2: fetch pricing header + check permissions in parallel
  const [
    { data: pricingHeader, error: headerError },
    priceSheetAccess,
    bidsAccess,
  ] = await Promise.all([
    auth.supabase
      .from('pricing_headers')
      .select('id, kind, job_id, is_active')
      .eq('id', (pricingRow as any).pricing_header_id)
      .eq('is_active', true)
      .single(),
    getCurrentPricingAccess('pricing_sources'),
    getCurrentPricingAccess('bids'),
  ])

  if (headerError || !pricingHeader) {
    return { error: headerError?.message ?? 'Pricing source not found or not active' }
  }

  const header = pricingHeader as any

  // Bid headers must belong to the current job
  if (header.kind === 'bid' && header.job_id !== jobId) {
    return { error: 'Bid pricing source does not belong to this job' }
  }

  // Require canManage for the relevant pricing source kind
  const access = header.kind === 'bid' ? bidsAccess : priceSheetAccess
  if (access.error || !access.canManage) {
    return { error: 'Access denied: cannot link to this pricing source' }
  }

  // COALESCE: use source unit if present, otherwise keep existing
  const coalescedUnit = (pricingRow as any).unit ?? (worksheetItem as any).unit

  const { data: updated, error: updateError } = await auth.supabase
    .from('job_worksheet_items')
    .update({
      pricing_source_row_id: pricingRowId,
      pricing_header_id: (pricingRow as any).pricing_header_id,
      unit_cost_source: (pricingRow as any).unit_price,
      unit_cost_override: null,
      unit_cost_is_overridden: false,
      unit: coalescedUnit,
      catalog_sku: (pricingRow as any).catalog_sku,
      source_sku: (pricingRow as any).source_sku,
    })
    .eq('id', rowId)
    .eq('estimate_id', estimateId)
    .select('*')
    .single()

  if (updateError || !updated) {
    return { error: updateError?.message ?? 'Failed to link row to pricing' }
  }

  revalidateWorksheet(jobId)
  return { row: updated as unknown as JobWorksheetRow }
}

export async function unlinkRowFromPricing(
  rowId: string,
  estimateId: string,
  jobId: string,
): Promise<{ row: JobWorksheetRow } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  // Fetch cost fields, job scoping, and estimate editability in parallel
  const [
    { data: worksheetItem, error: itemError },
    { data: estimate, error: estimateError },
  ] = await Promise.all([
    auth.supabase
      .from('job_worksheet_items')
      .select(WORKSHEET_COST_COLS)
      .eq('id', rowId)
      .eq('estimate_id', estimateId)
      .single(),
    auth.supabase
      .from('estimates')
      .select('status, locked_at')
      .eq('id', estimateId)
      .single(),
  ])

  if (itemError || !worksheetItem) {
    return { error: itemError?.message ?? 'Worksheet item not found' }
  }
  if (estimateError || !estimate) {
    return { error: estimateError?.message ?? 'Estimate not found' }
  }
  if (!isEstimateEditable(estimate)) {
    return { error: 'Estimate is locked and cannot be modified' }
  }

  if ((worksheetItem as any).job_id !== jobId) {
    return { error: 'Worksheet item does not belong to this job' }
  }

  // Compute resolved cost before clearing source fields, then move it to unit_cost_manual
  const item = worksheetItem as any
  const resolvedCost: number | null = item.unit_cost_is_overridden
    ? (item.unit_cost_override ?? null)
    : item.pricing_source_row_id !== null
      ? (item.unit_cost_source ?? null)
      : (item.unit_cost_manual ?? null)

  const { data: updated, error: updateError } = await auth.supabase
    .from('job_worksheet_items')
    .update({
      pricing_source_row_id: null,
      pricing_header_id: null,
      unit_cost_manual: resolvedCost,
      unit_cost_source: null,
      unit_cost_override: null,
      unit_cost_is_overridden: false,
    })
    .eq('id', rowId)
    .eq('estimate_id', estimateId)
    .select('*')
    .single()

  if (updateError || !updated) {
    return { error: updateError?.message ?? 'Failed to unlink row from pricing' }
  }

  revalidateWorksheet(jobId)
  return { row: updated as unknown as JobWorksheetRow }
}

export async function acceptPricingSource(
  rowId: string,
  estimateId: string,
  jobId: string,
): Promise<{ row: JobWorksheetRow } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const permGuard = await requireModuleAccess(auth.user.id, 'estimates', 'edit')
  if (permGuard) return permGuard

  const [
    { data: worksheetItem, error: itemError },
    { data: estimate, error: estimateError },
  ] = await Promise.all([
    auth.supabase
      .from('job_worksheet_items')
      .select('job_id')
      .eq('id', rowId)
      .eq('estimate_id', estimateId)
      .single(),
    auth.supabase
      .from('estimates')
      .select('status, locked_at')
      .eq('id', estimateId)
      .single(),
  ])

  if (itemError || !worksheetItem) {
    return { error: itemError?.message ?? 'Worksheet item not found' }
  }
  if (estimateError || !estimate) {
    return { error: estimateError?.message ?? 'Estimate not found' }
  }
  if (!isEstimateEditable(estimate)) {
    return { error: 'Estimate is locked and cannot be modified' }
  }
  if ((worksheetItem as any).job_id !== jobId) {
    return { error: 'Worksheet item does not belong to this job' }
  }

  const { data: updated, error: updateError } = await auth.supabase
    .from('job_worksheet_items')
    .update({
      unit_cost_override: null,
      unit_cost_is_overridden: false,
    })
    .eq('id', rowId)
    .eq('estimate_id', estimateId)
    .select('*')
    .single()

  if (updateError || !updated) {
    return { error: updateError?.message ?? 'Failed to accept pricing source' }
  }

  revalidateWorksheet(jobId)
  return { row: updated as unknown as JobWorksheetRow }
}
