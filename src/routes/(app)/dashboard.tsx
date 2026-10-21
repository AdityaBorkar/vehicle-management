import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowUpRight,
	Bell,
	Car,
	FileText,
	Plus,
	QrCode,
	ShieldCheck,
	Users,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { AnimatedNumber } from "#/components/animated-number";
import { Stamp } from "#/components/stamp";
import { buttonVariants } from "#/components/ui/button";
import { daysUntil, formatDate } from "#/lib/dates";
import { orpc } from "#/lib/rpc";

export const Route = createFileRoute("/(app)/dashboard")({
	component: Dashboard,
});

type AppSection = "/vehicles" | "/drivers" | "/documents" | "/upi";

type QuickLink = {
	to: AppSection;
	label: string;
	description: string;
	icon: ComponentType<{ className?: string; strokeWidth?: number }>;
	count?: number;
	unit?: string;
};

function isExpiringSoon(insuranceValidTill: Date | null): boolean {
	if (!insuranceValidTill) return false;
	const daysLeft = daysUntil(insuranceValidTill);
	return daysLeft <= 30 && daysLeft >= 0;
}

function Dashboard(): ReactNode {
	const { data: vehicleList } = useQuery(orpc.vehicle.list.queryOptions());
	const { data: driverList } = useQuery(orpc.driver.list.queryOptions());
	const { data: documentList } = useQuery(orpc.document.list.queryOptions());
	const { data: upcomingReminders } = useQuery(
		orpc.reminder.getUpcoming.queryOptions(),
	);

	const vehicles = vehicleList ?? [];
	const drivers = driverList ?? [];
	const documents = documentList ?? [];
	const reminders = upcomingReminders ?? [];

	const expiringInsurance = vehicles.filter((v) =>
		isExpiringSoon(v.insuranceValidTill),
	);
	const nextReminder = reminders[0];

	const quickLinks: QuickLink[] = [
		{
			count: vehicles.length,
			description: "Registrations, insurance, fitness and PUC.",
			icon: Car,
			label: "Vehicles",
			to: "/vehicles",
			unit: "on record",
		},
		{
			count: drivers.length,
			description: "People, phone numbers and driving licenses.",
			icon: Users,
			label: "Drivers",
			to: "/drivers",
			unit: "on record",
		},
		{
			count: documents.length,
			description: "Every paper ever held, renewals kept as history.",
			icon: FileText,
			label: "Documents",
			to: "/documents",
			unit: documents.length === 1 ? "document" : "documents",
		},
		{
			description: "Scannable UPI payments with a hidden tracking note.",
			icon: QrCode,
			label: "UPI QR",
			to: "/upi",
		},
	];

	return (
		<div className="space-y-14 md:space-y-20">
			<section>
				<div className="-mx-5 -mt-10 px-5 pt-10 md:-mx-8 md:px-8">
					<div className="page-enter grid gap-12 lg:grid-cols-[1.55fr_0.45fr] lg:items-end">
						<div>
							<p className="eyebrow eyebrow-dot">Fleet overview</p>
							<h1 className="display mt-6 max-w-[15ch]">
								Run your fleet from one place.
							</h1>
							<p className="lede mt-6">
								Vehicles, drivers, policies and renewals — every detail in one
								calm, ordered view. Nothing slips.
							</p>
							<div className="mt-8 flex flex-wrap items-center gap-3">
								<Link className={buttonVariants({ size: "lg" })} to="/vehicles">
									<Plus className="size-4" />
									Add a vehicle
								</Link>
								<Link
									className={buttonVariants({
										size: "lg",
										variant: "outline",
									})}
									to="/documents"
								>
									Open document vault
									<ArrowUpRight className="size-4" />
								</Link>
							</div>
						</div>

						<div className="drift hidden justify-end pb-2 lg:flex">
							<Stamp className="mr-2 size-48 opacity-90" />
						</div>
					</div>
				</div>
			</section>

			<section aria-label="Fleet statistics" className="reveal">
				<div className="grid divide-y divide-border border-y border-border md:grid-cols-3 md:divide-x md:divide-y-0">
					<StatLink
						hint={
							vehicles.length === 0
								? "Add a registration to begin"
								: "Registrations on record"
						}
						href="/vehicles"
						icon={Car}
						label="Vehicles"
						value={vehicles.length}
					/>
					<StatLink
						hint={
							drivers.length === 0
								? "No drivers added yet"
								: "People with documents on file"
						}
						href="/drivers"
						icon={Users}
						label="Drivers"
						value={drivers.length}
					/>
					<StatLink
						hint={
							nextReminder
								? `Next: ${nextReminder.title}`
								: "Nothing due right now"
						}
						icon={Bell}
						label="Upcoming"
						value={reminders.length}
					/>
				</div>
			</section>

			<section className="reveal grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
				<div>
					<p className="eyebrow">Operations</p>
					<h2 className="display-sm mt-4 max-w-[15ch]">
						Everything that matters, in one line of sight.
					</h2>
					<p className="lede mt-5 max-w-sm">
						Move from overview to detail without losing the thread. Each record
						keeps its history, so renewals never erase what came before.
					</p>
					<Link className="link-arrow mt-7 inline-flex text-sm" to="/vehicles">
						Browse the fleet
						<ArrowUpRight className="size-4" />
					</Link>
				</div>

				<div className="border-t border-border">
					{quickLinks.map((link, index) => (
						<Link
							className="group -mx-3 flex items-center gap-4 rounded-xl border-b border-border px-3 py-5 transition-colors hover:bg-muted/40 md:-mx-4 md:px-4"
							key={link.to}
							to={link.to}
						>
							<span className="hidden w-6 font-mono text-[10px] text-muted-foreground/70 sm:block">
								{String(index + 1).padStart(2, "0")}
							</span>
							<span className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-card transition-colors duration-300 group-hover:bg-foreground group-hover:text-background">
								<link.icon className="size-4" strokeWidth={1.6} />
							</span>
							<span className="min-w-0 flex-1">
								<span className="flex items-baseline gap-2">
									<span className="font-medium text-[15px] tracking-[-0.01em]">
										{link.label}
									</span>
									{link.count !== undefined ? (
										<span className="text-muted-foreground text-xs">
											{link.count} {link.unit}
										</span>
									) : null}
								</span>
								<span className="mt-0.5 block truncate text-muted-foreground text-sm">
									{link.description}
								</span>
							</span>
							<ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-[transform,color] duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-foreground" />
						</Link>
					))}
				</div>
			</section>

			<section className="reveal grid gap-6 lg:grid-cols-[1.5fr_1fr]">
				<div className="overflow-hidden rounded-2xl border border-border bg-card">
					<div className="flex items-center justify-between border-b border-border px-5 py-4">
						<div className="flex items-center gap-2.5">
							<Bell className="size-4" strokeWidth={1.7} />
							<h2 className="font-medium text-[15px] tracking-[-0.01em]">
								Upcoming
							</h2>
							{reminders.length > 0 ? (
								<span className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
									{reminders.length}
								</span>
							) : null}
						</div>
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
							Reminders
						</span>
					</div>

					{reminders.length === 0 ? (
						<div className="flex flex-col items-center px-6 py-14 text-center">
							<span className="grid size-10 place-items-center rounded-full border border-border">
								<Bell className="size-4 text-muted-foreground" />
							</span>
							<p className="mt-4 font-medium text-sm">Nothing due right now</p>
							<p className="mt-1 max-w-xs text-muted-foreground text-sm">
								Renewals appear here automatically as documents approach expiry.
							</p>
						</div>
					) : (
						<div className="divide-y divide-border">
							{reminders.slice(0, 6).map((reminder) => (
								<div
									className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
									key={reminder.id}
								>
									<div className="flex min-w-0 items-start gap-3">
										<span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-foreground/30" />
										<div className="min-w-0">
											<p className="truncate font-medium text-sm">
												{reminder.title}
											</p>
											<p className="text-muted-foreground text-xs capitalize">
												{reminder.type} · Due {formatDate(reminder.dueDate)}
											</p>
										</div>
									</div>
									<ReminderBadge dueDate={reminder.dueDate} />
								</div>
							))}
						</div>
					)}
				</div>

				<div className="overflow-hidden rounded-2xl border border-border bg-card">
					<div className="flex items-center justify-between border-b border-border px-5 py-4">
						<div className="flex items-center gap-2.5">
							<ShieldCheck className="size-4" strokeWidth={1.7} />
							<h2 className="font-medium text-[15px] tracking-[-0.01em]">
								Insurance watch
							</h2>
						</div>
						<Link
							className="link-arrow text-muted-foreground text-xs hover:text-foreground"
							to="/vehicles"
						>
							Review
							<ArrowUpRight className="size-3.5" />
						</Link>
					</div>

					{expiringInsurance.length === 0 ? (
						<div className="flex flex-col items-center px-6 py-14 text-center">
							<span className="grid size-10 place-items-center rounded-full border border-border">
								<ShieldCheck className="size-4 text-muted-foreground" />
							</span>
							<p className="mt-4 font-medium text-sm">All policies current</p>
							<p className="mt-1 max-w-[26ch] text-muted-foreground text-sm">
								No insurance is expiring within the next 30 days.
							</p>
						</div>
					) : (
						<div className="divide-y divide-border">
							{expiringInsurance.slice(0, 5).map((vehicle) => (
								<Link
									className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/30"
									key={vehicle.id}
									params={{ vehicleId: String(vehicle.id) }}
									to="/vehicles/$vehicleId"
								>
									<div>
										<p className="font-medium text-sm">
											{vehicle.registrationNumber}
										</p>
										<p className="text-muted-foreground text-xs">
											{vehicle.insuranceValidTill
												? `Expires ${formatDate(vehicle.insuranceValidTill)}`
												: "No expiry recorded"}
										</p>
									</div>
									{vehicle.insuranceValidTill ? (
										<ReminderBadge dueDate={vehicle.insuranceValidTill} />
									) : null}
								</Link>
							))}
						</div>
					)}
				</div>
			</section>
		</div>
	);
}

