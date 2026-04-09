export default function ClientsPage() {
  const rules = [
    'Pull legacy clients from existing jobs',
    'Persist clients even if related jobs are later deleted',
    'Do not allow duplicate clients',
    'Allow new jobs to select an existing client',
    'Allow new jobs to create a new client when needed',
    'Allow manual client creation from this page',
  ]

  const legacyBehavior = [
    'Legacy state: derive client candidates from all existing jobs',
    'Use this to seed the client list as we transition to a dedicated client dataset',
  ]

  const futureBehavior = [
    'Create a client record when a new job is created with a client filled in',
    'Create a client record when a user manually adds one from the Clients page',
    'Use the dedicated client list as the source for future job client selection',
  ]

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">
          This page will manage the shared client list used across the Hendren
          Platform.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4 md:p-6">
        <div className="space-y-3">
          <h2 className="text-base font-medium">Required behavior</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {rules.map((rule) => (
              <li key={rule} className="ml-5 list-disc">
                {rule}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 md:p-6">
        <div className="space-y-3">
          <h2 className="text-base font-medium">Legacy migration behavior</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {legacyBehavior.map((item) => (
              <li key={item} className="ml-5 list-disc">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 md:p-6">
        <div className="space-y-3">
          <h2 className="text-base font-medium">Future canonical behavior</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {futureBehavior.map((item) => (
              <li key={item} className="ml-5 list-disc">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 md:p-6">
        <div className="space-y-2">
          <h2 className="text-base font-medium">Implementation note</h2>
          <p className="text-sm text-muted-foreground">
            This is a placeholder page for now. The actual client dataset,
            deduping rules, job integration, and persistence should be wired in
            next so clients become a durable shared record instead of only job
            text.
          </p>
        </div>
      </div>
    </div>
  )
}