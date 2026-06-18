import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-20 w-full resize-y rounded-xl border border-input bg-card px-3.5 py-3 text-base text-foreground transition-[border-color,box-shadow] outline-none md:text-[15px]",
        "placeholder:text-muted-foreground/60",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
