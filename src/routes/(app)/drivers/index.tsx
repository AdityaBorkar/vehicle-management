import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/drivers/")({
	component: DriversPage,
});

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Plus, Trash2, User } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { CenteredLoader } from "#/components/centered-loader";
import { EmptyState } from "#/components/empty-state";
import { PageHeader } from "#/components/page-header";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { orpc } from "#/lib/rpc";

function DriversPage() {
	const uid = useId();
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState<DriverForm | null>(null);
	const queryClient = useQueryClient();

	const { data: driverList, isLoading } = useQuery(
		orpc.driver.list.queryOptions(),
	);
	const createMutation = useMutation(
		orpc.driver.create.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.driver.list.key() });
				setOpen(false);
				setEditing(null);
				toast.success("Driver created successfully");
			},
		}),
	);
	const updateMutation = useMutation(
		orpc.driver.update.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.driver.list.key() });
				setOpen(false);
				setEditing(null);
				toast.success("Driver updated successfully");
			},
		}),
	);
	const deleteMutation = useMutation(
		orpc.driver.remove.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.driver.list.key() });
				toast.success("Driver deleted");
			},
		}),
	);

	const drivers = driverList ?? [];

	function handleEdit(driver: (typeof drivers)[0]) {
		setEditing({
			id: driver.id,
			name: driver.name,
			phoneNumber: driver.phoneNumber ?? "",
		});
		setOpen(true);
	}

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		const data = {
			name: fd.get("name") as string,
			phoneNumber: (fd.get("phoneNumber") as string) || undefined,
		};

		if (editing?.id) {
			updateMutation.mutate({
				id: editing.id,
				...data,
				phoneNumber: data.phoneNumber || null,
			});
		} else {
			createMutation.mutate(data);
		}
	}

	if (isLoading) {
		return <CenteredLoader />;
	}

	return (
		<div className="space-y-8">
			<PageHeader
				actions={
					<Dialog
						onOpenChange={(v: boolean) => {
							setOpen(v);
							if (!v) setEditing(null);
						}}
						open={open}
					>
						<DialogTrigger
							render={
								<Button size="lg" type="button">
									<Plus className="size-4" />
									Add driver
								</Button>
							}
						/>
						<DialogContent className="sm:max-w-md">
							<DialogHeader>
								<DialogTitle>
									{editing ? "Edit Driver" : "Add Driver"}
								</DialogTitle>
								<DialogDescription>
									{editing
										? "Update driver details"
										: "Enter driver name and phone number"}
								</DialogDescription>
							</DialogHeader>
							<form className="space-y-4" onSubmit={handleSubmit}>
								<div className="space-y-2">
									<Label htmlFor={`${uid}-name`}>Name *</Label>
									<Input
										className="h-11"
										defaultValue={editing?.name ?? ""}
										id={`${uid}-name`}
										name="name"
										placeholder="John Doe"
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor={`${uid}-phoneNumber`}>Phone Number</Label>
									<Input
										className="h-11"
										defaultValue={editing?.phoneNumber ?? ""}
										id={`${uid}-phoneNumber`}
										name="phoneNumber"
										placeholder="+91 98765 43210"
									/>
								</div>
								<DialogFooter>
									<Button
										onClick={() => {
											setOpen(false);
											setEditing(null);
										}}
										type="button"
										variant="outline"
									>
										Cancel
									</Button>
									<Button
										disabled={
											createMutation.isPending || updateMutation.isPending
										}
										type="submit"
									>
										{createMutation.isPending || updateMutation.isPending
											? "Saving..."
											: editing
												? "Update"
												: "Create"}
									</Button>
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>
				}
				description="People, phone numbers and licenses. Keep every driver’s paperwork attached to the person it belongs to."
				eyebrow="Fleet / People"
				meta={
					<>
						<span>
							{drivers.length} {drivers.length === 1 ? "driver" : "drivers"} on
							record
						</span>
						<span>Licenses and Aadhar details in one profile</span>
					</>
				}
				title="Drivers"
			/>

			{drivers.length === 0 ? (
				<EmptyState
					action={
						<Button onClick={() => setOpen(true)} size="lg">
							<Plus className="size-4" />
							Add your first driver
						</Button>
					}
					description="Add a driver to keep their license, classes and Aadhar details together."
					icon={User}
					title="No drivers yet"
				/>
			) : (
				<div className="overflow-hidden rounded-2xl border border-border bg-card">
					<div className="flex items-center justify-between border-b border-border px-5 py-4">
						<p className="font-medium text-[15px] tracking-[-0.01em]">
							All drivers
						</p>
						<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
							{drivers.length} {drivers.length === 1 ? "record" : "records"}
						</p>
					</div>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Phone</TableHead>
								<TableHead className="w-10" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{drivers.map((d) => (
								<TableRow key={d.id}>
									<TableCell>
										<Link
											className="flex items-center gap-3"
											params={{ driverId: String(d.id) }}
											to="/drivers/$driverId"
										>
											<span className="grid size-8 place-items-center rounded-full border border-border bg-muted/50 font-medium text-[11px]">
												{d.name.charAt(0).toUpperCase()}
											</span>
											<span className="font-medium hover:underline">
												{d.name}
											</span>
										</Link>
									</TableCell>
									<TableCell className="text-muted-foreground">
										{d.phoneNumber || "—"}
									</TableCell>
									<TableCell>
										<DropdownMenu>
											<DropdownMenuTrigger
												aria-label={`Actions for ${d.name}`}
												render={
													<Button size="icon-xs" type="button" variant="ghost">
														<MoreHorizontal className="size-4" />
													</Button>
												}
											/>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onClick={() => handleEdit(d)}>
													<Pencil className="size-4" />
													Edit
												</DropdownMenuItem>
												<DropdownMenuItem
													className="text-destructive"
													onClick={() => deleteMutation.mutate({ id: d.id })}
												>
													<Trash2 className="size-4" />
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}

type DriverForm = {
	id?: number;
	name: string;
	phoneNumber: string;
};
