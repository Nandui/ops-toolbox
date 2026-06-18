import * as React from "react"
import { cn } from "@/lib/utils"
import type { PillTone } from "@/components/ui/status-pill"

/*
 * Timeline — audit-friendly activity feed. A connecting rail with node dots;
 * each entry has a title, optional actor/meta, timestamp, and body. Used in
 * detail drawers to show the history of a record.
 */

export interface TimelineEntry {
  id: string
  title: React.ReactNode
  meta?: React.ReactNode
  timestamp?: string
  body?: React.ReactNode
  tone?: PillTone
  icon?: React.ElementType
}

const DOT_TONE: Record<PillTone, string> = {
  ok: "bg-success",
  info: "bg-chart-2",
  warning: "bg-warning",
  critical: "bg-destructive",
  accent: "bg-primary",
  neutral: "bg-muted-foreground/50",
}

export function Timeline({ entries, className }: { entries: TimelineEntry[]; className?: string }) {
  if (entries.length === 0) {
    return <p className={cn("text-callout text-muted-foreground", className)}>No activity recorded yet.</p>
  }
  return (
    <ol className={cn("relative space-y-5", className)}>
      {entries.map((e, i) => {
        const Icon = e.icon
        const last = i === entries.length - 1
        return (
          <li key={e.id} className="relative flex gap-3 pl-1">
            {/* Rail */}
            {!last && (
              <span className="absolute top-5 left-[0.6875rem] h-[calc(100%+0.5rem)] w-px bg-border" aria-hidden />
            )}
            {/* Node */}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ring-4 ring-card",
                Icon ? "bg-muted text-muted-foreground" : "",
              )}
            >
              {Icon ? (
                <Icon className="size-3" />
              ) : (
                <span className={cn("size-2.5 rounded-full", DOT_TONE[e.tone ?? "neutral"])} />
              )}
            </span>
            {/* Content */}
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-callout font-medium text-foreground">{e.title}</p>
                {e.timestamp && <time className="text-caption text-muted-foreground">{e.timestamp}</time>}
              </div>
              {e.meta && <p className="text-caption text-muted-foreground">{e.meta}</p>}
              {e.body && <div className="mt-1 text-callout text-foreground/80">{e.body}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
