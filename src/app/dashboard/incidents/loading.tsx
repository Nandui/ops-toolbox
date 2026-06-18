export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="surface-card p-5">
        <div className="mb-3 h-3 w-32 rounded bg-muted" />
        <div className="h-8 w-48 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface-card p-4">
            <div className="mb-3 h-2 w-20 rounded bg-muted" />
            <div className="h-8 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="surface-card space-y-3 p-5">
          <div className="h-3 w-32 rounded bg-muted" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-full rounded bg-muted/60" />
          ))}
        </div>
        <div className="surface-card space-y-3 p-5">
          <div className="h-3 w-28 rounded bg-muted" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 w-full rounded bg-muted/60" />
          ))}
        </div>
      </div>
    </div>
  )
}
