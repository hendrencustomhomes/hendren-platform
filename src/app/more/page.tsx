export default function MorePage() {
  const upcomingItems = [
    "Clients",
    "Companies",
    "Internal Users",
    "Trades",
    "Cost Codes",
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">More</h1>
        <p className="text-sm text-muted-foreground">
          This section will store and manage shared datasets and admin tools for
          the Hendren Platform.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4 md:p-6">
        <div className="space-y-3">
          <h2 className="text-base font-medium">Planned datasets and tools</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {upcomingItems.map((item) => (
              <li key={item} className="ml-5 list-disc">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}