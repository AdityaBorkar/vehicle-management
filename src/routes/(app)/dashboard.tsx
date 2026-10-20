import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Car, Plus, Users } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { buttonVariants } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { daysUntil, formatDate } from "#/lib/dates";
import { orpc } from "#/lib/rpc";

export const Route = createFileRoute("/(app)/dashboard")({
	component: Dashboard,
});

type StatCardProps = {
	icon: ComponentType<{ className?: string }>;
	title: string;
	value: ReactNode;
	hint?: ReactNode | undefined;
};

function StatCard({
	icon: Icon,
	title,
	value,
	hint,
}: StatCardProps): ReactNode {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="font-medium text-sm">{title}</CardTitle>
				<Icon className="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div className="font-bold text-2xl">{value}</div>
				{hint}
			</CardContent>
		</Card>
	);
}

function isExpiringSoon(insuranceValidTill: Date | null): boolean {
	if (!insuranceValidTill) return false;
	const daysLeft = daysUntil(insuranceValidTill);
	return daysLeft <= 30 && daysLeft >= 0;
}

function Dashboard(): ReactNode {
	const { data: vehicleList } = useQuery(orpc.vehicle.list.queryOptions());
	const { data: driverList } = useQuery(orpc.driver.list.queryOptions());
	const { data: upcomingReminders } = useQuery(
		orpc.reminder.getUpcoming.queryOptions(),
	);

	const vehicles = vehicleList ?? [];
	const drivers = driverList ?? [];
	const reminders = upcomingReminders ?? [];

	const expiringInsurance = vehicles.filter((v) =>
		isExpiringSoon(v.insuranceValidTill),
	);
	const nextReminder = reminders[0];

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="font-bold text-2xl">Dashboard</h1>
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				<StatCard
					hint={
						expiringInsurance.length > 0 ? (
							<p className="text-destructive text-xs">
								{expiringInsurance.length} insurance expiring soon
							</p>
						) : undefined
					}
					icon={Car}
					title="Vehicles"
					value={vehicles.length}
				/>
				<StatCard icon={Users} title="Drivers" value={drivers.length} />
				<StatCard
					hint={
						nextReminder ? (
							<p className="text-muted-foreground text-xs">
								Next: {nextReminder.title}
							</p>
						) : undefined
					}
					icon={Bell}
					title="Upcoming Reminders"
					value={reminders.length}
				/>
			</div>

			{vehicles.length === 0 && drivers.length === 0 && (
				<Card>
					<CardContent className="flex flex-col items-center gap-4 py-12">
						<Car className="h-12 w-12 text-muted-foreground" />
						<div className="text-center">
							<h2 className="font-semibold text-lg">Get Started</h2>
							<p className="text-muted-foreground text-sm">
								Add your first vehicle or driver to get started
							</p>
						</div>
						<div className="flex gap-3">
							<Link className={buttonVariants()} to="/vehicles">
								<Plus className="mr-2 h-4 w-4" />
								Add Vehicle
							</Link>
							<Link
								className={buttonVariants({ variant: "outline" })}
								to="/drivers"
							>
								<Plus className="mr-2 h-4 w-4" />
								Add Driver
							</Link>
						</div>
					</CardContent>
				</Card>
			)}

			{reminders.length > 0 && (
				<div>
					<h2 className="mb-3 font-semibold text-lg">Upcoming Reminders</h2>
					<div className="space-y-2">
						{reminders.slice(0, 5).map((r) => (
							<Card key={r.id}>
								<CardContent className="flex items-center justify-between py-3">
									<div>
										<p className="font-medium text-sm">{r.title}</p>
										<p className="text-muted-foreground text-xs">
											{r.type} &middot; Due {formatDate(r.dueDate)}
										</p>
									</div>
									<ReminderBadge dueDate={r.dueDate} />
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

export function ReminderBadge({ dueDate }: { dueDate: Date }): ReactNode {
	const daysLeft = daysUntil(dueDate);
	if (daysLeft <= 0)
		return (
			<span className="rounded bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs">
				Overdue
			</span>
		);
	if (daysLeft <= 3)
		return (
			<span className="rounded bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs">
				{daysLeft}d left
			</span>
		);
	if (daysLeft <= 7)
		return (
			<span className="rounded bg-yellow-500/10 px-2 py-0.5 font-medium text-xs text-yellow-600 dark:text-yellow-400">
				{daysLeft}d left
			</span>
		);
	return (
		<span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
			{daysLeft}d left
		</span>
	);
}
