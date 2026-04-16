import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-[1.95rem] w-[3.45rem] shrink-0 cursor-pointer items-center rounded-[10px] border border-transparent p-[0.28rem] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] transition-[background-color,box-shadow] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4bbd7e]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-[#4bbd7e] data-[state=unchecked]:bg-[rgb(182,182,182)]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-[1.35rem] w-[1.35rem] rounded-[8px] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.18)] ring-0 transition-transform duration-300 ease-out",
        "data-[state=checked]:translate-x-[1.45rem] data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
