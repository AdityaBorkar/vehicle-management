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
	RefreshCw,
	Search,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { CenteredLoader } from "#/components/centered-loader";
import { EmptyState } from "#/components/empty-state";
import { PageHeader } from "#/components/page-header";
import { PuccCertificateMenuItem } from "#/components/pucc-certificate-button";
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
	const [lookupMeta, setLookupMeta] = useState<{
		fetchedAt: string;
		source: string;
	} | null>(null);
	const [lookupError, setLookupError] = useState<string | null>(null);
	const [showManual, setShowManual] = useState(false);
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
				setLookupMeta(null);
				toast.error(err.message);
			},
			onSuccess: (data) => {
				// Already in the user's garage — do not create a duplicate.
				if (data.source === "database") {
					const message = `Vehicle "${data.registrationNumber}" already exists in your garage.`;
					setLookupMeta(null);
					setLookupError(message);
					toast.error(message);
					return;
				}
				setDraft((prev) => ({
					...prev,
					color: data.color ?? "",
					fitnessValidTill: data.fitnessValidTill ?? "",
					fuelType: data.fuelType ?? "",
					insuranceValidTill: data.insuranceValidTill ?? "",
					make: data.make ?? "",
					model: data.model ?? "",
					pollutionValidTill: data.pollutionValidTill ?? "",
					registrationDate: data.registrationDate ?? "",
					registrationNumber: data.registrationNumber,
					vin: data.vin ?? "",
					year: data.year?.toString() ?? "",
				}));
				setLookupMeta({ fetchedAt: data.fetchedAt, source: data.source });
				setLookupError(null);
				setShowManual(false);
				toast.success(`Details autofilled from ${sourceLabel(data.source)}`);
			},
		}),
	);

	const vehicles = vehicleList ?? [];
	const isEditing = editing !== null;
	const hasAutofill = lookupMeta !== null;
	const canShowFields = isEditing || hasAutofill || showManual;

	function closeDialog() {
		setOpen(false);
		setEditing(null);
		setDraft(EMPTY_FORM);
		setLookupMeta(null);
		setLookupError(null);
		setShowManual(false);
	}

	function handleAdd() {
		setEditing(null);
		setDraft(EMPTY_FORM);
		setLookupMeta(null);
		setLookupError(null);
		setShowManual(false);
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
		setLookupMeta(null);
		setLookupError(null);
		setShowManual(false);
		setOpen(true);
	}

	function set(field: keyof VehicleForm, value: string) {
		setDraft((prev) => ({ ...prev, [field]: value }));
		if (field === "registrationNumber") {
			setLookupMeta(null);
			if (!isEditing) {
				setLookupError(null);
			}
		}
	}

	function handleFetch() {
		const reg = draft.registrationNumber.trim();
		if (!reg) {
			toast.error("Enter the vehicle number first");
			return;
		}
		if (lookupMutation.isPending) return;
		setLookupError(null);
		lookupMutation.mutate({ registrationNumber: reg });
	}

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!isEditing && !hasAutofill && !showManual) {
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
										: "Enter the vehicle number — the rest autofills from APIExpress"}
								</DialogDescription>
							</DialogHeader>
							<form className="space-y-4" onSubmit={handleSubmit}>
								<div className="space-y-2">
									<Label htmlFor={`${uid}-registrationNumber`}>
										Registration Number *
									</Label>
									<div className="flex gap-2">
										<Input
											autoFocus
											className="h-12 font-mono text-base uppercase tracking-[0.06em]"
											id={`${uid}-registrationNumber`}
											onChange={(e) =>
												set("registrationNumber", e.target.value)
											}
											placeholder="MH 01 CR 7464"
											required
											value={draft.registrationNumber}
										/>
										{!isEditing && (
											<Button
												disabled={
													lookupMutation.isPending ||
													!draft.registrationNumber.trim()
												}
												onClick={handleFetch}
												type="button"
												variant="secondary"
											>
												{lookupMutation.isPending ? (
													<Loader2 className="size-4 animate-spin" />
												) : hasAutofill ? (
													<RefreshCw className="size-4" />
												) : (
													<Search className="size-4" />
												)}
												<span className="ml-2 hidden sm:inline">
													{lookupMutation.isPending
														? "Fetching..."
														: hasAutofill
															? "Re-fetch"
															: "Fetch"}
												</span>
											</Button>
										)}
									</div>
									{!isEditing && !hasAutofill && !lookupError && (
										<p className="text-muted-foreground text-xs">
											Only the vehicle number is needed. Make, model, fuel,
											dates, etc. autofill via APIExpress.
										</p>
									)}
								</div>

								{lookupMutation.isPending && (
									<div className="flex items-center gap-2 rounded-xl border border-dashed p-3 text-muted-foreground text-sm">
										<Loader2 className="size-4 animate-spin" />
										Fetching details from APIExpress for{" "}
										<span className="font-medium text-foreground">
											{draft.registrationNumber.trim()}
										</span>
										…
									</div>
								)}

								{lookupError && !isEditing && (
									<div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
										<p className="text-destructive">{lookupError}</p>
										<p className="text-muted-foreground text-xs">
											Autofill runs on APIExpress. If the lookup fails (bad
											number, no record, or provider outage), retry or enter
											details manually.
										</p>
										<Button
											onClick={() => setShowManual(true)}
											size="sm"
											type="button"
											variant="outline"
										>
											Enter details manually
										</Button>
									</div>
								)}

								{hasAutofill && !isEditing && (
									<div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/50 p-3 text-xs">
										<Badge variant="secondary">
											<Sparkles className="mr-1 size-3" />
											Autofilled via {sourceLabel(lookupMeta.source)}
										</Badge>
										<span className="text-muted-foreground">
											Fetched {new Date(lookupMeta.fetchedAt).toLocaleString()}—
											verify before saving.
										</span>
										<Button
											className="ml-auto h-7 px-2 text-xs"
											onClick={() => {
												setLookupMeta(null);
												setShowManual(true);
											}}
											type="button"
											variant="ghost"
										>
											Edit manually
										</Button>
									</div>
								)}

								{canShowFields && (
									<div className="grid gap-4 sm:grid-cols-2">
										<div className="space-y-2">
											<Label htmlFor={`${uid}-make`}>
												Make {hasAutofill && !isEditing && <AutofilledHint />}
											</Label>
											<Input
												id={`${uid}-make`}
												onChange={(e) => set("make", e.target.value)}
												placeholder="Toyota"
												value={draft.make}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-model`}>
												Model {hasAutofill && !isEditing && <AutofilledHint />}
											</Label>
											<Input
												id={`${uid}-model`}
												onChange={(e) => set("model", e.target.value)}
												placeholder="Innova"
												value={draft.model}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-year`}>
												Year {hasAutofill && !isEditing && <AutofilledHint />}
											</Label>
											<Input
												id={`${uid}-year`}
												onChange={(e) => set("year", e.target.value)}
												placeholder="2024"
												type="number"
												value={draft.year}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-color`}>
												Color {hasAutofill && !isEditing && <AutofilledHint />}
											</Label>
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
											<Label htmlFor={`${uid}-vin`}>
												VIN / Chassis Number{" "}
												{hasAutofill && !isEditing && <AutofilledHint />}
											</Label>
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
									{!isEditing && !canShowFields ? (
										<Button
											disabled={
												lookupMutation.isPending ||
												!draft.registrationNumber.trim()
											}
											type="submit"
										>
											{lookupMutation.isPending
												? "Fetching..."
												: "Fetch Details"}
										</Button>
									) : (
										<Button
											disabled={
												createMutation.isPending || updateMutation.isPending
											}
											type="submit"
										>
											{createMutation.isPending || updateMutation.isPending
												? "Saving..."
												: isEditing
													? "Update"
													: "Create"}
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
												<PuccCertificateMenuItem
													registrationNumber={v.registrationNumber}
													vehicleId={v.id}
													vin={v.vin}
												/>
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

function sourceLabel(source: string) {
	switch (source) {
		case "database":
			return "your garage";
		case "cache":
			return "cache";
		case "apiexpress":
			return "APIExpress";
		case "cashfree":
			return "Cashfree";
		default:
			return source;
	}
}

function AutofilledHint() {
	return (
		<span className="ml-1 font-normal text-muted-foreground text-xs">
			· autofilled
		</span>
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
