export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-6">
      <div className="bg-fg-4/10 h-8 w-48 animate-pulse rounded" />
      <div className="bg-fg-4/10 h-4 w-64 animate-pulse rounded" />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-fg-4/15 bg-bg-1 h-28 animate-pulse rounded-2xl border" />
        ))}
      </div>
    </div>
  );
}
