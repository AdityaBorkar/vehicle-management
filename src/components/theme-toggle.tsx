import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "#/lib/utils";

const themeOptions = [
	{ icon: IconSun, label: "Light", value: "light" },
	{ icon: IconMoon, label: "Dark", value: "dark" },
	{ icon: IconDeviceDesktop, label: "System", value: "system" },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
	const { setTheme, theme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const activeIndex = mounted
		? Math.max(
				0,
				themeOptions.findIndex((option) => option.value === theme),
			)
		: 2;

	return (
		<div
			aria-label="Color theme"
			className={cn(
				"relative inline-flex items-center rounded-full border border-border bg-muted/60 p-0.5 backdrop-blur-sm",
				className,
			)}
			role="group"
		>
			<span
				aria-hidden="true"
				className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-7 rounded-full border border-border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
				style={{
					opacity: mounted ? 1 : 0,
					transform: `translateX(${activeIndex * 30}px)`,
				}}
			/>
			{themeOptions.map(({ icon: Icon, label, value }) => {
				const active = mounted && theme === value;
				return (
					<button
						aria-label={`${label} theme`}
						aria-pressed={active}
						className={cn(
							"relative z-10 grid size-7 place-items-center rounded-full transition-colors duration-300",
							active
								? "text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
						key={value}
						onClick={() => setTheme(value)}
						title={`${label} theme`}
						type="button"
					>
						<Icon className="size-3.5" stroke={1.8} />
					</button>
				);
			})}
		</div>
	);
}
