export default function InternalUsersPage() {
  const rules = [
    'Mirror internal users from Supabase auth + internal access tables',
    'Do not create a separate conflicting user system',
    'Persist user records independently of session state',
    'Do not allow duplicate users (email is unique)',
    'Allow admin flag to be set per user',
    'Allow editing of position and contact fields',
  ]

  const fields = [
    'Name',
    'Email (source of truth from Supabase auth)',
    'Admin (boolean)',
    'Position',
    'Phone',
  ]

  const legacyBehavior = [
    'Existing users are derived from Supabase auth and internal_access',
    'Profiles.role may still exist but is not authoritative',
    'internal_access is the source of truth for internal users',
  ]

  const futureBehavior = [
    'Internal users are managed through Supabase auth + internal_access',
    'Admin flag is stored and controlled in internal_access',
    'Position and contact fields are stored in a user profile layer',
    'This page becomes the control panel for internal user management',
  ]

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Internal Users</h1>
        <p className="text-sm text-muted-foreground">
          This page mirrors and manages internal users from Supabase. It provides
          admin control and stores additional user details used across the
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
          <h2 className="text-base font-medium">User fields</h2>
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
            This is a placeholder page. The actual implementation should read
            from Supabase auth and internal_access, allow admin toggling, and
            persist position and contact details in a profile layer tied to the
            user.
          </p>
        </div>
      </div>
    </div>
  )
}