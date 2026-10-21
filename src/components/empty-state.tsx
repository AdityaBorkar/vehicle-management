import type { ComponentType, ReactNode } from "react";

import { cn } from "#/lib/utils";

export function EmptyState({
	action,
	className,
	description,
	icon: Icon,
	title,
}: {
	action?: ReactNode;
	className?: string;
	description?: ReactNode;
	icon: ComponentType<{ className?: string; strokeWidth?: number }>;
	title: ReactNode;
}): ReactNode {
	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-14 text-center md:py-20",
				className,
			)}
		>
			<div className="dot-grid pointer-events-none absolute inset-0 text-foreground opacity-[0.14] [mask-image:radial-gradient(60%_70%_at_50%_40%,black,transparent)]" />
			<div className="relative mx-auto flex max-w-md flex-col items-center">
				<span className="mb-6 grid size-12 place-items-center rounded-full border border-border bg-background">
					<Icon className="size-5" strokeWidth={1.6} />
				</span>
				<h2 className="text-xl tracking-[-0.03em]">{title}</h2>
				{description ? (
					<p className="mt-2 max-w-sm text-muted-foreground text-sm">
						{description}
					</p>
				) : null}
				{action ? <div className="mt-6">{action}</div> : null}
			</div>
		</div>
	);
}
