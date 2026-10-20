import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CreditCard, Pencil, Plus, Trash2, X } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { CenteredLoader } from "#/components/centered-loader";
import { Badge } from "#/components/ui/badge";
import { Button, buttonVariants } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { orpc } from "#/lib/rpc";

export const Route = createFileRoute("/(app)/drivers/$driverId")({
	component: DriverDetailPage,
});

function DriverDetailPage() {
	const driverId = Number(Route.useParams().driverId);
	const queryClient = useQueryClient();

	const { data: driver, isLoading } = useQuery(
		orpc.driver.getById.queryOptions({ input: { id: driverId } }),
	);

	const deleteDriverMutation = useMutation(
		orpc.driver.remove.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.driver.list.key() });
				toast.success("Driver deleted");
			},
		}),
	);

	if (isLoading) {
		return <CenteredLoader />;
	}

	if (!driver) {
		return (
			<div className="py-12 text-center">
				<p className="text-muted-foreground">Driver not found</p>
				<Link
					className="mt-2 inline-block text-primary text-sm hover:underline"
					to="/drivers"
				>
					Back to Drivers
				</Link>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Link
						aria-label="Back to drivers"
						className={buttonVariants({ size: "icon", variant: "ghost" })}
						to="/drivers"
					>
						<ArrowLeft className="h-4 w-4" />
					</Link>
					<h1 className="font-bold text-2xl">{driver.name}</h1>
					{driver.phoneNumber && (
						<Badge variant="secondary">{driver.phoneNumber}</Badge>
					)}
				</div>
				<Button
					disabled={deleteDriverMutation.isPending}
					onClick={() => deleteDriverMutation.mutate({ id: driver.id })}
					size="sm"
					type="button"
					variant="destructive"
				>
					<Trash2 className="mr-2 h-4 w-4" />
					Delete
				</Button>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<DriverInfoCard driver={driver} />
				<AadharCardSection
					aadharCard={driver.aadharCard}
					driverId={driver.id}
				/>
			</div>

			<DrivingLicenseSection driverId={driver.id} />
		</div>
	);
}

function DriverInfoCard({
	driver,
}: {
	driver: { id: number; name: string; phoneNumber: string | null };
}) {
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(driver.name);
	const [phone, setPhone] = useState(driver.phoneNumber ?? "");
	const queryClient = useQueryClient();

	const updateMutation = useMutation(
		orpc.driver.update.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.driver.getById.key({ input: { id: driver.id } }),
				});
				setEditing(false);
				toast.success("Driver updated");
			},
		}),
	);

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<CardTitle className="text-base">Driver Info</CardTitle>
				{!editing && (
					<Button
						aria-label="Edit driver info"
						onClick={() => setEditing(true)}
						size="icon-xs"
						type="button"
						variant="ghost"
					>
						<Pencil className="h-4 w-4" />
					</Button>
				)}
			</CardHeader>
			<CardContent className="space-y-2 text-sm">
				{editing ? (
					<form
						className="space-y-3"
						onSubmit={(e) => {
							e.preventDefault();
							updateMutation.mutate({
								id: driver.id,
								name,
								phoneNumber: phone || null,
							});
						}}
					>
						<div className="space-y-1">
							<Label>Name</Label>
							<Input onChange={(e) => setName(e.target.value)} value={name} />
						</div>
						<div className="space-y-1">
							<Label>Phone</Label>
							<Input onChange={(e) => setPhone(e.target.value)} value={phone} />
						</div>
						<div className="flex gap-2">
							<Button
								disabled={updateMutation.isPending}
								size="sm"
								type="submit"
							>
								Save
							</Button>
							<Button
								onClick={() => setEditing(false)}
								size="sm"
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
						</div>
					</form>
				) : (
					<>
						<DetailRow label="Name" value={driver.name} />
						<DetailRow label="Phone" value={driver.phoneNumber} />
					</>
				)}
			</CardContent>
		</Card>
	);
}

