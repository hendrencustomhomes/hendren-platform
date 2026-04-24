import PricingHeadersPageClient from '@/components/patterns/pricing/headers/PricingHeadersPageClient'

export default async function JobBidsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <PricingHeadersPageClient
      kind="bid"
      jobId={id}
      detailBasePath={`/jobs/${id}/bids`}
      permissionRowKey="bids"
      accessDeniedMessage="Bids access required."
      backHref={`/jobs/${id}?tab=bids`}
    />
  )
}
