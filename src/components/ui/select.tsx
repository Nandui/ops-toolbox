import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/*
 * Styled native <select> matching the Input field. For 2–4 fixed options
 * prefer SegmentedControl; this is for longer lists (sites, categories).
 */
function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        data-slot="select"
        className={cn(
          "h-10 w-full appearance-none rounded-xl border-0 bg-white/[0.06] pr-9 pl-4 text-base text-foreground transition-[background-color,box-shadow] outline-none md:text-[15px]",
          "focus-visible:bg-white/[0.07] focus-visible:ring-[3px] focus-visible:ring-ring/40",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "[&>option]:bg-popover [&>option]:text-popover-foreground"
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-white/40" />
    </div>
  )
}

export { Select }
