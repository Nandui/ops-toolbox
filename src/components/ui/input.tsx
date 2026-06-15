import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/*
 * Borderless filled field — boundary comes from the fill, focus from the
 * emerald ring. text-base on small screens prevents iOS zoom-on-focus.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border-0 bg-white/[0.06] px-4 py-2 text-base text-foreground transition-[background-color,box-shadow] outline-none md:text-[15px]",
        "placeholder:text-white/30",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "focus-visible:bg-white/[0.07] focus-visible:ring-[3px] focus-visible:ring-ring/40",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:ring-[3px] aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
    />
  )
}

export { Input }
