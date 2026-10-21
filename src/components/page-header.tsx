import type { ReactNode } from "react";

import { cn } from "#/lib/utils";

export function PageHeader({
	actions,
	className,
	description,
	eyebrow,
	meta,
	title,
}: {
	actions?: ReactNode;
	className?: string;
	description?: ReactNode;
	eyebrow?: ReactNode;
	meta?: ReactNode;
	title: ReactNode;
}): ReactNode {
	return (
		<header
			className={cn(
				"page-enter border-b border-border pb-8 md:pb-10",
				className,
			)}
		>
			<div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
				<div className="min-w-0">
					{eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
					<h1 className="page-title">{title}</h1>
					{description ? (
						<p className="lede mt-4 max-w-2xl">{description}</p>
					) : null}
				</div>
				{actions ? (
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						{actions}
					</div>
				) : null}
			</div>
			{meta ? (
				<div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-border pt-4 text-muted-foreground text-xs">
					{meta}
				</div>
			) : null}
		</header>
	);
}
