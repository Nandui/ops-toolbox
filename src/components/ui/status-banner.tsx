'use client'

import * as React from "react"
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react"

import { cn } from "@/lib/utils"

type StatusVariant = "error" | "success" | "warning" | "info"

const VARIANT_STYLES: Record<
  StatusVariant,
  { icon: React.ElementType; container: string; iconColor: string }
> = {
  error: {
    icon: AlertCircle,
    container: "bg-destructive/8 ring-destructive/20 text-destructive",
    iconColor: "text-destructive",
  },
  success: {
    icon: CheckCircle2,
    container: "bg-success/10 ring-success/25 text-success",
    iconColor: "text-success",
  },
  warning: {
    icon: AlertTriangle,
    container: "bg-warning/12 ring-warning/30 text-warning",
    iconColor: "text-warning",
  },
  info: {
    icon: Info,
    container: "bg-primary/8 ring-primary/20 text-primary",
    iconColor: "text-primary",
  },
}

interface StatusBannerProps {
  variant?: StatusVariant
  children: React.ReactNode
  onDismiss?: () => void
  className?: string
}

function StatusBanner({ variant = "info", children, onDismiss, className }: StatusBannerProps) {
  const styles = VARIANT_STYLES[variant]
  const Icon = styles.icon
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      data-slot="status-banner"
      className={cn(
        "flex items-start gap-3 rounded-xl px-5 py-3.5 ring-1 ring-inset",
        "animate-in fade-in-0 slide-in-from-top-2 duration-200",
        styles.container,
        className
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", styles.iconColor)} />
      <div className="flex-1 text-sm">{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mt-0.5 -mr-1.5 rounded-lg p-1 text-current opacity-50 transition-opacity hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export { StatusBanner, type StatusVariant }
