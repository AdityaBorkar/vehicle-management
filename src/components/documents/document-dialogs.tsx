import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "#/components/ui/button";
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
import { toDateInput } from "#/lib/dates";
import { uploadDocumentFile } from "#/lib/document-upload";
import {
	DOCUMENT_KINDS,
	MANUAL_DOCUMENT_KINDS,
	NO_EXPIRY_KINDS,
} from "#/lib/manual-documents";
import { orpc } from "#/lib/rpc";
import {
	type DocItem,
	KIND_HELP,
	KIND_LABELS,
	VEHICLE_EXPIRY_FIELDS,
} from "./document-vault";

const KIND_OPTIONS = DOCUMENT_KINDS;

const MANUAL_KINDS = MANUAL_DOCUMENT_KINDS;

export function AddDocumentDialog({
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
	const [uploading, setUploading] = useState(false);

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

	const isManual = (MANUAL_KINDS as readonly string[]).includes(kind);
	const isNoExpiry = (NO_EXPIRY_KINDS as readonly string[]).includes(kind);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = e.currentTarget;
		const fd = new FormData(form);
		const vehicleRaw = fd.get("vehicleId") as string;
		const driverRaw = fd.get("driverId") as string;
		const issueRaw = fd.get("issueDate") as string;
		const expiryRaw = fd.get("expiryDate") as string;
		if (isManual && !vehicleRaw) {
			toast.error("Vehicle is required for this document kind.");
			return;
		}
		if (isManual && !issueRaw) {
			toast.error("Valid-from date is required.");
			return;
		}
		if (isNoExpiry && expiryRaw) {
			toast.error("This document kind has no expiry — leave Valid-till empty.");
			return;
		}
		const fileInput = form.querySelector(
			'input[type="file"][name="file"]',
		) as HTMLInputElement | null;
		const file = fileInput?.files?.[0];
		if (isManual && !file) {
			toast.error("A file upload is required for this document kind.");
			return;
		}
		let uploaded:
			| {
					fileKey: string;
					fileMime: string;
					fileName: string;
					fileSizeBytes: number;
			  }
			| undefined;
		if (file) {
			const vehicle = vehicles.find((v) => String(v.id) === vehicleRaw);
			setUploading(true);
			try {
				uploaded = await uploadDocumentFile(file, {
					kind,
					vehicleReg: vehicle?.registrationNumber ?? "",
				});
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Upload failed.");
				return;
			} finally {
				setUploading(false);
			}
		}
		const fileKey = uploaded?.fileKey;
		const fileMime = uploaded?.fileMime;
		const fileName = uploaded?.fileName;
		const fileSizeBytes = uploaded?.fileSizeBytes;
		createMutation.mutate({
			documentName:
				((fd.get("documentName") as string) || KIND_LABELS[kind]) ?? "Document",
			documentNumber: (fd.get("documentNumber") as string) || undefined,
			driverId: driverRaw ? Number(driverRaw) : undefined,
			...(fileKey ? { fileKey } : {}),
			...(fileMime ? { fileMime } : {}),
			...(fileName ? { fileName } : {}),
			...(fileSizeBytes ? { fileSizeBytes } : {}),
			expiryDate: expiryRaw ? new Date(expiryRaw) : undefined,
			issueDate: issueRaw ? new Date(issueRaw) : undefined,
			kind: kind as (typeof KIND_OPTIONS)[number],
			licenseNumber: (fd.get("licenseNumber") as string) || undefined,
			notes: (fd.get("notes") as string) || undefined,
			vehicleId: vehicleRaw ? Number(vehicleRaw) : undefined,
			vehicleRegistration:
				(fd.get("vehicleRegistration") as string) || undefined,
			vin: (fd.get("vin") as string) || undefined,
		});
	}

	const pending = createMutation.isPending || uploading;

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
							<Label htmlFor={`${uid}-issueDate`}>
								Valid From {isManual ? "*" : ""}
							</Label>
							<Input
								id={`${uid}-issueDate`}
								name="issueDate"
								required={isManual}
								type="date"
							/>
						</div>
						{isNoExpiry ? (
							<div className="space-y-2">
								<Label>Valid Till</Label>
								<p className="rounded-xl border border-dashed border-border px-3 py-2 text-muted-foreground text-sm">
									No expiry for this document kind
								</p>
							</div>
						) : (
							<div className="space-y-2">
								<Label htmlFor={`${uid}-expiryDate`}>Valid Till</Label>
								<Input id={`${uid}-expiryDate`} name="expiryDate" type="date" />
							</div>
						)}
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor={`${uid}-file`}>
								Proof file (PDF/JPG/PNG, max 10 MB) {isManual ? "*" : ""}
							</Label>
							<Input
								accept="application/pdf,image/jpeg,image/png"
								id={`${uid}-file`}
								name="file"
								required={false}
								type="file"
							/>
							{KIND_HELP[kind] ? (
								<p className="text-muted-foreground text-xs">
									{KIND_HELP[kind]}
								</p>
							) : null}
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
					{uploading ? (
						<div aria-live="polite" className="space-y-2" role="status">
							<p className="text-muted-foreground text-xs">
								Uploading proof file to storage… (PDF/JPG/PNG, max 10 MB)
							</p>
							<div className="h-1.5 overflow-hidden rounded-full bg-muted">
								<div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
							</div>
						</div>
					) : null}
					<DialogFooter>
						<Button onClick={onClose} type="button" variant="outline">
							Cancel
						</Button>
						<Button disabled={pending} type="submit">
							{uploading
								? "Uploading file…"
								: createMutation.isPending
									? "Saving…"
									: "Add Document"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export function RenewDialog({
	doc,
	onClose,
}: {
	doc: DocItem;
	onClose: () => void;
}) {
	const uid = useId();
	const queryClient = useQueryClient();
	const [uploading, setUploading] = useState(false);

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
		updateClassMutation.isPending ||
		uploading;

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = e.currentTarget;
		const fd = new FormData(form);

		if (doc.source === "stored" && doc.storedId !== null) {
			const isNoExpiry = (NO_EXPIRY_KINDS as readonly string[]).includes(
				doc.kind,
			);
			const fileInput = form.querySelector(
				'input[type="file"][name="file"]',
			) as HTMLInputElement | null;
			const file = fileInput?.files?.[0];
			let uploaded:
				| {
						fileKey: string;
						fileMime: string;
						fileName: string;
						fileSizeBytes: number;
				  }
				| undefined;
			if (file) {
				setUploading(true);
				try {
					uploaded = await uploadDocumentFile(file, {
						kind: doc.kind,
						vehicleReg: doc.vehicleRegistration ?? "",
					});
				} catch (err) {
					toast.error(err instanceof Error ? err.message : "Upload failed.");
					return;
				} finally {
					setUploading(false);
				}
			}
			const fileKey = uploaded?.fileKey;
			const fileMime = uploaded?.fileMime;
			const fileName = uploaded?.fileName;
			const fileSizeBytes = uploaded?.fileSizeBytes;
			renewStoredMutation.mutate({
				documentNumber: (fd.get("documentNumber") as string) || undefined,
				// No-expiry kinds must never send an expiry date (server rejects it).
				expiryDate:
					!isNoExpiry && fd.get("expiryDate")
						? new Date(fd.get("expiryDate") as string)
						: undefined,
				...(fileKey ? { fileKey } : {}),
				...(fileMime ? { fileMime } : {}),
				...(fileName ? { fileName } : {}),
				...(fileSizeBytes ? { fileSizeBytes } : {}),
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
					{(NO_EXPIRY_KINDS as readonly string[]).includes(doc.kind) ? (
						<div className="space-y-2">
							<Label>New Expiry Date</Label>
							<p className="rounded-xl border border-dashed border-border px-3 py-2 text-muted-foreground text-sm">
								No expiry for this document kind
							</p>
						</div>
					) : (
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
					)}
					{showFullForm && (
						<div className="space-y-2">
							<Label htmlFor={`${uid}-file`}>
								Replace proof file (PDF/JPG/PNG, max 10 MB, optional)
							</Label>
							<Input
								accept="application/pdf,image/jpeg,image/png"
								id={`${uid}-file`}
								name="file"
								type="file"
							/>
							{uploading ? (
								<p className="text-muted-foreground text-xs">
									Uploading replacement file…
								</p>
							) : null}
						</div>
					)}
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
							{uploading
								? "Uploading file…"
								: isPending
									? "Renewing..."
									: "Renew"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
