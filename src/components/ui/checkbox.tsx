import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { IconCheck } from "@tabler/icons-react";

import { cn } from "#/lib/utils";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
	return (
		<CheckboxPrimitive.Root
			className={cn(
				"peer size-4 shrink-0 rounded-[5px] border border-input shadow-xs outline-none transition-shadow focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 data-disabled:cursor-not-allowed data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-disabled:opacity-50 dark:bg-input/30 dark:data-checked:bg-primary dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
				className,
			)}
			data-slot="checkbox"
			{...props}
		>
			<CheckboxPrimitive.Indicator
				className="grid place-content-center text-current transition-none"
				data-slot="checkbox-indicator"
			>
				<IconCheck className="size-3.5" />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox };
