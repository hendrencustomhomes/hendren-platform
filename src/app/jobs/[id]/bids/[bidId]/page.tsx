import { redirect } from 'next/navigation'

export default async function JobBidDetailPage({ params }: { params: Promise<{ id: string; bidId: string }> }) {
  const { bidId } = await params
  redirect(`/more/price-sheets/${bidId}`)
}
