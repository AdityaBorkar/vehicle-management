import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/vehicles/")({
	component: VehiclesPage,
});

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Car,
	Eye,
	Loader2,
	MoreHorizontal,
	Pencil,
	Plus,
	Trash2,
} from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { CenteredLoader } from "#/components/centered-loader";
import { EmptyState } from "#/components/empty-state";
import { PageHeader } from "#/components/page-header";
import { Badge } from "#/components/ui/badge";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { orpc } from "#/lib/rpc";

const EMPTY_FORM: VehicleForm = {
	color: "",
	fitnessValidTill: "",
	fuelType: "",
	insuranceValidTill: "",
	make: "",
	model: "",
	pollutionValidTill: "",
	registrationDate: "",
	registrationNumber: "",
	vin: "",
	year: "",
};

function VehiclesPage() {
	const uid = useId();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState<VehicleForm | null>(null);
	const [draft, setDraft] = useState<VehicleForm>(EMPTY_FORM);
	const [lookupError, setLookupError] = useState<string | null>(null);
	const queryClient = useQueryClient();

	const { data: vehicleList, isLoading } = useQuery(
		orpc.vehicle.list.queryOptions(),
	);
	const createMutation = useMutation(
		orpc.vehicle.create.mutationOptions({
			onError: (err) => {
				setLookupError(err.message);
				toast.error(err.message);
			},
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.vehicle.list.key() });
				closeDialog();
				toast.success("Vehicle created successfully");
			},
		}),
	);
	const updateMutation = useMutation(
		orpc.vehicle.update.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.vehicle.list.key() });
				closeDialog();
				toast.success("Vehicle updated successfully");
			},
		}),
	);
	const deleteMutation = useMutation(
		orpc.vehicle.remove.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.vehicle.list.key() });
				toast.success("Vehicle deleted");
			},
		}),
	);
	const lookupMutation = useMutation(
		orpc.vehicle.lookup.mutationOptions({
			onError: (err) => {
				setLookupError(err.message);
				toast.error(err.message);
			},
			onSuccess: (data) => {
				// Already in the user's garage — do not create a duplicate.
				if (data.source === "database") {
					const message = `Vehicle "${data.registrationNumber}" already exists in your garage.`;
					setLookupError(message);
					toast.error(message);
					return;
				}
				// Cashfree (or cache) validated the number — auto-create.
				setLookupError(null);
				createMutation.mutate({
					color: data.color ?? undefined,
					fitnessValidTill: data.fitnessValidTill
						? new Date(data.fitnessValidTill)
						: undefined,
					fuelType: data.fuelType ?? undefined,
					insuranceValidTill: data.insuranceValidTill
						? new Date(data.insuranceValidTill)
						: undefined,
					make: data.make ?? undefined,
					model: data.model ?? undefined,
					pollutionValidTill: data.pollutionValidTill
						? new Date(data.pollutionValidTill)
						: undefined,
					registrationDate: data.registrationDate
						? new Date(data.registrationDate)
						: undefined,
					registrationNumber: data.registrationNumber,
					vin: data.vin ?? undefined,
					year: data.year ?? undefined,
				});
			},
		}),
	);

	const vehicles = vehicleList ?? [];
	const isEditing = editing !== null;
	const isSaving = lookupMutation.isPending || createMutation.isPending;

	function closeDialog() {
		setOpen(false);
		setEditing(null);
		setDraft(EMPTY_FORM);
		setLookupError(null);
	}

	function handleAdd() {
		setEditing(null);
		setDraft(EMPTY_FORM);
		setLookupError(null);
		setOpen(true);
	}

	function handleEdit(vehicle: (typeof vehicles)[0]) {
		const form: VehicleForm = {
			color: vehicle.color ?? "",
			fitnessValidTill: vehicle.fitnessValidTill
				? toDateInput(vehicle.fitnessValidTill)
				: "",
			fuelType: vehicle.fuelType ?? "",
			id: vehicle.id,
			insuranceValidTill: vehicle.insuranceValidTill
				? toDateInput(vehicle.insuranceValidTill)
				: "",
			make: vehicle.make ?? "",
			model: vehicle.model ?? "",
			pollutionValidTill: vehicle.pollutionValidTill
				? toDateInput(vehicle.pollutionValidTill)
				: "",
			registrationDate: vehicle.registrationDate
				? toDateInput(vehicle.registrationDate)
				: "",
			registrationNumber: vehicle.registrationNumber,
			vin: vehicle.vin ?? "",
			year: vehicle.year?.toString() ?? "",
		};
		setEditing(form);
		setDraft(form);
		setLookupError(null);
		setOpen(true);
	}

	function set(field: keyof VehicleForm, value: string) {
		setDraft((prev) => ({ ...prev, [field]: value }));
		if (field === "registrationNumber" && !isEditing) {
			setLookupError(null);
		}
	}

	function handleFetch() {
		const reg = draft.registrationNumber.trim();
		if (!reg) {
			toast.error("Enter the vehicle number first");
			return;
		}
		if (isSaving) return;
		setLookupError(null);
		lookupMutation.mutate({ registrationNumber: reg });
	}

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		// New flow: validate via Cashfree, then auto-create on success.
		// Failures surface as inline + toast errors.
		if (!isEditing) {
			handleFetch();
			return;
		}
		const data = {
			color: draft.color || undefined,
			fitnessValidTill: draft.fitnessValidTill
				? new Date(draft.fitnessValidTill)
				: undefined,
			fuelType: (draft.fuelType || undefined) as
				| "Diesel"
				| "Petrol"
				| "CNG"
				| "EV"
				| "Other"
				| undefined,
			insuranceValidTill: draft.insuranceValidTill
				? new Date(draft.insuranceValidTill)
				: undefined,
			make: draft.make || undefined,
			model: draft.model || undefined,
			pollutionValidTill: draft.pollutionValidTill
				? new Date(draft.pollutionValidTill)
				: undefined,
			registrationDate: draft.registrationDate
				? new Date(draft.registrationDate)
				: undefined,
			registrationNumber: draft.registrationNumber.trim(),
			vin: draft.vin.trim() || undefined,
			year: draft.year ? Number(draft.year) : undefined,
		};

		if (editing?.id) {
			updateMutation.mutate({ id: editing.id, ...data });
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
							if (v) {
								handleAdd();
							} else {
								closeDialog();
							}
						}}
						open={open}
					>
						<DialogTrigger
							render={
								<Button size="lg" type="button">
									<Plus className="size-4" />
									Add vehicle
								</Button>
							}
						/>
						<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
							<DialogHeader>
								<DialogTitle>
									{isEditing ? "Edit Vehicle" : "Add Vehicle"}
								</DialogTitle>
								<DialogDescription>
									{isEditing
										? "Update vehicle details"
										: "Enter the vehicle number — validated via Cashfree and auto-created on success"}
								</DialogDescription>
							</DialogHeader>
							<form className="space-y-4" onSubmit={handleSubmit}>
								<div className="space-y-2">
									<Label htmlFor={`${uid}-registrationNumber`}>
										Registration Number *
									</Label>
									<Input
										autoFocus
										className="h-12 font-mono text-base uppercase tracking-[0.06em]"
										id={`${uid}-registrationNumber`}
										onChange={(e) => set("registrationNumber", e.target.value)}
										placeholder="MH 01 CR 7464"
										required
										value={draft.registrationNumber}
									/>
									{!isEditing && !lookupError && !isSaving && (
										<p className="text-muted-foreground text-xs">
											Only the vehicle number is needed. It is validated via
											Cashfree and the vehicle is created automatically.
										</p>
									)}
								</div>

								{lookupMutation.isPending && (
									<div className="flex items-center gap-2 rounded-xl border border-dashed p-3 text-muted-foreground text-sm">
										<Loader2 className="size-4 animate-spin" />
										Validating{" "}
										<span className="font-medium text-foreground">
											{draft.registrationNumber.trim()}
										</span>
										with Cashfree…
									</div>
								)}

								{createMutation.isPending && (
									<div className="flex items-center gap-2 rounded-xl border border-dashed p-3 text-muted-foreground text-sm">
										<Loader2 className="size-4 animate-spin" />
										Validation successful — creating vehicle…
									</div>
								)}

								{lookupError && !isEditing && (
									<div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm">
										<p className="text-destructive">{lookupError}</p>
									</div>
								)}

								{isEditing && (
									<div className="grid gap-4 sm:grid-cols-2">
										<div className="space-y-2">
											<Label htmlFor={`${uid}-make`}>Make</Label>
											<Input
												id={`${uid}-make`}
												onChange={(e) => set("make", e.target.value)}
												placeholder="Toyota"
												value={draft.make}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-model`}>Model</Label>
											<Input
												id={`${uid}-model`}
												onChange={(e) => set("model", e.target.value)}
												placeholder="Innova"
												value={draft.model}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-year`}>Year</Label>
											<Input
												id={`${uid}-year`}
												onChange={(e) => set("year", e.target.value)}
												placeholder="2024"
												type="number"
												value={draft.year}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-color`}>Color</Label>
											<Input
												id={`${uid}-color`}
												onChange={(e) => set("color", e.target.value)}
												placeholder="White"
												value={draft.color}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-fuelType`}>Fuel Type</Label>
											<Select
												onValueChange={(v) => set("fuelType", v ?? "")}
												value={draft.fuelType || null}
											>
												<SelectTrigger
													className="w-full"
													id={`${uid}-fuelType`}
												>
													<SelectValue placeholder="Select fuel type" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="Diesel">Diesel</SelectItem>
													<SelectItem value="Petrol">Petrol</SelectItem>
													<SelectItem value="CNG">CNG</SelectItem>
													<SelectItem value="EV">EV</SelectItem>
													<SelectItem value="Other">Other</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-registrationDate`}>
												Registration Date
											</Label>
											<Input
												id={`${uid}-registrationDate`}
												onChange={(e) =>
													set("registrationDate", e.target.value)
												}
												type="date"
												value={draft.registrationDate}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-vin`}>VIN / Chassis Number</Label>
											<Input
												id={`${uid}-vin`}
												onChange={(e) => set("vin", e.target.value)}
												placeholder="MAT12345678901234"
												value={draft.vin}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-fitnessValidTill`}>
												Fitness Valid Till
											</Label>
											<Input
												id={`${uid}-fitnessValidTill`}
												onChange={(e) =>
													set("fitnessValidTill", e.target.value)
												}
												type="date"
												value={draft.fitnessValidTill}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-insuranceValidTill`}>
												Insurance Valid Till
											</Label>
											<Input
												id={`${uid}-insuranceValidTill`}
												onChange={(e) =>
													set("insuranceValidTill", e.target.value)
												}
												type="date"
												value={draft.insuranceValidTill}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-pollutionValidTill`}>
												Pollution Valid Till
											</Label>
											<Input
												id={`${uid}-pollutionValidTill`}
												onChange={(e) =>
													set("pollutionValidTill", e.target.value)
												}
												type="date"
												value={draft.pollutionValidTill}
											/>
										</div>
									</div>
								)}
								<DialogFooter>
									<Button onClick={closeDialog} type="button" variant="outline">
										Cancel
									</Button>
									{!isEditing ? (
										<Button
											disabled={isSaving || !draft.registrationNumber.trim()}
											type="submit"
										>
											{lookupMutation.isPending
												? "Validating..."
												: createMutation.isPending
													? "Creating..."
													: "Add Vehicle"}
										</Button>
									) : (
										<Button disabled={updateMutation.isPending} type="submit">
											{updateMutation.isPending ? "Saving..." : "Update"}
										</Button>
									)}
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>
				}
				description="Every registration, policy and expiry in one place. Add a number and the details fill themselves in."
				eyebrow="Fleet / Vehicles"
				meta={
					<>
						<span>
							{vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"}{" "}
							on record
						</span>
						<span>Insurance and fitness tracked automatically</span>
					</>
				}
				title="Vehicles"
			/>

			{vehicles.length === 0 ? (
				<EmptyState
					action={
						<Button onClick={handleAdd} size="lg">
							<Plus className="size-4" />
							Add your first vehicle
						</Button>
					}
					description="Just the registration number — the rest autofills from the RTO record."
					icon={Car}
					title="No vehicles yet"
				/>
			) : (
				<div className="overflow-hidden rounded-2xl border border-border bg-card">
					<div className="flex items-center justify-between border-b border-border px-5 py-4">
						<p className="font-medium text-[15px] tracking-[-0.01em]">
							All vehicles
						</p>
						<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
							{vehicles.length} {vehicles.length === 1 ? "record" : "records"}
						</p>
					</div>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Registration</TableHead>
								<TableHead>Make / Model</TableHead>
								<TableHead>Year</TableHead>
								<TableHead>Fuel</TableHead>
								<TableHead>Insurance</TableHead>
								<TableHead className="w-10" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{vehicles.map((v) => (
								<TableRow
									className="cursor-pointer"
									key={v.id}
									onClick={() =>
										navigate({
											params: { vehicleId: String(v.id) },
											to: "/vehicles/$vehicleId",
										})
									}
								>
									<TableCell className="font-medium">
										<Link
											className="font-mono text-[13px] tracking-[0.03em] hover:underline"
											onClick={(e) => e.stopPropagation()}
											params={{ vehicleId: String(v.id) }}
											to="/vehicles/$vehicleId"
										>
											{v.registrationNumber}
										</Link>
									</TableCell>
									<TableCell>
										{[v.make, v.model].filter(Boolean).join(" ") || "—"}
									</TableCell>
									<TableCell className="tabular">{v.year ?? "—"}</TableCell>
									<TableCell>
										{v.fuelType ? (
											<Badge variant="secondary">{v.fuelType}</Badge>
										) : (
											"—"
										)}
									</TableCell>
									<TableCell>
										<ExpiryBadge date={v.insuranceValidTill} />
									</TableCell>
									<TableCell onClick={(e) => e.stopPropagation()}>
										<DropdownMenu>
											<DropdownMenuTrigger
												aria-label={`Actions for ${v.registrationNumber}`}
												render={
													<Button size="icon-xs" type="button" variant="ghost">
														<MoreHorizontal className="size-4" />
													</Button>
												}
											/>
											<DropdownMenuContent align="end">
												<DropdownMenuItem
													onClick={() =>
														navigate({
															params: { vehicleId: String(v.id) },
															to: "/vehicles/$vehicleId",
														})
													}
												>
													<Eye className="size-4" />
													View details
												</DropdownMenuItem>
												<DropdownMenuItem onClick={() => handleEdit(v)}>
													<Pencil className="size-4" />
													Edit
												</DropdownMenuItem>
												<DropdownMenuItem
													className="text-destructive"
													onClick={() => deleteMutation.mutate({ id: v.id })}
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

export function ExpiryBadge({ date }: { date: Date | null }) {
	if (!date) return <span className="text-muted-foreground">—</span>;
	const daysLeft = Math.ceil(
		(date.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
	);
	if (daysLeft < 0) return <Badge variant="destructive">Expired</Badge>;
	if (daysLeft <= 30) return <Badge variant="destructive">{daysLeft}d</Badge>;
	if (daysLeft <= 90)
		return (
			<Badge
				className="border-warning/20 bg-warning/10 text-warning dark:bg-warning/10"
				variant="secondary"
			>
				{daysLeft}d
			</Badge>
		);
	return <Badge variant="secondary">{daysLeft}d</Badge>;
}

function toDateInput(date: Date | string): string {
	const d = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(d.getTime())) return "";
	return d.toISOString().slice(0, 10);
}

type VehicleForm = {
	id?: number;
	registrationNumber: string;
	make: string;
	model: string;
	year: string;
	color: string;
	fuelType: string;
	registrationDate: string;
	vin: string;
	fitnessValidTill: string;
	insuranceValidTill: string;
	pollutionValidTill: string;
};
