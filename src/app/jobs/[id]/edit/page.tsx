export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div style={{ padding: 16 }}>
      Edit route works: {id}
    </div>
  )
}