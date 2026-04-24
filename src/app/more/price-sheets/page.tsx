import PricingHeadersPageClient from '@/components/patterns/pricing/headers/PricingHeadersPageClient'

export default function Page() {
  return (
    <PricingHeadersPageClient
      kind="price_sheet"
      detailBasePath="/more/price-sheets"
      permissionRowKey="pricing_sources"
      accessDeniedMessage="Pricing Sources access required."
    />
  )
}
