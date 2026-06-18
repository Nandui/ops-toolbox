import * as React from "react"

import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: React.ElementType
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className
      )}
    >
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
          <Icon className="size-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="mt-4 text-xl font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 max-w-xs text-[15px] text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export { EmptyState }
