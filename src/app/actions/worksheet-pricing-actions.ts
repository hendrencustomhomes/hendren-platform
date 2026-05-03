'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import type { JobWorksheetRow } from '@/components/patterns/estimate/JobWorksheetTableAdapter'

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

export async function linkRowToPricing(
  rowId: string,
  estimateId: string,
  pricingRowId: string,
  jobId: string,
): Promise<{ row: JobWorksheetRow } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: 'Not authenticated' }

  const [
    { data: pricingRow, error: pricingError },
    { data: worksheetItem, error: itemError },
  ] = await Promise.all([
    auth.supabase
      .from('pricing_rows')
      .select('id, pricing_header_id, unit_price, unit, catalog_sku, source_sku')
      .eq('id', pricingRowId)
      .eq('is_active', true)
      .single(),
    auth.supabase
      .from('job_worksheet_items')
      .select('unit')
      .eq('id', rowId)
      .eq('estimate_id', estimateId)
      .single(),
  ])

  if (pricingError || !pricingRow) {
    return { error: pricingError?.message ?? 'Pricing row not found or not active' }
  }
  if (itemError || !worksheetItem) {
    return { error: itemError?.message ?? 'Worksheet item not found' }
  }

  // COALESCE: use source unit if present, otherwise keep existing
  const coalescedUnit = (pricingRow as any).unit ?? (worksheetItem as any).unit

  const { data: updated, error: updateError } = await auth.supabase
    .from('job_worksheet_items')
    .update({
      pricing_source_row_id: pricingRowId,
      pricing_header_id: (pricingRow as any).pricing_header_id,
      unit_price: (pricingRow as any).unit_price,
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

  const { data: updated, error: updateError } = await auth.supabase
    .from('job_worksheet_items')
    .update({
      pricing_source_row_id: null,
      pricing_header_id: null,
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
