export default function CompaniesPage() {
  const rules = [
    'Pull legacy companies from existing procurement and schedule records',
    'Persist companies even if related procurement or schedule records are later deleted',
    'Do not allow duplicate companies',
    'Allow procurement creation to select an existing company',
    'Allow schedule creation to select an existing company',
    'Allow procurement or schedule creation to create a new company when needed',
    'Allow manual company creation from this page',
  ]

  const requiredFields = [
    'Company name',
    'Trade multi-select',
    'Compliance tracking',
    'Primary contact information',
    'Additional company contacts',
  ]

  const contactFields = [
    'Name',
    'Position',
    'Phone',
    'Email',
  ]

  const legacyBehavior = [
    'Legacy state: derive company candidates from existing procurement records',
    'Legacy state: derive company candidates from existing schedule records',
    'Use those records to seed the company list as we transition to a dedicated company dataset',
  ]

  const futureBehavior = [
    'Create a company record when procurement is created with a company filled in',
    'Create a company record when schedule creation includes a company filled in',
    'Create a company record when a user manually adds one from the Companies page',
    'Use the dedicated company list as the source for future procurement and schedule company selection',
  ]

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="text-sm text-muted-foreground">
          This page will manage the shared company list used across the Hendren
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
          <h2 className="text-base font-medium">Company data to manage</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {requiredFields.map((field) => (
              <li key={field} className="ml-5 list-disc">
                {field}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 md:p-6">
        <div className="space-y-3">
          <h2 className="text-base font-medium">Additional contact fields</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {contactFields.map((field) => (
              <li key={field} className="ml-5 list-disc">
                {field}
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
            This is a placeholder page for now. The actual company dataset,
            deduping rules, trade assignments, compliance structure, contacts,
            and procurement/schedule integration should be wired in next so
            companies become a durable shared record instead of only record-level
            text.
          </p>
        </div>
      </div>
    </div>
  )
}