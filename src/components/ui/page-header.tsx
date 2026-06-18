import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Page header — one Display title per page, no prefix labels above it.
 * Controls (site/date pickers, refresh) go in `actions`.
 */
function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header
      data-slot="page-header"
      className={cn("flex flex-wrap items-end justify-between gap-4", className)}
    >
      <div className="min-w-0">
        <h1 className="text-display text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Section title within a page — Title role, optional trailing action. */
function SectionHeader({
  title,
  action,
  className,
}: {
  title: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="section-header"
      className={cn("flex items-center justify-between gap-3", className)}
    >
      <h2 className="text-title text-foreground">{title}</h2>
      {action}
    </div>
  )
}

export { PageHeader, SectionHeader }
