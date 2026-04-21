import PricingWorksheetPage from '@/components/pricing/PricingWorksheetPage'

export default async function JobBidDetailPage({ params }: { params: Promise<{ id: string; bidId: string }> }) {
  const { id, bidId } = await params

  return (
    <PricingWorksheetPage
      headerId={bidId}
      backHref={`/jobs/${id}?tab=bids`}
      detailBasePath={`/jobs/${id}/bids`}
      navFallbackTitle="Bid"
      missingLabel="Bid"
      permissionRowKey="bids"
    />
  )
}
