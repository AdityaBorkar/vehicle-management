import { useId } from "react";

import { LogoMark } from "#/components/brand";
import { cn } from "#/lib/utils";

export function Stamp({ className }: { className?: string }) {
	const rawId = useId();
	const pathId = `stamp-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

	return (
		<div
			aria-hidden="true"
			className={cn(
				"relative grid size-56 place-items-center text-muted-foreground",
				className,
			)}
		>
			<svg
				className="stamp-spin absolute inset-0 size-full"
				fill="none"
				viewBox="0 0 200 200"
			>
				<title>Vahan fleet operations stamp</title>
				<defs>
					<path
						d="M100,100 m-79,0 a79,79 0 1,1 158,0 a79,79 0 1,1 -158,0"
						id={pathId}
					/>
				</defs>
				<circle
					cx="100"
					cy="100"
					r="92"
					stroke="currentColor"
					strokeOpacity="0.18"
				/>
				<circle
					cx="100"
					cy="100"
					r="66"
					stroke="currentColor"
					strokeOpacity="0.12"
				/>
				<text
					className="fill-current font-mono text-[8px] font-medium uppercase"
					style={{ letterSpacing: "0.24em" }}
				>
					<textPath href={`#${pathId}`} startOffset="0">
						VAHAN — FLEET OPERATIONS — EVERY DETAIL IN ORDER —
					</textPath>
				</text>
				{[
					[100, 2],
					[100, 198],
					[2, 100],
					[198, 100],
				].map(([x, y]) => (
					<circle
						cx={x}
						cy={y}
						fill="currentColor"
						fillOpacity="0.35"
						key={`${x}-${y}`}
						r="1.4"
					/>
				))}
			</svg>
			<div className="relative grid size-[104px] place-items-center rounded-full border border-border bg-background/70 backdrop-blur-sm">
				<LogoMark className="size-9" />
				<span className="absolute bottom-4 font-mono text-[8px] text-muted-foreground uppercase tracking-[0.18em]">
					Est. 2026
				</span>
			</div>
		</div>
	);
}
