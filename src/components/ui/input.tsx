import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/*
 * Bordered field on card fill — the boundary is a hairline border, focus is
 * the indigo ring. text-base on small screens prevents iOS zoom-on-focus.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-input bg-card px-3.5 py-2 text-base text-foreground transition-[border-color,box-shadow] outline-none md:text-[15px]",
        "placeholder:text-muted-foreground/60",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
