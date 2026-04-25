import CatalogDetailPage from '../_components/CatalogDetailPage'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CatalogDetailPage catalogSku={id} />
}
