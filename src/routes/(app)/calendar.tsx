import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BellOff, CalendarDays, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { orpc } from "#/lib/rpc";

export const Route = createFileRoute("/(app)/calendar")({
	component: CalendarPage,
});

function CalendarPage() {
	const queryClient = useQueryClient();
	const { data: reminderList, isLoading } = useQuery(
		orpc.reminder.list.queryOptions(),
	);

	const dismissMutation = useMutation(
		orpc.reminder.dismiss.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.reminder.list.key() });
				queryClient.invalidateQueries({
					queryKey: orpc.reminder.getUpcoming.key(),
				});
				toast.success("Reminder dismissed");
			},
		}),
	);

	const removeMutation = useMutation(
		orpc.reminder.remove.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.reminder.list.key() });
				queryClient.invalidateQueries({
					queryKey: orpc.reminder.getUpcoming.key(),
				});
				toast.success("Reminder deleted");
			},
		}),
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
			</div>
		);
	}

	const reminders = reminderList ?? [];
	const active = reminders.filter((r) => r.status === "active");
	const dismissed = reminders.filter((r) => r.status !== "active");

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="font-bold text-2xl">Calendar</h1>
			</div>

			{reminders.length === 0 ? (
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
			) : (
				<>
					<div className="space-y-2">
						{active.map((r) => (
							<Card key={r.id}>
								<CardContent className="flex items-center justify-between gap-3 py-3">
									<div className="min-w-0">
										<p className="truncate font-medium text-sm">{r.title}</p>
										<p className="text-muted-foreground text-xs">
											{r.type} &middot; Due{" "}
											{new Date(r.dueDate).toLocaleDateString()}
										</p>
									</div>
									<div className="flex shrink-0 items-center gap-1">
										<Badge variant="secondary">{r.status}</Badge>
										<Button
											aria-label={`Dismiss reminder ${r.title}`}
											disabled={dismissMutation.isPending}
											onClick={() => dismissMutation.mutate({ id: r.id })}
											size="icon-xs"
											type="button"
											variant="ghost"
										>
											<Check className="h-4 w-4" />
										</Button>
										<Button
											aria-label={`Delete reminder ${r.title}`}
											disabled={removeMutation.isPending}
											onClick={() => removeMutation.mutate({ id: r.id })}
											size="icon-xs"
											type="button"
											variant="ghost"
										>
											<Trash2 className="h-4 w-4 text-destructive" />
										</Button>
									</div>
								</CardContent>
							</Card>
						))}
					</div>

					{dismissed.length > 0 && (
						<div className="space-y-2">
							<h2 className="flex items-center gap-2 font-semibold text-muted-foreground text-sm">
								<BellOff className="h-4 w-4" />
								Dismissed ({dismissed.length})
							</h2>
							{dismissed.map((r) => (
								<Card key={r.id}>
									<CardContent className="flex items-center justify-between gap-3 py-3 opacity-70">
										<div className="min-w-0">
											<p className="truncate font-medium text-sm">{r.title}</p>
											<p className="text-muted-foreground text-xs">
												Due {new Date(r.dueDate).toLocaleDateString()}
											</p>
										</div>
										<Button
											aria-label={`Delete reminder ${r.title}`}
											disabled={removeMutation.isPending}
											onClick={() => removeMutation.mutate({ id: r.id })}
											size="icon-xs"
											type="button"
											variant="ghost"
										>
											<Trash2 className="h-4 w-4 text-destructive" />
										</Button>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
}
