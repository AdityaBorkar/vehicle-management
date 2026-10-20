import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/documents/")({
	component: DocumentsPage,
});

import type { RouterClient } from "@orpc/server";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, FileText, Plus, RefreshCw, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { CenteredLoader } from "#/components/centered-loader";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
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
import type { Router } from "#/rpc/router";

type DocItem = Awaited<
	ReturnType<RouterClient<Router>["document"]["list"]>
>[number];

const KIND_LABELS: Record<string, string> = {
	aadhar: "Aadhar",
	dl_class: "DL Class",
	driving_license: "Driving License",
	fitness: "Fitness",
	insurance: "Insurance",
	other: "Other",
	permit: "Permit",
	pollution: "Pollution (PUC)",
	registration: "Registration (RC)",
	tax: "Tax",
};

const KIND_OPTIONS = [
	"insurance",
	"fitness",
	"pollution",
	"registration",
	"permit",
	"tax",
	"driving_license",
	"dl_class",
	"aadhar",
	"other",
] as const;

const VEHICLE_EXPIRY_FIELDS = {
	fitness: "fitnessValidTill",
	insurance: "insuranceValidTill",
	pollution: "pollutionValidTill",
} as const;

type DisplayStatus =
	| "valid"
	| "expiring"
	| "expired"
	| "no-expiry"
	| "superseded"
	| "archived";

