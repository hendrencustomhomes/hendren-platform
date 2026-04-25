import CatalogDetailPage from '../_components/CatalogDetailPage'

export default function Page({ params }: { params: { id: string } }) {
  return <CatalogDetailPage catalogSku={params.id} />
}
