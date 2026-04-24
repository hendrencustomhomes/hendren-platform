import type { PricingHeaderKind } from './types'

export type PricingHeaderKindConfig = {
  kind: PricingHeaderKind
  scope: 'global_reference' | 'job_specific'
  requiresJob: boolean
  acceptedByDefault: boolean
  canBeAwarded: boolean
  moduleLabel: string
  singularLabel: string
  pluralLabel: string
}

export const PRICING_HEADER_KIND_CONFIG: Record<PricingHeaderKind, PricingHeaderKindConfig> = {
  price_sheet: {
    kind: 'price_sheet',
    scope: 'global_reference',
    requiresJob: false,
    acceptedByDefault: true,
    canBeAwarded: false,
    moduleLabel: 'Price Sheets',
    singularLabel: 'Price Sheet',
    pluralLabel: 'Price Sheets',
  },
  bid: {
    kind: 'bid',
    scope: 'job_specific',
    requiresJob: true,
    acceptedByDefault: false,
    canBeAwarded: true,
    moduleLabel: 'Bids',
    singularLabel: 'Bid',
    pluralLabel: 'Bids',
  },
}

export function getPricingHeaderKindConfig(kind: PricingHeaderKind) {
  return PRICING_HEADER_KIND_CONFIG[kind]
}

export function assertPricingHeaderJobScope(kind: PricingHeaderKind, jobId?: string | null) {
  const config = getPricingHeaderKindConfig(kind)

  if (config.requiresJob && !jobId) {
    throw new Error('job_id is required when kind is bid')
  }

  if (!config.requiresJob && jobId) {
    throw new Error('job_id must be null when kind is price_sheet')
  }
}
