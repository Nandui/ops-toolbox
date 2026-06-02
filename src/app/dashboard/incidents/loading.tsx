export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="border border-white/[0.08] bg-white/[0.03] p-5">
        <div className="h-3 w-32 bg-white/[0.06] mb-3" />
        <div className="h-8 w-48 bg-white/[0.06]" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="h-2 w-20 bg-white/[0.06] mb-3" />
            <div className="h-8 w-12 bg-white/[0.06]" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="border border-white/[0.08] bg-white/[0.03] p-5 space-y-3">
          <div className="h-3 w-32 bg-white/[0.06]" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-full bg-white/[0.04]" />
          ))}
        </div>
        <div className="border border-white/[0.08] bg-white/[0.03] p-5 space-y-3">
          <div className="h-3 w-28 bg-white/[0.06]" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 w-full bg-white/[0.04]" />
          ))}
        </div>
      </div>
    </div>
  )
}
