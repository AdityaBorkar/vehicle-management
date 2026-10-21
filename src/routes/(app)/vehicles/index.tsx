import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/vehicles/")({
	component: VehiclesPage,
});

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, Loader2, Plus, RefreshCw, Search, Sparkles } from "lucide-react";
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
	EMPTY_FORM,
	formToCreateInput,
	lookupRecordToForm,
	sourceLabel,
	type VehicleForm,
	vehicleRecordToForm,
} from "#/components/vehicles/vehicle-form";
import { VehiclesTable } from "#/components/vehicles/vehicles-table";
import { orpc } from "#/lib/rpc";

function VehiclesPage() {
	const uid = useId();
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
				setDraft((prev) =>
					lookupRecordToForm(
						data as unknown as Record<
							string,
							string | number | null | undefined
						> & {
							registrationNumber: string;
							year?: number | null;
						},
						prev,
					),
				);
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

	function handleEdit(vehicle: { id: number; registrationNumber: string }) {
		const form = vehicleRecordToForm(
			vehicle as unknown as Record<
				string,
				string | number | Date | null | undefined
			> & {
				id: number;
				registrationNumber: string;
			},
		);
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
		const data = formToCreateInput(draft);

		if (editing?.id) {
			updateMutation.mutate({ id: editing.id, ...data });
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
										: "Enter the vehicle number — the rest autofills from Cashfree"}
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
											dates, etc. autofill via Cashfree.
										</p>
									)}
								</div>

								{lookupMutation.isPending && (
									<div className="flex items-center gap-2 rounded-xl border border-dashed p-3 text-muted-foreground text-sm">
										<Loader2 className="size-4 animate-spin" />
										Fetching details from Cashfree for{" "}
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
											Autofill runs on Cashfree. If the lookup fails (bad
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
										<div className="space-y-2">
											<Label htmlFor={`${uid}-ownerName`}>
												Owner {hasAutofill && !isEditing && <AutofilledHint />}
											</Label>
											<Input
												id={`${uid}-ownerName`}
												onChange={(e) => set("ownerName", e.target.value)}
												value={draft.ownerName}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-fatherName`}>Father Name</Label>
											<Input
												id={`${uid}-fatherName`}
												onChange={(e) => set("fatherName", e.target.value)}
												value={draft.fatherName}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-mobileNumber`}>Mobile</Label>
											<Input
												id={`${uid}-mobileNumber`}
												onChange={(e) => set("mobileNumber", e.target.value)}
												value={draft.mobileNumber}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-vehicleClass`}>
												Vehicle Class
											</Label>
											<Input
												id={`${uid}-vehicleClass`}
												onChange={(e) => set("vehicleClass", e.target.value)}
												value={draft.vehicleClass}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-bodyType`}>Body Type</Label>
											<Input
												id={`${uid}-bodyType`}
												onChange={(e) => set("bodyType", e.target.value)}
												value={draft.bodyType}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-manufacturerModel`}>
												Manufacturer Model
											</Label>
											<Input
												id={`${uid}-manufacturerModel`}
												onChange={(e) =>
													set("manufacturerModel", e.target.value)
												}
												value={draft.manufacturerModel}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-seatingCapacity`}>Seating</Label>
											<Input
												id={`${uid}-seatingCapacity`}
												onChange={(e) => set("seatingCapacity", e.target.value)}
												value={draft.seatingCapacity}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-rtoCode`}>RTO Code</Label>
											<Input
												id={`${uid}-rtoCode`}
												onChange={(e) => set("rtoCode", e.target.value)}
												value={draft.rtoCode}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-rtoName`}>RTO Name</Label>
											<Input
												id={`${uid}-rtoName`}
												onChange={(e) => set("rtoName", e.target.value)}
												value={draft.rtoName}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-hypothecation`}>
												Hypothecation
											</Label>
											<Input
												id={`${uid}-hypothecation`}
												onChange={(e) => set("hypothecation", e.target.value)}
												value={draft.hypothecation}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-financer`}>Financer</Label>
											<Input
												id={`${uid}-financer`}
												onChange={(e) => set("financer", e.target.value)}
												value={draft.financer}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-insuranceCompany`}>Insurer</Label>
											<Input
												id={`${uid}-insuranceCompany`}
												onChange={(e) =>
													set("insuranceCompany", e.target.value)
												}
												value={draft.insuranceCompany}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-insurancePolicyNo`}>
												Policy No.
											</Label>
											<Input
												id={`${uid}-insurancePolicyNo`}
												onChange={(e) =>
													set("insurancePolicyNo", e.target.value)
												}
												value={draft.insurancePolicyNo}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-permitNumber`}>Permit No.</Label>
											<Input
												id={`${uid}-permitNumber`}
												onChange={(e) => set("permitNumber", e.target.value)}
												value={draft.permitNumber}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-permitType`}>Permit Type</Label>
											<Input
												id={`${uid}-permitType`}
												onChange={(e) => set("permitType", e.target.value)}
												value={draft.permitType}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-pucNumber`}>PUC No.</Label>
											<Input
												id={`${uid}-pucNumber`}
												onChange={(e) => set("pucNumber", e.target.value)}
												value={draft.pucNumber}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`${uid}-taxValidTill`}>
												Tax Valid Till
											</Label>
											<Input
												id={`${uid}-taxValidTill`}
												onChange={(e) => set("taxValidTill", e.target.value)}
												type="date"
												value={draft.taxValidTill}
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
				<VehiclesTable
					onDelete={(id) => deleteMutation.mutate({ id })}
					onEdit={(v) =>
						handleEdit(
							v as unknown as { id: number; registrationNumber: string },
						)
					}
					vehicles={vehicles}
				/>
			)}
		</div>
	);
}

function AutofilledHint() {
	return (
		<span className="ml-1 font-normal text-muted-foreground text-xs">
			· autofilled
		</span>
	);
}
