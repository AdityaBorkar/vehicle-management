import {
	IconCheck,
	IconDeviceDesktop,
	IconMoon,
	IconSun,
} from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
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

	const ActiveIcon =
		(mounted && themeOptions.find((option) => option.value === theme)?.icon) ||
		IconDeviceDesktop;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label="Change theme"
				render={
					<Button
						className={cn(className)}
						size="icon-sm"
						type="button"
						variant="ghost"
					>
						<ActiveIcon className="h-4 w-4" />
					</Button>
				}
			/>
			<DropdownMenuContent align="end">
				{themeOptions.map(({ icon: Icon, label, value }) => (
					<DropdownMenuItem
						className="justify-between"
						key={value}
						onClick={() => setTheme(value)}
					>
						<span className="flex items-center gap-2">
							<Icon className="h-4 w-4" />
							{label}
						</span>
						{mounted && theme === value ? (
							<IconCheck className="h-4 w-4 text-primary" />
						) : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
