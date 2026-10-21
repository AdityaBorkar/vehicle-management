import type { ReactNode } from "react";

export function CenteredLoader(): ReactNode {
	return (
		<div
			aria-label="Loading"
			className="flex min-h-[50vh] flex-col items-center justify-center gap-5"
			role="status"
		>
			<span className="relative grid size-10 place-items-center">
				<span className="absolute inset-0 rounded-full border border-border" />
				<span className="absolute inset-0 animate-spin rounded-full border border-transparent border-t-foreground [animation-duration:1.1s]" />
				<span className="size-1.5 rounded-full bg-foreground" />
			</span>
			<span className="eyebrow">Loading</span>
		</div>
	);
}
