import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * Button tiers — one Primary per visible context, everything else quieter:
 *  primary     filled indigo; the single most important action on screen
 *  secondary   indigo tint; important but not the sole action
 *  tertiary    bordered neutral (Linear-style); standard utility actions
 *  ghost       plain; lowest weight, nav-like actions
 *  destructive red tint; always pair with a confirmation
 * `default` and `outline` are kept as aliases (primary / tertiary) for
 * compatibility with shadcn-style call sites.
 */

const primaryClasses =
  "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(2_6_23/0.12)] hover:brightness-110"
const tertiaryClasses =
  "border border-border bg-card text-foreground shadow-[0_1px_2px_rgb(2_6_23/0.04)] hover:bg-muted"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all duration-150 outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 aria-invalid:ring-[3px] aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: primaryClasses,
        default: primaryClasses,
        secondary: "bg-primary/10 text-primary hover:bg-primary/15",
        tertiary: tertiaryClasses,
        outline: tertiaryClasses,
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/15 focus-visible:ring-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 gap-1 rounded-lg px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-[10px] px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        default: "h-9 gap-2 rounded-xl px-4 text-sm",
        lg: "h-10 gap-2 rounded-xl px-5 text-[15px]",
        icon: "size-9 rounded-xl",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-[10px] [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
