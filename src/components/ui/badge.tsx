import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "#/lib/utils";

const badgeVariants = cva(
	"group/badge inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full border px-2.5 py-0.5 font-medium text-[11px] tracking-[0.01em] transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
	{
		defaultVariants: {
			variant: "default",
		},
		variants: {
			variant: {
				default:
					"border-primary bg-primary text-primary-foreground [a]:hover:bg-primary/90",
				destructive:
					"border-destructive/15 bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/15 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/15",
				ghost:
					"border-transparent hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
				link: "border-transparent text-primary underline-offset-4 hover:underline",
				outline:
					"border-border text-muted-foreground [a]:hover:bg-muted [a]:hover:text-foreground",
				secondary:
					"border-border/60 bg-muted text-foreground/80 [a]:hover:bg-muted/70",
			},
		},
	},
);

function Badge({
	className,
	variant = "default",
	render,
	...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return useRender({
		defaultTagName: "span",
		props: mergeProps<"span">(
			{
				className: cn(badgeVariants({ variant }), className),
			},
			props,
		),
		render,
		state: {
			slot: "badge",
			variant,
		},
	});
}

export { Badge, badgeVariants };
