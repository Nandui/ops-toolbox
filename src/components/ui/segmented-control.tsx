'use client'

import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Apple-style segmented control for 2–4 fixed options (sites, intervals,
 * filters). For longer lists use Select.
 */
interface SegmentedControlProps<T extends string | number> {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
  "aria-label"?: string
}

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      data-slot="segmented-control"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl border border-border bg-muted p-1",
        className
      )}
    >
      {options.map(option => {
        const active = option.value === value
        return (
          <button
            key={String(option.value)}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[10px] px-4 py-1.5 text-sm transition-all duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
              active
                ? "bg-card font-medium text-foreground shadow-[0_1px_2px_rgb(2_6_23/0.08)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export { SegmentedControl }
