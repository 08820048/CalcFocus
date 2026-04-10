import * as SwitchPrimitives from "@radix-ui/react-switch";
import { Check, X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
	React.ElementRef<typeof SwitchPrimitives.Root>,
	React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
	<SwitchPrimitives.Root
		className={cn(
			"ui-switch peer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
			className,
		)}
		{...props}
		ref={ref}
	>
		<SwitchPrimitives.Thumb className={cn("ui-switch-thumb")}>
			<Check className="ui-switch-icon ui-switch-icon--check" strokeWidth={3} />
			<X className="ui-switch-icon ui-switch-icon--cross" strokeWidth={3} />
		</SwitchPrimitives.Thumb>
	</SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
