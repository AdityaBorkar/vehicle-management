import type * as React from "react";

import { cn } from "#/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			className={cn(
				"field-sizing-content min-h-20 w-full rounded-xl border border-input bg-transparent px-3.5 py-2.5 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm dark:bg-white/[0.02] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 dark:disabled:bg-input/80",
				className,
			)}
			data-slot="textarea"
			{...props}
		/>
	);
}

export { Textarea };
