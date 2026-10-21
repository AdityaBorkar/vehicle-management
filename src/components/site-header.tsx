import {
	IconCalendarEvent,
	IconCar,
	IconFileText,
	IconLayoutDashboard,
	IconLink,
	IconLogout,
	IconMenu2,
	IconMessageCircle,
	IconUser,
	IconUsers,
	IconX,
} from "@tabler/icons-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";

import { Wordmark } from "#/components/brand";
import { ThemeToggle } from "#/components/theme-toggle";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";

const navItems = [
	{ label: "Overview", to: "/dashboard" },
	{ label: "Vehicles", to: "/vehicles" },
	{ label: "Drivers", to: "/drivers" },
	{ label: "Documents", to: "/documents" },
	{ label: "Calendar", to: "/calendar" },
] as const;

const menuItems = [
	{ icon: IconLayoutDashboard, label: "Overview", to: "/dashboard" },
	{ icon: IconCar, label: "Vehicles", to: "/vehicles" },
	{ icon: IconUsers, label: "Drivers", to: "/drivers" },
	{ icon: IconFileText, label: "Documents", to: "/documents" },
	{ icon: IconCalendarEvent, label: "Calendar", to: "/calendar" },
] as const;

export function SiteHeader({
	onSignOut,
	user,
}: {
	onSignOut: () => void;
	user: { email: string; name: string | null | undefined };
}) {
	const navigate = useNavigate();
	const mobileNavId = useId();
	const [mobileOpen, setMobileOpen] = useState(false);

	const initial = user.name?.charAt(0).toUpperCase() ?? "V";

	return (
		<header className="no-print sticky top-0 z-40">
			<div className="bg-inverse text-inverse-foreground">
				<div className="mx-auto flex h-9 max-w-[1320px] items-center justify-between gap-4 px-5 md:px-8">
					<p className="flex min-w-0 items-center gap-2 text-[12px]">
						<span className="status-dot size-1.5 shrink-0 rounded-full bg-success" />
						<span className="truncate">
							Document expiries, tracked automatically.
						</span>
					</p>
					<Link
						className="link-arrow shrink-0 text-[12px] opacity-80 transition-opacity hover:opacity-100"
						to="/calendar"
					>
						<span className="sm:hidden">Calendar</span>
						<span className="hidden sm:inline">Expiry calendar</span>
						<span aria-hidden="true">↗</span>
					</Link>
				</div>
			</div>

			<div className="border-border border-b bg-background/85 backdrop-blur-xl">
				<div className="mx-auto flex h-16 max-w-[1320px] items-center gap-8 px-5 md:h-[74px] md:px-8">
					<Link
						aria-label="Vahan — go to overview"
						className="shrink-0"
						to="/dashboard"
					>
						<Wordmark showTag />
					</Link>

					<nav
						aria-label="Primary"
						className="hidden items-center gap-7 text-sm md:flex"
					>
						{navItems.map((item) => (
							<Link
								activeProps={{ className: "text-foreground" }}
								className="nav-link text-muted-foreground transition-colors hover:text-foreground"
								key={item.to}
								to={item.to}
							>
								{item.label}
							</Link>
						))}
					</nav>

					<div className="ml-auto flex items-center gap-2">
						<ThemeToggle className="mr-1 hidden sm:inline-flex" />
						<DropdownMenu>
							<DropdownMenuTrigger
								aria-label="Account menu"
								render={
									<Button
										className="size-9 rounded-full border border-border bg-muted/50 p-0 text-xs hover:bg-muted"
										size="icon"
										type="button"
										variant="ghost"
									>
										<span className="font-medium text-[13px]">{initial}</span>
									</Button>
								}
							/>
							<DropdownMenuContent align="end" className="w-64">
								<DropdownMenuGroup>
									<DropdownMenuLabel className="px-2 py-2">
										<span className="block font-medium text-foreground text-sm">
											{user.name ?? "Your account"}
										</span>
										<span className="block truncate font-normal text-muted-foreground text-xs">
											{user.email}
										</span>
									</DropdownMenuLabel>
								</DropdownMenuGroup>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => void navigate({ to: "/settings/user" })}
								>
									<IconUser className="size-4" stroke={1.7} />
									Profile
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => void navigate({ to: "/settings/connections" })}
								>
									<IconLink className="size-4" stroke={1.7} />
									Connections
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => void navigate({ to: "/settings/whatsapp" })}
								>
									<IconMessageCircle className="size-4" stroke={1.7} />
									WhatsApp
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-destructive focus:text-destructive"
									onClick={onSignOut}
									variant="destructive"
								>
									<IconLogout className="size-4" stroke={1.7} />
									Sign out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<Button
							aria-controls={mobileNavId}
							aria-expanded={mobileOpen}
							aria-label={mobileOpen ? "Close menu" : "Open menu"}
							className="md:hidden"
							onClick={() => setMobileOpen((open) => !open)}
							size="icon"
							type="button"
							variant="ghost"
						>
							{mobileOpen ? (
								<IconX className="size-5" />
							) : (
								<IconMenu2 className="size-5" />
							)}
						</Button>
					</div>
				</div>

				{mobileOpen ? (
					<div
						className="rise-in border-border border-t bg-background px-5 pt-4 pb-6 md:hidden"
						id={mobileNavId}
					>
						<nav aria-label="Mobile" className="grid gap-1">
							{menuItems.map((item) => (
								<Link
									activeProps={{
										className: "bg-muted text-foreground",
									}}
									className="flex items-center gap-3 rounded-xl px-3 py-3 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
									key={item.to}
									onClick={() => setMobileOpen(false)}
									to={item.to}
								>
									<item.icon className="size-4" stroke={1.7} />
									{item.label}
								</Link>
							))}
						</nav>
						<div className="mt-4 flex items-center justify-between border-t border-border pt-4">
							<ThemeToggle />
							<Button
								onClick={onSignOut}
								size="sm"
								type="button"
								variant="ghost"
							>
								<IconLogout className="size-4" />
								Sign out
							</Button>
						</div>
					</div>
				) : null}
			</div>
		</header>
	);
}
