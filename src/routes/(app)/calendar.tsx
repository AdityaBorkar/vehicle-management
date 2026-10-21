import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowUpRight,
	BellOff,
	CalendarDays,
	Check,
	Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { CenteredLoader } from "#/components/centered-loader";
import { EmptyState } from "#/components/empty-state";
import { PageHeader } from "#/components/page-header";
import { Badge } from "#/components/ui/badge";
import { Button, buttonVariants } from "#/components/ui/button";
import { formatDate } from "#/lib/dates";
import { orpc } from "#/lib/rpc";

export const Route = createFileRoute("/(app)/calendar")({
	component: CalendarPage,
});

type CalendarReminder = {
	id: number;
	title: string;
	type: string;
	status: string | null;
	dueDate: Date;
};

function useInvalidateReminders() {
	const queryClient = useQueryClient();
	return (): void => {
		void queryClient.invalidateQueries({ queryKey: orpc.reminder.list.key() });
		void queryClient.invalidateQueries({
			queryKey: orpc.reminder.getUpcoming.key(),
		});
	};
}

function ReminderRow({
	reminder,
	dismissed,
	onDismiss,
	onRemove,
	dismissPending,
	removePending,
}: {
	reminder: CalendarReminder;
	dismissed: boolean;
	onDismiss?: (() => void) | undefined;
	onRemove: () => void;
	dismissPending: boolean;
	removePending: boolean;
}): ReactNode {
	return (
		<div
			className={`flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/30${dismissed ? " opacity-60" : ""}`}
		>
			<div className="flex min-w-0 items-start gap-3">
				<span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-foreground/30" />
				<div className="min-w-0">
					<p className="truncate font-medium text-sm">{reminder.title}</p>
					<p className="text-muted-foreground text-xs">
						{dismissed
							? `Due ${formatDate(reminder.dueDate)}`
							: `${reminder.type} · Due ${formatDate(reminder.dueDate)}`}
					</p>
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-1">
				{dismissed ? null : (
					<Badge variant="secondary">{reminder.status}</Badge>
				)}
				{dismissed || !onDismiss ? null : (
					<Button
						aria-label={`Dismiss reminder ${reminder.title}`}
						disabled={dismissPending}
						onClick={onDismiss}
						size="icon-xs"
						title="Mark as handled"
						type="button"
						variant="ghost"
					>
						<Check className="size-4" />
					</Button>
				)}
				<Button
					aria-label={`Delete reminder ${reminder.title}`}
					disabled={removePending}
					onClick={onRemove}
					size="icon-xs"
					title="Delete reminder"
					type="button"
					variant="ghost"
				>
					<Trash2 className="size-4 text-destructive" />
				</Button>
			</div>
		</div>
	);
}

function CalendarPage(): ReactNode {
	const invalidateReminders = useInvalidateReminders();
	const { data: reminderList, isLoading } = useQuery(
		orpc.reminder.list.queryOptions(),
	);

	const dismissMutation = useMutation(
		orpc.reminder.dismiss.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				invalidateReminders();
				toast.success("Reminder dismissed");
			},
		}),
	);

	const removeMutation = useMutation(
		orpc.reminder.remove.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				invalidateReminders();
				toast.success("Reminder deleted");
			},
		}),
	);

	if (isLoading) {
		return <CenteredLoader />;
	}

	const reminders: CalendarReminder[] = reminderList ?? [];
	const active = reminders.filter((r) => r.status === "active");
	const dismissed = reminders.filter((r) => r.status !== "active");

	return (
		<div className="space-y-8">
			<PageHeader
				actions={
					<Link
						className={buttonVariants({ size: "lg", variant: "outline" })}
						to="/documents"
					>
						Open document vault
						<ArrowUpRight className="size-4" />
					</Link>
				}
				description="Expiry dates, ordered by urgency. Handle what needs attention, dismiss what’s done — nothing is lost."
				eyebrow="Records / Calendar"
				meta={
					<>
						<span>{active.length} active</span>
						<span>{dismissed.length} handled</span>
					</>
				}
				title="Calendar"
			/>

			{reminders.length === 0 ? (
				<EmptyState
					description="Reminders for expiring documents appear here automatically once vehicles, licenses and policies are on file."
					icon={CalendarDays}
					title="No reminders yet"
				/>
			) : (
				<div className="space-y-10">
					<section>
						<div className="mb-3 flex items-center justify-between">
							<h2 className="eyebrow">Needs attention</h2>
							<span className="font-mono text-[10px] text-muted-foreground">
								{String(active.length).padStart(2, "0")}
							</span>
						</div>
						{active.length === 0 ? (
							<div className="rounded-2xl border border-border bg-card px-5 py-10 text-center text-muted-foreground text-sm">
								Everything is handled. Nothing needs attention right now.
							</div>
						) : (
							<div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
								{active.map((r) => (
									<ReminderRow
										dismissed={false}
										dismissPending={dismissMutation.isPending}
										key={r.id}
										onDismiss={() => dismissMutation.mutate({ id: r.id })}
										onRemove={() => removeMutation.mutate({ id: r.id })}
										reminder={r}
										removePending={removeMutation.isPending}
									/>
								))}
							</div>
						)}
					</section>

					{dismissed.length > 0 ? (
						<section>
							<h2 className="eyebrow mb-3 flex items-center gap-2">
								<BellOff className="size-3.5" />
								Handled ({dismissed.length})
							</h2>
							<div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
								{dismissed.map((r) => (
									<ReminderRow
										dismissed
										dismissPending={dismissMutation.isPending}
										key={r.id}
										onRemove={() => removeMutation.mutate({ id: r.id })}
										reminder={r}
										removePending={removeMutation.isPending}
									/>
								))}
							</div>
						</section>
					) : null}
				</div>
			)}
		</div>
	);
}
