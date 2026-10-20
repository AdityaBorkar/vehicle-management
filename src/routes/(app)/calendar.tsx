import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BellOff, CalendarDays, Check, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { CenteredLoader } from "#/components/centered-loader";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
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

function ReminderCard({
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
		<Card>
			<CardContent
				className={`flex items-center justify-between gap-3 py-3${dismissed ? " opacity-70" : ""}`}
			>
				<div className="min-w-0">
					<p className="truncate font-medium text-sm">{reminder.title}</p>
					<p className="text-muted-foreground text-xs">
						{dismissed
							? `Due ${formatDate(reminder.dueDate)}`
							: `${reminder.type} · Due ${formatDate(reminder.dueDate)}`}
					</p>
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
							type="button"
							variant="ghost"
						>
							<Check className="h-4 w-4" />
						</Button>
					)}
					<Button
						aria-label={`Delete reminder ${reminder.title}`}
						disabled={removePending}
						onClick={onRemove}
						size="icon-xs"
						type="button"
						variant="ghost"
					>
						<Trash2 className="h-4 w-4 text-destructive" />
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function EmptyCalendar(): ReactNode {
	return (
		<Card>
			<CardContent className="flex flex-col items-center gap-4 py-12">
				<CalendarDays className="h-12 w-12 text-muted-foreground" />
				<div className="text-center">
					<h2 className="font-semibold text-lg">No reminders yet</h2>
					<p className="text-muted-foreground text-sm">
						Reminders for expiring documents appear here automatically
					</p>
				</div>
			</CardContent>
		</Card>
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

	if (reminders.length === 0) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<h1 className="font-bold text-2xl">Calendar</h1>
				</div>
				<EmptyCalendar />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="font-bold text-2xl">Calendar</h1>
			</div>

			<div className="space-y-2">
				{active.map((r) => (
					<ReminderCard
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

			{dismissed.length > 0 && (
				<div className="space-y-2">
					<h2 className="flex items-center gap-2 font-semibold text-muted-foreground text-sm">
						<BellOff className="h-4 w-4" />
						Dismissed ({dismissed.length})
					</h2>
					{dismissed.map((r) => (
						<ReminderCard
							dismissed
							dismissPending={dismissMutation.isPending}
							key={r.id}
							onRemove={() => removeMutation.mutate({ id: r.id })}
							reminder={r}
							removePending={removeMutation.isPending}
						/>
					))}
				</div>
			)}
		</div>
	);
}