function daysLeft(expiry: Date): number {
	return Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getDisplayStatus(doc: DocItem): DisplayStatus {
	if (doc.status === "archived") return "archived";
	if (doc.status === "superseded" || !doc.isCurrent) return "superseded";
	if (!doc.expiryDate) return "no-expiry";
	const left = daysLeft(doc.expiryDate);
	if (left < 0) return "expired";
	if (left <= 30) return "expiring";
	return "valid";
}

function canRenew(doc: DocItem): boolean {
	if (doc.source === "stored") {
		return doc.isCurrent && doc.status === "active" && doc.storedId !== null;
	}
	if (doc.source === "vehicle") {
		return doc.kind in VEHICLE_EXPIRY_FIELDS && doc.vehicleId !== null;
	}
	if (doc.source === "license") {
		return doc.kind === "dl_class" && doc.licenseClassId !== null;
	}
	return false;
}

function DocumentsPage() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [kindFilter, setKindFilter] = useState<string>("all");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [addOpen, setAddOpen] = useState(false);
	const [renewDoc, setRenewDoc] = useState<DocItem | null>(null);

	const { data: docList, isLoading } = useQuery(
		orpc.document.list.queryOptions(),
	);
	const { data: vehicleList } = useQuery(orpc.vehicle.list.queryOptions());
	const { data: driverList } = useQuery(orpc.driver.list.queryOptions());

	const archiveMutation = useMutation(
		orpc.document.archive.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.document.list.key(),
				});
				toast.success("Document archived — history preserved");
			},
		}),
	);

	const docs = useMemo(() => {
		const all = docList ?? [];
		const q = search.trim().toLowerCase();
		const filtered = all.filter((d) => {
			if (kindFilter !== "all" && d.kind !== kindFilter) return false;
			const status = getDisplayStatus(d);
			if (statusFilter === "history") {
				if (status !== "superseded" && status !== "archived") return false;
			} else if (statusFilter !== "all" && status !== statusFilter) {
				return false;
			}
			if (!q) return true;
			return [
				d.documentName,
				d.documentNumber,
				d.vehicleRegistration,
				d.vin,
				d.licenseNumber,
				d.driverName,
				d.notes,
			]
				.filter(Boolean)
				.some((v) => (v as string).toLowerCase().includes(q));
		});
		return [...filtered].sort((a, b) => {
			if (a.expiryDate && b.expiryDate)
				return a.expiryDate.getTime() - b.expiryDate.getTime();
			if (a.expiryDate) return -1;
			if (b.expiryDate) return 1;
			return a.documentName.localeCompare(b.documentName);
		});
	}, [docList, search, kindFilter, statusFilter]);

	if (isLoading) {
		return <CenteredLoader />;
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl">Documents</h1>
					<p className="text-muted-foreground text-sm">
						Every document ever held. Renewals keep the old rows — nothing is
						deleted.
					</p>
				</div>
				<Button onClick={() => setAddOpen(true)} type="button">
					<Plus className="mr-2 h-4 w-4" />
					Add Document
				</Button>
			</div>

			<div className="flex flex-col gap-3 sm:flex-row">
				<div className="relative flex-1">
					<Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
					<Input
						className="pl-9"
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search name, VIN, registration, DL number…"
						value={search}
					/>
				</div>
				<Select
					onValueChange={(v) => setKindFilter(v ?? "all")}
					value={kindFilter}
				>
					<SelectTrigger className="w-full sm:w-48">
						<SelectValue placeholder="All kinds" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All kinds</SelectItem>
						{KIND_OPTIONS.map((k) => (
							<SelectItem key={k} value={k}>
								{KIND_LABELS[k] ?? k}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					onValueChange={(v) => setStatusFilter(v ?? "all")}
					value={statusFilter}
				>
					<SelectTrigger className="w-full sm:w-48">
						<SelectValue placeholder="All statuses" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="valid">Valid</SelectItem>
						<SelectItem value="expiring">Expiring soon</SelectItem>
						<SelectItem value="expired">Expired</SelectItem>
						<SelectItem value="no-expiry">No expiry</SelectItem>
						<SelectItem value="history">History</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{docs.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center gap-4 py-12">
						<FileText className="h-12 w-12 text-muted-foreground" />
						<div className="text-center">
							<h2 className="font-semibold text-lg">No documents found</h2>
							<p className="text-muted-foreground text-sm">
								{(docList ?? []).length === 0
									? "Add your first document, or add vehicles and licenses — their papers show up here automatically"
									: "Try a different search or filter"}
							</p>
						</div>
						{(docList ?? []).length === 0 && (
							<Button onClick={() => setAddOpen(true)}>
								<Plus className="mr-2 h-4 w-4" />
								Add Document
							</Button>
						)}
					</CardContent>
				</Card>
			) : (
				<Card>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Document</TableHead>
								<TableHead>Vehicle (Reg / VIN)</TableHead>
								<TableHead>DL Number</TableHead>
								<TableHead>Issue Date</TableHead>
								<TableHead>Expiry Date</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="w-20" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{docs.map((d) => (
								<TableRow
									className={
										getDisplayStatus(d) === "superseded" ||
										getDisplayStatus(d) === "archived"
											? "opacity-60"
											: undefined
									}
									key={d.key}
								>
									<TableCell>
										<div className="font-medium">{d.documentName}</div>
										<div className="text-muted-foreground text-xs">
											{KIND_LABELS[d.kind] ?? d.kind}
											{d.documentNumber ? ` · ${d.documentNumber}` : ""}
											{d.source === "stored" ? " · Vault" : ""}
										</div>
									</TableCell>
									<TableCell>
										{d.vehicleRegistration || d.vin ? (
											<>
												<div className="font-medium">
													{d.vehicleRegistration ?? "—"}
												</div>
												{d.vin ? (
													<div className="text-muted-foreground text-xs">
														VIN: {d.vin}
													</div>
												) : null}
											</>
										) : (
											<span className="text-muted-foreground">—</span>
										)}
									</TableCell>
									<TableCell>
										{d.licenseNumber ? (
											<>
												<div className="font-medium">{d.licenseNumber}</div>
												{d.driverName ? (
													<div className="text-muted-foreground text-xs">
														{d.driverName}
													</div>
												) : null}
											</>
										) : (
											(d.driverName ?? (
												<span className="text-muted-foreground">—</span>
											))
										)}
									</TableCell>
									<TableCell>{formatDate(d.issueDate)}</TableCell>
									<TableCell>{formatDate(d.expiryDate)}</TableCell>
									<TableCell>
										<StatusBadge doc={d} />
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-1">
											{canRenew(d) && (
												<Button
													aria-label={`Renew ${d.documentName}`}
													onClick={() => setRenewDoc(d)}
													size="icon-xs"
													title="Renew — keeps the old row as history"
													type="button"
													variant="ghost"
												>
													<RefreshCw className="h-4 w-4" />
												</Button>
											)}
											{d.source === "stored" &&
												d.storedId !== null &&
												d.status === "active" && (
													<Button
														aria-label={`Archive ${d.documentName}`}
														disabled={archiveMutation.isPending}
														onClick={() =>
															archiveMutation.mutate({
																id: d.storedId as number,
															})
														}
														size="icon-xs"
														title="Archive — hides it but keeps the row"
														type="button"
														variant="ghost"
													>
														<Archive className="h-4 w-4 text-muted-foreground" />
													</Button>
												)}
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</Card>
			)}

			<AddDocumentDialog
				drivers={(driverList ?? []).map((d) => ({
					id: d.id,
					name: d.name,
				}))}
				onClose={() => setAddOpen(false)}
				open={addOpen}
				vehicles={(vehicleList ?? []).map((v) => ({
					id: v.id,
					registrationNumber: v.registrationNumber,
				}))}
			/>

			{renewDoc ? (
				<RenewDialog doc={renewDoc} onClose={() => setRenewDoc(null)} />
			) : null}
		</div>
	);
}

function StatusBadge({ doc }: { doc: DocItem }) {
	const status = getDisplayStatus(doc);
	switch (status) {
		case "expired":
			return <Badge variant="destructive">Expired</Badge>;
		case "expiring": {
			const left = doc.expiryDate ? daysLeft(doc.expiryDate) : 0;
			return <Badge variant="destructive">{left}d left</Badge>;
		}
		case "valid": {
			const left = doc.expiryDate ? daysLeft(doc.expiryDate) : 0;
			return <Badge variant="secondary">{left}d left</Badge>;
		}
		case "superseded":
			return <Badge variant="outline">Superseded</Badge>;
		case "archived":
			return <Badge variant="outline">Archived</Badge>;
		default:
			return (
				<Badge className="font-normal" variant="secondary">
					No expiry
				</Badge>
			);
	}
}

function AddDocumentDialog({
	open,
	onClose,
	vehicles,
	drivers,
}: {
	open: boolean;
	onClose: () => void;
	vehicles: { id: number; registrationNumber: string }[];
	drivers: { id: number; name: string }[];
}) {
	const uid = useId();
	const queryClient = useQueryClient();
	const [kind, setKind] = useState<string>("insurance");

	const createMutation = useMutation(
		orpc.document.create.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.document.list.key(),
				});
				onClose();
				toast.success("Document added to the vault");
			},
		}),
	);

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		const vehicleRaw = fd.get("vehicleId") as string;
		const driverRaw = fd.get("driverId") as string;
		createMutation.mutate({
			documentName:
				((fd.get("documentName") as string) || KIND_LABELS[kind]) ?? "Document",
			documentNumber: (fd.get("documentNumber") as string) || undefined,
			driverId: driverRaw ? Number(driverRaw) : undefined,
			expiryDate: fd.get("expiryDate")
				? new Date(fd.get("expiryDate") as string)
				: undefined,
			issueDate: fd.get("issueDate")
				? new Date(fd.get("issueDate") as string)
				: undefined,
			kind: kind as (typeof KIND_OPTIONS)[number],
			licenseNumber: (fd.get("licenseNumber") as string) || undefined,
			notes: (fd.get("notes") as string) || undefined,
			vehicleId: vehicleRaw ? Number(vehicleRaw) : undefined,
			vehicleRegistration:
				(fd.get("vehicleRegistration") as string) || undefined,
			vin: (fd.get("vin") as string) || undefined,
		});
	}

	return (
		<Dialog onOpenChange={(v) => !v && onClose()} open={open}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add Document</DialogTitle>
					<DialogDescription>
						Stored in the vault forever — renewals keep the old rows.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor={`${uid}-kind`}>Document Kind *</Label>
							<Select
								onValueChange={(v) => setKind(v ?? "insurance")}
								value={kind}
							>
								<SelectTrigger id={`${uid}-kind`}>
									<SelectValue placeholder="Select kind" />
								</SelectTrigger>
								<SelectContent>
									{KIND_OPTIONS.map((k) => (
										<SelectItem key={k} value={k}>
											{KIND_LABELS[k] ?? k}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${uid}-documentName`}>Document Name *</Label>
							<Input
								id={`${uid}-documentName`}
								name="documentName"
								placeholder={KIND_LABELS[kind] ?? "Document"}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${uid}-vehicle`}>Vehicle</Label>
							<Select name="vehicleId">
								<SelectTrigger id={`${uid}-vehicle`}>
									<SelectValue placeholder="Not linked" />
								</SelectTrigger>
								<SelectContent>
									{vehicles.map((v) => (
										<SelectItem key={v.id} value={String(v.id)}>
											{v.registrationNumber}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${uid}-driver`}>Driver</Label>
							<Select name="driverId">
								<SelectTrigger id={`${uid}-driver`}>
									<SelectValue placeholder="Not linked" />
								</SelectTrigger>
								<SelectContent>
									{drivers.map((d) => (
										<SelectItem key={d.id} value={String(d.id)}>
											{d.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${uid}-vehicleRegistration`}>
								Registration Number
							</Label>
							<Input
								id={`${uid}-vehicleRegistration`}
								name="vehicleRegistration"
								placeholder="MH 01 CR 7464"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${uid}-vin`}>VIN / Chassis Number</Label>
							<Input
								id={`${uid}-vin`}
								name="vin"
								placeholder="MAT12345678901234"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${uid}-licenseNumber`}>DL Number</Label>
							<Input
								id={`${uid}-licenseNumber`}
								name="licenseNumber"
								placeholder="MH0120180123456"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${uid}-documentNumber`}>Policy / Cert No.</Label>
							<Input
								id={`${uid}-documentNumber`}
								name="documentNumber"
								placeholder="Policy or certificate number"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${uid}-issueDate`}>Issue Date</Label>
							<Input id={`${uid}-issueDate`} name="issueDate" type="date" />
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${uid}-expiryDate`}>Expiry Date</Label>
							<Input id={`${uid}-expiryDate`} name="expiryDate" type="date" />
						</div>
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor={`${uid}-notes`}>Notes</Label>
							<Input
								id={`${uid}-notes`}
								name="notes"
								placeholder="Insurer, RTO, anything worth remembering"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button onClick={onClose} type="button" variant="outline">
							Cancel
						</Button>
						<Button disabled={createMutation.isPending} type="submit">
							{createMutation.isPending ? "Saving..." : "Add Document"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function RenewDialog({ doc, onClose }: { doc: DocItem; onClose: () => void }) {
	const uid = useId();
	const queryClient = useQueryClient();

	function invalidate() {
		queryClient.invalidateQueries({ queryKey: orpc.document.list.key() });
		queryClient.invalidateQueries({ queryKey: orpc.vehicle.list.key() });
	}

	const renewStoredMutation = useMutation(
		orpc.document.renew.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				invalidate();
				onClose();
				toast.success("Renewed — old document kept as history");
			},
		}),
	);
	const updateVehicleMutation = useMutation(
		orpc.vehicle.update.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				invalidate();
				onClose();
				toast.success("Renewed — old document kept as history");
			},
		}),
	);
	const updateClassMutation = useMutation(
		orpc.license.updateClass.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				invalidate();
				onClose();
				toast.success("Renewed — old document kept as history");
			},
		}),
	);

	const isPending =
		renewStoredMutation.isPending ||
		updateVehicleMutation.isPending ||
		updateClassMutation.isPending;

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);

		if (doc.source === "stored" && doc.storedId !== null) {
			renewStoredMutation.mutate({
				documentNumber: (fd.get("documentNumber") as string) || undefined,
				expiryDate: fd.get("expiryDate")
					? new Date(fd.get("expiryDate") as string)
					: undefined,
				id: doc.storedId,
				issueDate: fd.get("issueDate")
					? new Date(fd.get("issueDate") as string)
					: undefined,
				notes: (fd.get("notes") as string) || undefined,
			});
			return;
		}

		const expiryRaw = fd.get("expiryDate") as string;
		if (!expiryRaw) {
			toast.error("New expiry date is required");
			return;
		}
		const expiry = new Date(expiryRaw);

		if (doc.source === "vehicle" && doc.vehicleId !== null) {
			const field =
				VEHICLE_EXPIRY_FIELDS[doc.kind as keyof typeof VEHICLE_EXPIRY_FIELDS];
			if (!field) {
				toast.error("This document cannot be renewed here");
				return;
			}
			if (field === "insuranceValidTill")
				updateVehicleMutation.mutate({
					id: doc.vehicleId,
					insuranceValidTill: expiry,
				});
			else if (field === "fitnessValidTill")
				updateVehicleMutation.mutate({
					fitnessValidTill: expiry,
					id: doc.vehicleId,
				});
			else
				updateVehicleMutation.mutate({
					id: doc.vehicleId,
					pollutionValidTill: expiry,
				});
			return;
		}

		if (doc.source === "license" && doc.licenseClassId !== null) {
			updateClassMutation.mutate({
				expiryDate: expiry,
				id: doc.licenseClassId,
			});
		}
	}

	const showFullForm = doc.source === "stored";

	return (
		<Dialog onOpenChange={(v) => !v && onClose()} open>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Renew Document</DialogTitle>
					<DialogDescription>
						{doc.documentName}
						{doc.vehicleRegistration ? ` · ${doc.vehicleRegistration}` : ""}
						{doc.licenseNumber ? ` · DL ${doc.licenseNumber}` : ""} — the
						current row stays in history.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" onSubmit={handleSubmit}>
					{showFullForm && (
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor={`${uid}-issueDate`}>New Issue Date</Label>
								<Input
									defaultValue={doc.issueDate ? toDateInput(doc.issueDate) : ""}
									id={`${uid}-issueDate`}
									name="issueDate"
									type="date"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor={`${uid}-documentNumber`}>
									Policy / Cert No.
								</Label>
								<Input
									defaultValue={doc.documentNumber ?? ""}
									id={`${uid}-documentNumber`}
									name="documentNumber"
								/>
							</div>
						</div>
					)}
					<div className="space-y-2">
						<Label htmlFor={`${uid}-expiryDate`}>New Expiry Date *</Label>
						<Input
							defaultValue={doc.expiryDate ? toDateInput(doc.expiryDate) : ""}
							id={`${uid}-expiryDate`}
							name="expiryDate"
							required
							type="date"
						/>
					</div>
					{showFullForm && (
						<div className="space-y-2">
							<Label htmlFor={`${uid}-notes`}>Notes</Label>
							<Input
								defaultValue={doc.notes ?? ""}
								id={`${uid}-notes`}
								name="notes"
							/>
						</div>
					)}
					<DialogFooter>
						<Button onClick={onClose} type="button" variant="outline">
							Cancel
						</Button>
						<Button disabled={isPending} type="submit">
							{isPending ? "Renewing..." : "Renew"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function formatDate(date: Date | null): string {
	if (!date) return "—";
	return new Date(date).toLocaleDateString();
}

function toDateInput(date: Date): string {
	return new Date(date).toISOString().slice(0, 10);
}
