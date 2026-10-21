import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const items = [
	{ label: "Profile", to: "/settings/user" },
	{ label: "Connections", to: "/settings/connections" },
	{ label: "WhatsApp", to: "/settings/whatsapp" },
] as const;

export function SettingsNav(): ReactNode {
	return (
		<nav
			aria-label="Settings sections"
			className="inline-flex w-fit flex-wrap items-center gap-1 rounded-full border border-border bg-muted/50 p-1"
		>
			{items.map((item) => (
				<Link
					activeOptions={{ exact: true }}
					activeProps={{ className: "bg-background text-foreground shadow-sm" }}
					className="rounded-full px-4 py-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
					key={item.to}
					to={item.to}
				>
					{item.label}
				</Link>
			))}
		</nav>
	);
}
