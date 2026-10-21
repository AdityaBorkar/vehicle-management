import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";

import { cn } from "#/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<InputPrimitive
			className={cn(
				"h-10 w-full min-w-0 rounded-xl border border-input bg-transparent px-3.5 py-1 text-base outline-none transition-[border-color,box-shadow,background-color] duration-300 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground/70 focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm dark:bg-white/[0.02] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 dark:disabled:bg-input/80",
				className,
			)}
			data-slot="input"
			type={type}
			{...props}
		/>
	);
}

export { Input };
