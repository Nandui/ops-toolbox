import * as React from "react"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "size-5 animate-spin rounded-full border-2 border-primary border-t-transparent",
        className
      )}
    />
  )
}

function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      data-slot="loading-state"
      className={cn("flex flex-col items-center justify-center py-16", className)}
    >
      <Spinner className="size-7" />
      <p className="mt-4 text-[15px] text-white/40">{label}</p>
    </div>
  )
}

/** Card-shaped skeleton that mirrors a titled list while it loads. */
function CardSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  const widths = ["w-full", "w-3/4", "w-1/2"]
  return (
    <div data-slot="card-skeleton" className={cn("surface-card p-5", className)}>
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn("mt-3 h-4", widths[i % widths.length])} />
      ))}
    </div>
  )
}

export { Spinner, LoadingState, CardSkeleton }
