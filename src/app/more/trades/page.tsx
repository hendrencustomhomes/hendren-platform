export default function TradesPage() {
  const placeholderTrades = [
    'Framing',
    'Electrical',
    'Plumbing',
    'HVAC',
    'Drywall',
    'Paint',
    'Flooring',
    'Cabinets',
    'Roofing',
    'Landscaping',
  ]

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Trades</h1>
        <p className="text-sm text-muted-foreground">
          This page will manage the shared trade list used across the Hendren
          Platform.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4 md:p-6">
        <div className="space-y-3">
          <h2 className="text-base font-medium">Current placeholder list</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {placeholderTrades.map((trade) => (
              <li key={trade} className="ml-5 list-disc">
                {trade}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 md:p-6">
        <div className="space-y-2">
          <h2 className="text-base font-medium">Next step</h2>
          <p className="text-sm text-muted-foreground">
            Later we will connect this page to a single centralized trade source
            and admin-only editing.
          </p>
        </div>
      </div>
    </div>
  )
}