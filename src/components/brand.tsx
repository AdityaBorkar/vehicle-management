import type { ReactNode } from "react";

import { cn } from "#/lib/utils";

export function LogoMark({ className }: { className?: string }): ReactNode {
	return (
		<svg
			aria-hidden="true"
			className={cn("size-6", className)}
			fill="none"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			viewBox="0 0 24 24"
		>
			<path d="M3.25 4.25 12 20.25l8.75-16" strokeWidth="1.7" />
			<path d="M7.6 4.25 12 12.3l4.4-8.05" opacity="0.45" strokeWidth="1.2" />
		</svg>
	);
}

export function Wordmark({
	className,
	markClassName,
	showTag = false,
}: {
	className?: string;
	markClassName?: string;
	showTag?: boolean;
}): ReactNode {
	return (
		<span className={cn("flex items-center gap-2", className)}>
			<LogoMark className={cn("size-5", markClassName)} />
			<span className="font-semibold text-[17px] leading-none tracking-[-0.04em]">
				Vahan
			</span>
			{showTag ? (
				<span className="ml-1 hidden rounded-full border border-border px-2 py-0.5 font-mono text-[9px] text-muted-foreground uppercase tracking-[0.12em] sm:inline">
					Fleet OS
				</span>
			) : null}
		</span>
	);
}