function StatLink({
	href,
	icon: Icon,
	label,
	value,
	hint,
}: {
	href?: AppSection;
	icon: ComponentType<{ className?: string; strokeWidth?: number }>;
	label: string;
	value: number;
	hint: string;
}): ReactNode {
	const content = (
		<>
			<span className="flex items-center justify-between">
				<span className="eyebrow">{label}</span>
				<span className="grid size-8 place-items-center rounded-full border border-transparent text-muted-foreground transition-all duration-300 group-hover:border-border group-hover:bg-foreground group-hover:text-background">
					<Icon className="size-4" strokeWidth={1.7} />
				</span>
			</span>
			<span className="mt-8 flex items-baseline gap-2">
				<AnimatedNumber
					className="font-medium text-[clamp(3rem,5vw,4.5rem)] leading-[0.85] tracking-[-0.055em]"
					value={value}
				/>
				<span className="text-muted-foreground text-sm">
					{value === 1 ? "item" : "items"}
				</span>
			</span>
			<span className="mt-3 truncate text-muted-foreground text-sm">
				{hint}
			</span>
		</>
	);

	const className =
		"group flex flex-col justify-between px-0 py-8 transition-colors md:px-8 md:py-10 md:first:pl-0 md:last:pr-0";

	if (!href) {
		return <div className={className}>{content}</div>;
	}

	return (
		<Link className={className} to={href}>
			{content}
		</Link>
	);
}

export function ReminderBadge({ dueDate }: { dueDate: Date }): ReactNode {
	const daysLeft = daysUntil(dueDate);
	if (daysLeft <= 0)
		return (
			<span className="shrink-0 rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-0.5 font-medium text-[11px] text-destructive">
				Overdue
			</span>
		);
	if (daysLeft <= 7)
		return (
			<span className="shrink-0 rounded-full border border-destructive/15 bg-destructive/10 px-2.5 py-0.5 font-medium text-[11px] text-destructive">
				{daysLeft}d left
			</span>
		);
	if (daysLeft <= 30)
		return (
			<span className="shrink-0 rounded-full border border-warning/20 bg-warning/10 px-2.5 py-0.5 font-medium text-[11px] text-warning">
				{daysLeft}d left
			</span>
		);
	return (
		<span className="shrink-0 rounded-full border border-border bg-muted px-2.5 py-0.5 font-medium text-[11px] text-muted-foreground">
			{daysLeft}d left
		</span>
	);
}
