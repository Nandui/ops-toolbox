import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900 p-6 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.75)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl bg-zinc-800" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-36 bg-zinc-800" />
                <Skeleton className="h-4 w-72 bg-zinc-800" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-7 w-24 rounded-full bg-zinc-800" />
              <Skeleton className="h-7 w-28 rounded-full bg-zinc-800" />
              <Skeleton className="h-7 w-28 rounded-full bg-zinc-800" />
              <Skeleton className="h-7 w-48 rounded-full bg-zinc-800" />
            </div>
          </div>
          <Skeleton className="h-10 w-28 rounded-xl bg-zinc-800" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <Skeleton className="h-4 w-28 bg-zinc-800" />
            <Skeleton className="mt-3 h-9 w-16 bg-zinc-800" />
            <Skeleton className="mt-2 h-3 w-36 bg-zinc-800" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
          <Skeleton className="h-6 w-44 bg-zinc-800" />
          <Skeleton className="mt-2 h-4 w-80 bg-zinc-800" />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-24 bg-zinc-800" />
                <Skeleton className="h-11 w-full rounded-xl bg-zinc-800" />
              </div>
            ))}
            <div className="md:col-span-2 space-y-1.5">
              <Skeleton className="h-3 w-32 bg-zinc-800" />
              <Skeleton className="h-28 w-full rounded-xl bg-zinc-800" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Skeleton className="h-3 w-24 bg-zinc-800" />
              <Skeleton className="h-24 w-full rounded-xl bg-zinc-800" />
            </div>
            <div className="md:col-span-2 flex items-center justify-between gap-3 pt-1">
              <Skeleton className="h-4 w-80 bg-zinc-800" />
              <Skeleton className="h-10 w-36 rounded-xl bg-zinc-800" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
          <Skeleton className="h-6 w-36 bg-zinc-800" />
          <Skeleton className="mt-2 h-4 w-72 bg-zinc-800" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-56 bg-zinc-800" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-20 rounded-full bg-zinc-800" />
                      <Skeleton className="h-5 w-16 rounded-full bg-zinc-800" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-20 bg-zinc-800" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-10 w-full rounded-lg bg-zinc-800" />
                  ))}
                </div>
                <Skeleton className="h-16 w-full rounded-lg bg-zinc-800" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
