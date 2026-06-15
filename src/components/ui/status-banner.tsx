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
    container: "bg-red-500/[0.08] ring-red-500/20 text-red-300/90",
    iconColor: "text-red-400/80",
  },
  success: {
    icon: CheckCircle2,
    container: "bg-emerald-500/[0.08] ring-emerald-500/20 text-emerald-300/90",
    iconColor: "text-emerald-400/80",
  },
  warning: {
    icon: AlertTriangle,
    container: "bg-amber-500/[0.08] ring-amber-500/20 text-amber-300/90",
    iconColor: "text-amber-400/80",
  },
  info: {
    icon: Info,
    container: "bg-blue-500/[0.08] ring-blue-500/20 text-blue-300/90",
    iconColor: "text-blue-400/80",
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