function AadharCardSection({
	driverId,
	aadharCard,
}: {
	driverId: number;
	aadharCard: {
		id: number;
		aadharNumber: string;
		address: string | null;
		dateOfBirth: Date | null;
		gender: string | null;
		driverId: number;
		createdAt: Date | null;
		updatedAt: Date | null;
	} | null;
}) {
	const uid = useId();
	const [open, setOpen] = useState(false);
	const queryClient = useQueryClient();

	const createMutation = useMutation(
		orpc.aadharCard.create.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.driver.getById.key({ input: { id: driverId } }),
				});
				setOpen(false);
				toast.success("Aadhar card added");
			},
		}),
	);

	const updateMutation = useMutation(
		orpc.aadharCard.update.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.driver.getById.key({ input: { id: driverId } }),
				});
				setOpen(false);
				toast.success("Aadhar card updated");
			},
		}),
	);

	const removeMutation = useMutation(
		orpc.aadharCard.remove.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.driver.getById.key({ input: { id: driverId } }),
				});
				toast.success("Aadhar card removed");
			},
		}),
	);

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		const data = {
			aadharNumber: fd.get("aadharNumber") as string,
			address: (fd.get("address") as string) || undefined,
			dateOfBirth: fd.get("dateOfBirth")
				? new Date(fd.get("dateOfBirth") as string)
				: undefined,
			driverId,
			gender: ((fd.get("gender") as string) || undefined) as
				| "Male"
				| "Female"
				| "Other"
				| undefined,
		};

		if (aadharCard) {
			updateMutation.mutate({
				...data,
				dateOfBirth: data.dateOfBirth ?? null,
				gender: data.gender ?? null,
				id: aadharCard.id,
			});
		} else {
			createMutation.mutate(data);
		}
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<CardTitle className="text-base">Aadhar Card</CardTitle>
				<div className="flex gap-1">
					{aadharCard && (
						<>
							<Button
								aria-label="Edit Aadhar card"
								onClick={() => setOpen(true)}
								size="icon-xs"
								type="button"
								variant="ghost"
							>
								<Pencil className="h-4 w-4" />
							</Button>
							<Button
								aria-label="Remove Aadhar card"
								onClick={() => removeMutation.mutate({ id: aadharCard.id })}
								size="icon-xs"
								type="button"
								variant="ghost"
							>
								<Trash2 className="h-4 w-4 text-destructive" />
							</Button>
						</>
					)}
					{!aadharCard && (
						<Button
							onClick={() => setOpen(true)}
							size="xs"
							type="button"
							variant="outline"
						>
							<Plus className="mr-1 h-3 w-3" />
							Add
						</Button>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-2 text-sm">
				{aadharCard ? (
					<>
						<DetailRow label="Aadhar Number" value={aadharCard.aadharNumber} />
						<DetailRow
							label="Date of Birth"
							value={formatDate(aadharCard.dateOfBirth)}
						/>
						<DetailRow label="Gender" value={aadharCard.gender} />
						<DetailRow label="Address" value={aadharCard.address} />
					</>
				) : (
					<p className="text-muted-foreground">No Aadhar card linked</p>
				)}
			</CardContent>

			<Dialog
				onOpenChange={(v) => {
					setOpen(v);
				}}
				open={open}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{aadharCard ? "Edit Aadhar Card" : "Add Aadhar Card"}
						</DialogTitle>
						<DialogDescription>
							{aadharCard
								? "Update Aadhar card details"
								: "Enter Aadhar card details"}
						</DialogDescription>
					</DialogHeader>
					<form className="space-y-4" onSubmit={handleSubmit}>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2 sm:col-span-2">
								<Label htmlFor={`${uid}-aadharNumber`}>Aadhar Number *</Label>
								<Input
									defaultValue={aadharCard?.aadharNumber ?? ""}
									id={`${uid}-aadharNumber`}
									name="aadharNumber"
									placeholder="1234 5678 9012"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor={`${uid}-dateOfBirth`}>Date of Birth</Label>
								<Input
									defaultValue={
										aadharCard?.dateOfBirth
											? toDateInput(aadharCard.dateOfBirth)
											: ""
									}
									id={`${uid}-dateOfBirth`}
									name="dateOfBirth"
									type="date"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor={`${uid}-gender`}>Gender</Label>
								<Select defaultValue={aadharCard?.gender ?? ""} name="gender">
									<SelectTrigger>
										<SelectValue placeholder="Select" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="Male">Male</SelectItem>
										<SelectItem value="Female">Female</SelectItem>
										<SelectItem value="Other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2 sm:col-span-2">
								<Label htmlFor={`${uid}-address`}>Address</Label>
								<Input
									defaultValue={aadharCard?.address ?? ""}
									id={`${uid}-address`}
									name="address"
									placeholder="123 Main St, City, State"
								/>
							</div>
						</div>
						<DialogFooter>
							<Button
								onClick={() => setOpen(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								disabled={createMutation.isPending || updateMutation.isPending}
								type="submit"
							>
								{createMutation.isPending || updateMutation.isPending
									? "Saving..."
									: aadharCard
										? "Update"
										: "Add"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</Card>
	);
}

function DrivingLicenseSection({ driverId }: { driverId: number }) {
	const { data: licenses } = useQuery(
		orpc.license.list.queryOptions({ input: { driverId } }),
	);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="font-semibold text-lg">Driving Licenses</h2>
				<AddLicenseDialog driverId={driverId} />
			</div>

			{(licenses ?? []).length === 0 ? (
				<Card>
					<CardContent className="flex items-center gap-3 py-8">
						<CreditCard className="h-8 w-8 text-muted-foreground" />
						<p className="text-muted-foreground text-sm">
							No driving licenses added yet
						</p>
					</CardContent>
				</Card>
			) : (
				(licenses ?? []).map((license) => (
					<LicenseCard driverId={driverId} key={license.id} license={license} />
				))
			)}
		</div>
	);
}

function LicenseCard({
	driverId,
	license,
}: {
	driverId: number;
	license: {
		id: number;
		licenseNumber: string;
		holderName: string;
		bloodGroup: string | null;
		dateOfBirth: Date | null;
		address: string | null;
		issueDate: Date | null;
		driverId: number;
		createdAt: Date | null;
		updatedAt: Date | null;
		vehicleClasses: {
			id: number;
			vehicleClass: string;
			expiryDate: Date;
			licenseId: number;
			createdAt: Date | null;
			updatedAt: Date | null;
		}[];
	};
}) {
	const queryClient = useQueryClient();
	const [editOpen, setEditOpen] = useState(false);
	const [classDialogOpen, setClassDialogOpen] = useState(false);

	const updateMutation = useMutation(
		orpc.license.update.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.license.list.key({ input: { driverId } }),
				});
				setEditOpen(false);
				toast.success("License updated");
			},
		}),
	);

	const removeMutation = useMutation(
		orpc.license.remove.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.license.list.key({ input: { driverId } }),
				});
				toast.success("License deleted");
			},
		}),
	);

	const addClassMutation = useMutation(
		orpc.license.addClass.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.license.list.key({ input: { driverId } }),
				});
				setClassDialogOpen(false);
				toast.success("Vehicle class added");
			},
		}),
	);

	const removeClassMutation = useMutation(
		orpc.license.removeClass.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.license.list.key({ input: { driverId } }),
				});
				toast.success("Vehicle class removed");
			},
		}),
	);

	function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		updateMutation.mutate({
			address: (fd.get("address") as string) || undefined,
			bloodGroup: ((fd.get("bloodGroup") as string) || undefined) as
				| "A+"
				| "A-"
				| "B+"
				| "B-"
				| "AB+"
				| "AB-"
				| "O+"
				| "O-"
				| undefined,
			dateOfBirth: fd.get("dateOfBirth")
				? new Date(fd.get("dateOfBirth") as string)
				: null,
			holderName: fd.get("holderName") as string,
			id: license.id,
			issueDate: fd.get("issueDate")
				? new Date(fd.get("issueDate") as string)
				: null,
			licenseNumber: fd.get("licenseNumber") as string,
		});
	}

	function handleAddClass(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		addClassMutation.mutate({
			expiryDate: new Date(fd.get("expiryDate") as string),
			licenseId: license.id,
			vehicleClass: fd.get("vehicleClass") as string,
		});
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle className="text-base">{license.licenseNumber}</CardTitle>
					<p className="text-muted-foreground text-sm">{license.holderName}</p>
				</div>
				<div className="flex gap-1">
					<Button
						aria-label={`Edit license ${license.licenseNumber}`}
						onClick={() => setEditOpen(true)}
						size="icon-xs"
						type="button"
						variant="ghost"
					>
						<Pencil className="h-4 w-4" />
					</Button>
					<Button
						aria-label={`Delete license ${license.licenseNumber}`}
						onClick={() => removeMutation.mutate({ id: license.id })}
						size="icon-xs"
						type="button"
						variant="ghost"
					>
						<Trash2 className="h-4 w-4 text-destructive" />
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				<div className="mb-4 grid gap-2 text-sm sm:grid-cols-3">
					<DetailRow label="Blood Group" value={license.bloodGroup} />
					<DetailRow label="Issue Date" value={formatDate(license.issueDate)} />
					<DetailRow label="DOB" value={formatDate(license.dateOfBirth)} />
				</div>

				<div className="flex items-center justify-between">
					<h3 className="font-medium text-sm">Vehicle Classes</h3>
					<Button
						onClick={() => setClassDialogOpen(true)}
						size="xs"
						type="button"
						variant="outline"
					>
						<Plus className="mr-1 h-3 w-3" />
						Add Class
					</Button>
				</div>

				{license.vehicleClasses.length === 0 ? (
					<p className="mt-2 text-muted-foreground text-sm">
						No vehicle classes added
					</p>
				) : (
					<Table className="mt-2">
						<TableHeader>
							<TableRow>
								<TableHead>Class</TableHead>
								<TableHead>Expiry Date</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="w-10" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{license.vehicleClasses.map((vc) => (
								<TableRow key={vc.id}>
									<TableCell className="font-medium">
										{vc.vehicleClass}
									</TableCell>
									<TableCell>{formatDate(vc.expiryDate)}</TableCell>
									<TableCell>
										<DlExpiryBadge date={vc.expiryDate} />
									</TableCell>
									<TableCell>
										<Button
											aria-label={`Remove vehicle class ${vc.vehicleClass}`}
											onClick={() => removeClassMutation.mutate({ id: vc.id })}
											size="icon-xs"
											type="button"
											variant="ghost"
										>
											<X className="h-3 w-3 text-destructive" />
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>

			<Dialog onOpenChange={setEditOpen} open={editOpen}>
				<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Edit License</DialogTitle>
						<DialogDescription>
							Update driving license details
						</DialogDescription>
					</DialogHeader>
					<form className="space-y-4" onSubmit={handleEditSubmit}>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2 sm:col-span-2">
								<Label>License Number *</Label>
								<Input
									defaultValue={license.licenseNumber}
									name="licenseNumber"
									required
								/>
							</div>
							<div className="space-y-2 sm:col-span-2">
								<Label>Holder Name *</Label>
								<Input
									defaultValue={license.holderName}
									name="holderName"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label>Date of Birth</Label>
								<Input
									defaultValue={
										license.dateOfBirth ? toDateInput(license.dateOfBirth) : ""
									}
									name="dateOfBirth"
									type="date"
								/>
							</div>
							<div className="space-y-2">
								<Label>Blood Group</Label>
								<Select
									defaultValue={license.bloodGroup ?? ""}
									name="bloodGroup"
								>
									<SelectTrigger>
										<SelectValue placeholder="Select" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="A+">A+</SelectItem>
										<SelectItem value="A-">A-</SelectItem>
										<SelectItem value="B+">B+</SelectItem>
										<SelectItem value="B-">B-</SelectItem>
										<SelectItem value="AB+">AB+</SelectItem>
										<SelectItem value="AB-">AB-</SelectItem>
										<SelectItem value="O+">O+</SelectItem>
										<SelectItem value="O-">O-</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2 sm:col-span-2">
								<Label>Address</Label>
								<Input defaultValue={license.address ?? ""} name="address" />
							</div>
							<div className="space-y-2">
								<Label>Issue Date</Label>
								<Input
									defaultValue={
										license.issueDate ? toDateInput(license.issueDate) : ""
									}
									name="issueDate"
									type="date"
								/>
							</div>
						</div>
						<DialogFooter>
							<Button
								onClick={() => setEditOpen(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button disabled={updateMutation.isPending} type="submit">
								{updateMutation.isPending ? "Saving..." : "Update"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog onOpenChange={setClassDialogOpen} open={classDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Add Vehicle Class</DialogTitle>
						<DialogDescription>
							Add a vehicle class with its expiry date
						</DialogDescription>
					</DialogHeader>
					<form className="space-y-4" onSubmit={handleAddClass}>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label>Vehicle Class *</Label>
								<Input
									name="vehicleClass"
									placeholder="LMV, MCWG, HGV"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label>Expiry Date *</Label>
								<Input name="expiryDate" required type="date" />
							</div>
						</div>
						<DialogFooter>
							<Button
								onClick={() => setClassDialogOpen(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button disabled={addClassMutation.isPending} type="submit">
								{addClassMutation.isPending ? "Adding..." : "Add Class"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</Card>
	);
}

function AddLicenseDialog({ driverId }: { driverId: number }) {
	const uid = useId();
	const [open, setOpen] = useState(false);
	const queryClient = useQueryClient();

	const createMutation = useMutation(
		orpc.license.create.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.license.list.key({ input: { driverId } }),
				});
				setOpen(false);
				toast.success("License added");
			},
		}),
	);

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		const classes: { vehicleClass: string; expiryDate: Date }[] = [];
		const classStr = fd.get("vehicleClass") as string;
		const expiryStr = fd.get("expiryDate") as string;

		if (classStr && expiryStr) {
			classes.push({ expiryDate: new Date(expiryStr), vehicleClass: classStr });
		}

		createMutation.mutate({
			address: (fd.get("address") as string) || undefined,
			bloodGroup: ((fd.get("bloodGroup") as string) || undefined) as
				| "A+"
				| "A-"
				| "B+"
				| "B-"
				| "AB+"
				| "AB-"
				| "O+"
				| "O-"
				| undefined,
			dateOfBirth: fd.get("dateOfBirth")
				? new Date(fd.get("dateOfBirth") as string)
				: undefined,
			driverId,
			holderName: fd.get("holderName") as string,
			issueDate: fd.get("issueDate")
				? new Date(fd.get("issueDate") as string)
				: undefined,
			licenseNumber: fd.get("licenseNumber") as string,
			vehicleClasses: classes.length > 0 ? classes : undefined,
		});
	}

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogTrigger
				render={
					<Button size="sm" type="button">
						<Plus className="mr-2 h-4 w-4" />
						Add License
					</Button>
				}
			/>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add Driving License</DialogTitle>
					<DialogDescription>Enter driving license details</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor={`${uid}-licenseNumber`}>License Number *</Label>
							<Input
								id={`${uid}-licenseNumber`}
								name="licenseNumber"
								placeholder="MH0120180123456"
								required
							/>
						</div>
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor={`${uid}-holderName`}>Holder Name *</Label>
							<Input
								id={`${uid}-holderName`}
								name="holderName"
								placeholder="John Doe"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${uid}-dateOfBirth`}>Date of Birth</Label>
							<Input id={`${uid}-dateOfBirth`} name="dateOfBirth" type="date" />
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${uid}-bloodGroup`}>Blood Group</Label>
							<Select name="bloodGroup">
								<SelectTrigger>
									<SelectValue placeholder="Select" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="A+">A+</SelectItem>
									<SelectItem value="A-">A-</SelectItem>
									<SelectItem value="B+">B+</SelectItem>
									<SelectItem value="B-">B-</SelectItem>
									<SelectItem value="AB+">AB+</SelectItem>
									<SelectItem value="AB-">AB-</SelectItem>
									<SelectItem value="O+">O+</SelectItem>
									<SelectItem value="O-">O-</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor={`${uid}-address`}>Address</Label>
							<Input
								id={`${uid}-address`}
								name="address"
								placeholder="123 Main St, City"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${uid}-issueDate`}>Issue Date</Label>
							<Input id={`${uid}-issueDate`} name="issueDate" type="date" />
						</div>
						<div className="border-t pt-4 sm:col-span-2">
							<p className="mb-3 font-medium text-sm">
								First Vehicle Class (add more after creation)
							</p>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor={`${uid}-vehicleClass`}>Vehicle Class</Label>
									<Input
										id={`${uid}-vehicleClass`}
										name="vehicleClass"
										placeholder="LMV, MCWG"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor={`${uid}-expiryDate`}>Expiry Date</Label>
									<Input
										id={`${uid}-expiryDate`}
										name="expiryDate"
										type="date"
									/>
								</div>
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button
							onClick={() => setOpen(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button disabled={createMutation.isPending} type="submit">
							{createMutation.isPending ? "Saving..." : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export function DetailRow({
	label,
	value,
}: {
	label: string;
	value?: string | null;
}) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-muted-foreground">{label}</span>
			<span>{value || "—"}</span>
		</div>
	);
}

export function DlExpiryBadge({ date }: { date: Date }) {
	const daysLeft = Math.ceil(
		(date.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
	);
	if (daysLeft < 0) return <Badge variant="destructive">Expired</Badge>;
	if (daysLeft <= 30) return <Badge variant="destructive">{daysLeft}d</Badge>;
	if (daysLeft <= 90)
		return (
			<Badge
				className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
				variant="secondary"
			>
				{daysLeft}d
			</Badge>
		);
	return <Badge variant="secondary">{daysLeft}d</Badge>;
}

function formatDate(date: Date | null | undefined) {
	if (!date) return null;
	return new Date(date).toLocaleDateString();
}

function toDateInput(date: Date): string {
	return date.toISOString().slice(0, 10);
}
