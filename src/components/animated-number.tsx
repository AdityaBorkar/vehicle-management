import { useEffect, useRef, useState } from "react";

import { cn } from "#/lib/utils";

const DURATION = 900;

function prefersReducedMotion(): boolean {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

export function AnimatedNumber({
	className,
	value,
}: {
	className?: string;
	value: number;
}) {
	const [display, setDisplay] = useState(value);
	const previous = useRef(value);

	useEffect(() => {
		const from = previous.current;
		previous.current = value;
		if (from === value) return;

		if (prefersReducedMotion()) {
			setDisplay(value);
			return;
		}

		let frame = 0;
		const start = performance.now();

		const tick = (now: number) => {
			const progress = Math.min((now - start) / DURATION, 1);
			const eased = 1 - (1 - progress) ** 4;
			setDisplay(Math.round(from + (value - from) * eased));
			if (progress < 1) {
				frame = requestAnimationFrame(tick);
			}
		};

		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [value]);

	return (
		<span className={cn("tabular", className)}>
			{display.toLocaleString("en-IN")}
		</span>
	);
}
