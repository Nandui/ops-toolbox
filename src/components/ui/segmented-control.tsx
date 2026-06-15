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
        "inline-flex items-center gap-0.5 rounded-xl bg-white/[0.06] p-1",
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
                ? "bg-white/[0.12] font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.3)]"
                : "text-white/50 hover:text-white/75"
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
