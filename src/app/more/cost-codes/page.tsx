export default function CostCodesPage() {
  const rules = [
    'Store cost codes as a shared dataset in Supabase',
    'Use one centralized cost code list across the platform',
    'Persist cost codes independently of jobs, procurement items, or tasks',
    'Do not allow duplicate cost codes',
    'Allow a code and a description for each cost code',
    'Allow cost codes to be active or inactive rather than deleted when possible',
  ]

  const fields = [
    'Code',
    'Description',
    'Status',
    'Optional category/group',
    'Optional notes',
  ]

  const legacyBehavior = [
    'Legacy state may include hardcoded values or free-text cost code entry in different parts of the app',
    'Existing records using older code text should be reviewed and mapped into the dedicated cost code dataset later',
    'This page is the future source of truth for cost code management',
  ]

  const futureBehavior = [
    'Cost codes are created and managed from this page',
    'Other flows should select from the centralized cost code list instead of using duplicated constants or uncontrolled text',
    'Inactive cost codes remain visible for historical records but are hidden from normal new-entry selection when appropriate',
  ]

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Cost Codes</h1>
        <p className="text-sm text-muted-foreground">
          This page will manage the shared cost code list used across the
          Hendren Platform.
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
          <h2 className="text-base font-medium">Cost code fields</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {fields.map((field) => (
              <li key={field} className="ml-5 list-disc">
                {field}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 md:p-6">
        <div className="space-y-3">
          <h2 className="text-base font-medium">Legacy behavior</h2>
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
            This is a placeholder page for now. The actual implementation should
            connect to a dedicated Supabase dataset and become the source of
            truth for cost code selection throughout the app.
          </p>
        </div>
      </div>
    </div>
  )
}