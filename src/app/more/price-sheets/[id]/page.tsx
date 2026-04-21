import PricingWorksheetPage from '@/components/pricing/PricingWorksheetPage'

export default async function PriceSheetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <PricingWorksheetPage
      headerId={id}
      backHref="/more/price-sheets"
      detailBasePath="/more/price-sheets"
      navFallbackTitle="Price Sheet"
      missingLabel="Price sheet"
    />
  )
}
