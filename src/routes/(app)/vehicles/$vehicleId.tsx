import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { CenteredLoader } from "#/components/centered-loader";
import { PuccCertificateButton } from "#/components/pucc-certificate-button";
import { TransactionHistoryTab } from "#/components/transaction-history-tab";
import { Badge } from "#/components/ui/badge";
import { Button, buttonVariants } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { daysUntil, formatDate } from "#/lib/dates";
import { orpc } from "#/lib/rpc";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/(app)/vehicles/$vehicleId")({
	component: VehicleDetailPage,
});

function VehicleDetailPage() {
	const vehicleId = Number(Route.useParams().vehicleId);
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState<"overview" | "transactions">(
		"overview",
	);

	const { data: vehicle, isLoading } = useQuery(
		orpc.vehicle.getById.queryOptions({ input: { id: vehicleId } }),
	);
	const { data: gpsDevices } = useQuery(
		orpc.gpsDevice.list.queryOptions({ input: { vehicleId } }),
	);
	const { data: fastags } = useQuery(
		orpc.fastag.list.queryOptions({ input: { vehicleId } }),
	);
	const { data: allDocuments } = useQuery(orpc.document.list.queryOptions());

	const complianceDocs = useMemo(
		() => buildComplianceDocs(vehicle, allDocuments, vehicleId),
		[vehicle, allDocuments, vehicleId],
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
	const syncRcMutation = useMutation(
		orpc.vehicle.syncRc.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.vehicle.list.key() });
				queryClient.invalidateQueries({
					queryKey: orpc.vehicle.getById.key({ input: { id: vehicleId } }),
				});
				toast.success("RC details synced from Cashfree");
			},
		}),
	);

	if (isLoading) {
		return <CenteredLoader />;
	}

	if (!vehicle) {
		return (
			<div className="flex min-h-[55vh] flex-col items-center justify-center px-6 text-center">
				<p className="eyebrow">Not found</p>
				<h1 className="display-sm mt-4">Vehicle not found.</h1>
				<p className="lede mt-4">
					This record may have been removed, or it belongs to another fleet.
				</p>
				<Link
					className={buttonVariants({ className: "mt-8", variant: "outline" })}
					to="/vehicles"
				>
					<ArrowLeft className="size-4" />
					Back to vehicles
				</Link>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<div className="page-enter border-b border-border pb-8">
				<Link
					className="eyebrow inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
					to="/vehicles"
				>
					<ArrowLeft className="size-3.5" />
					Vehicles
				</Link>
				<div className="mt-5 flex flex-wrap items-end justify-between gap-4">
					<div className="flex flex-wrap items-center gap-3">
						<h1 className="page-title font-mono tracking-[-0.06em]">
							{vehicle.registrationNumber}
						</h1>
						{vehicle.fuelType && (
							<Badge variant="secondary">{vehicle.fuelType}</Badge>
						)}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<PuccCertificateButton
							registrationNumber={vehicle.registrationNumber}
							vehicleId={vehicle.id}
							vin={vehicle.vin}
						/>
						<Button
							disabled={syncRcMutation.isPending}
							onClick={() => syncRcMutation.mutate({ vehicleId: vehicle.id })}
							size="sm"
							title="Re-run Cashfree RC lookup and write every mapped field back to this vehicle"
							type="button"
							variant="outline"
						>
							<RefreshCw className="size-4" />
							{syncRcMutation.isPending ? "Syncing RC…" : "Sync RC"}
						</Button>
						<Button
							className="border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
							disabled={deleteMutation.isPending}
							onClick={() => deleteMutation.mutate({ id: vehicle.id })}
							size="sm"
							type="button"
							variant="outline"
						>
							<Trash2 className="size-4" />
							Delete vehicle
						</Button>
					</div>
				</div>
				<p className="mt-3 text-muted-foreground text-sm">
					{[vehicle.make, vehicle.model, vehicle.year]
						.filter(Boolean)
						.join(" · ") || "Vehicle record"}
				</p>
			</div>

			<div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 p-1 text-sm">
				<button
					className={cn(
						"rounded-full px-4 py-1.5 font-medium transition-colors",
						activeTab === "overview"
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
					onClick={() => setActiveTab("overview")}
					type="button"
				>
					Overview
				</button>
				<button
					className={cn(
						"rounded-full px-4 py-1.5 font-medium transition-colors",
						activeTab === "transactions"
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
					onClick={() => setActiveTab("transactions")}
					type="button"
				>
					Transaction History
				</button>
			</div>

			{activeTab === "transactions" ? (
				<TransactionHistoryTab
					registrationNumber={vehicle.registrationNumber}
					vehicleId={vehicle.id}
				/>
			) : (
				<div className="space-y-6">
					<div className="grid gap-6 md:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Vehicle Details</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2 text-sm">
								<DetailRow
									label="Make / Model"
									value={[vehicle.make, vehicle.model]
										.filter(Boolean)
										.join(" ")}
								/>
								<DetailRow
									label="Year"
									value={vehicle.year?.toString() ?? null}
								/>
								<DetailRow label="Color" value={vehicle.color} />
								<DetailRow label="VIN / Chassis Number" value={vehicle.vin} />
								<DetailRow
									label="Registration Date"
									value={formatDate(vehicle.registrationDate)}
								/>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="text-base">Validity Dates</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2 text-sm">
								<DetailRow
									badge={
										vehicle.fitnessValidTill ? (
											<ExpiryBadge date={vehicle.fitnessValidTill} />
										) : undefined
									}
									label="Fitness"
									value={formatDate(vehicle.fitnessValidTill)}
								/>
								<DetailRow
									badge={
										vehicle.insuranceValidTill ? (
											<ExpiryBadge date={vehicle.insuranceValidTill} />
										) : undefined
									}
									label="Insurance"
									value={formatDate(vehicle.insuranceValidTill)}
								/>
								<DetailRow
									badge={
										vehicle.pollutionValidTill ? (
											<ExpiryBadge date={vehicle.pollutionValidTill} />
										) : undefined
									}
									label="Pollution"
									value={formatDate(vehicle.pollutionValidTill)}
								/>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="text-base">GPS Devices</CardTitle>
							</CardHeader>
							<CardContent>
								{gpsDevices && gpsDevices.length > 0 ? (
									<div className="space-y-2 text-sm">
										{gpsDevices.map((d) => (
											<div
												className="flex items-center justify-between"
												key={d.id}
											>
												<span>{d.deviceId}</span>
												<div className="flex items-center gap-2">
													{d.provider && (
														<span className="text-muted-foreground">
															{d.provider}
														</span>
													)}
													<Badge variant={d.isActive ? "default" : "secondary"}>
														{d.isActive ? "Active" : "Inactive"}
													</Badge>
												</div>
											</div>
										))}
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										No GPS devices linked
									</p>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="text-base">FASTag</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								{fastags && fastags.length > 0 ? (
									<div className="space-y-2 text-sm">
										{fastags.map((f) => (
											<div
												className="flex items-center justify-between"
												key={f.id}
											>
												<span>FASTag: {f.tagId}</span>
												<div className="flex items-center gap-2">
													{f.bankWallet && (
														<span className="text-muted-foreground">
															{f.bankWallet}
														</span>
													)}
													<Badge variant={f.isActive ? "default" : "secondary"}>
														{f.isActive ? "Active" : "Inactive"}
													</Badge>
												</div>
											</div>
										))}
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										No FASTag linked
									</p>
								)}
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">
								Documents — Vehicle Compliance
							</CardTitle>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>ID</TableHead>
										<TableHead>Name</TableHead>
										<TableHead>Valid From</TableHead>
										<TableHead>Valid Till</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{complianceDocs.map((doc) => (
										<TableRow key={doc.kind}>
											<TableCell>
												{doc.applicable ? (
													(doc.documentNumber ?? (
														<span className="text-muted-foreground">—</span>
													))
												) : (
													<span className="text-muted-foreground">
														Not Applicable
													</span>
												)}
											</TableCell>
											<TableCell className="font-medium">{doc.name}</TableCell>
											<TableCell>{formatDate(doc.issueDate) ?? "—"}</TableCell>
											<TableCell>
												<div className="flex items-center gap-2">
													<span>
														{formatDate(doc.expiryDate) ??
															(doc.kind === "goods_permit" ||
															doc.kind === "speed_governor" ? (
																<Badge variant="secondary">No expiry</Badge>
															) : (
																"—"
															))}
													</span>
													{doc.applicable &&
													doc.expiryDate &&
													doc.kind !== "purchase_order" ? (
														<ExpiryBadge date={doc.expiryDate} />
													) : null}
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
}

export function DetailRow({
	label,
	value,
	badge,
}: {
	label: string;
	value?: string | null | undefined;
	badge?: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-muted-foreground">{label}</span>
			<div className="flex items-center gap-2">
				<span>{value || "—"}</span>
				{badge}
			</div>
		</div>
	);
}

export function ExpiryBadge({ date }: { date: Date }) {
	const daysLeft = daysUntil(date);
	if (daysLeft < 0) return <Badge variant="destructive">Expired</Badge>;
	if (daysLeft <= 30)
		return <Badge variant="destructive">{daysLeft}d left</Badge>;
	if (daysLeft <= 90)
		return <Badge variant="secondary">{daysLeft}d left</Badge>;
	return null;
}

const COMPLIANCE_DOCS = [
	{ kind: "registration", name: "Registration Certificate (RC)" },
	{ kind: "insurance", name: "Insurance" },
	{ kind: "fitness", name: "Fitness Certificate" },
	{ kind: "pollution", name: "Pollution (PUC)" },
	{ kind: "permit", name: "Permit" },
	{ kind: "tax", name: "Tax" },
	{ kind: "goods_permit", name: "Goods Permit" },
	{ kind: "speed_governor", name: "Speed Governor Certificate" },
	{ kind: "purchase_order", name: "Purchase Order" },
	{ kind: "form20", name: "Form 20 (Sale/Purchase)" },
] as const;

type ComplianceKind = (typeof COMPLIANCE_DOCS)[number]["kind"];

type ComplianceRow = {
	kind: ComplianceKind;
	name: string;
	applicable: boolean;
	documentNumber: string | null;
	issueDate: Date | null;
	expiryDate: Date | null;
};

function isComplianceApplicable(
	kind: ComplianceKind,
	vehicle: { fuelType?: string | null } | null | undefined,
): boolean {
	if (kind === "pollution" && vehicle?.fuelType === "EV") return false;
	return true;
}

function buildComplianceDocs(
	vehicle:
		| {
				fuelType?: string | null;
				registrationDate?: Date | null;
				insuranceValidTill?: Date | null;
				fitnessValidTill?: Date | null;
				pollutionValidTill?: Date | null;
		  }
		| null
		| undefined,
	allDocuments:
		| {
				vehicleId: number | null;
				kind: string;
				status: string;
				isCurrent: boolean;
				source: string;
				documentNumber: string | null;
				issueDate: Date | null;
				expiryDate: Date | null;
		  }[]
		| undefined,
	vehicleId: number,
): ComplianceRow[] {
	const liveDates: Record<
		ComplianceKind,
		{ from: Date | null; till: Date | null }
	> = {
		fitness: { from: null, till: vehicle?.fitnessValidTill ?? null },
		form20: { from: null, till: null },
		goods_permit: { from: null, till: null },
		insurance: { from: null, till: vehicle?.insuranceValidTill ?? null },
		permit: { from: null, till: null },
		pollution: { from: null, till: vehicle?.pollutionValidTill ?? null },
		purchase_order: { from: null, till: null },
		registration: { from: vehicle?.registrationDate ?? null, till: null },
		speed_governor: { from: null, till: null },
		tax: { from: null, till: null },
	};

	return COMPLIANCE_DOCS.map(({ kind, name }) => {
		const applicable = isComplianceApplicable(kind, vehicle);
		const related = (allDocuments ?? []).filter(
			(d) =>
				d.vehicleId === vehicleId &&
				d.kind === kind &&
				d.isCurrent &&
				d.status === "active",
		);
		const stored = related.find((d) => d.source === "stored") ?? related[0];
		const live = liveDates[kind];
		return {
			applicable,
			documentNumber: stored?.documentNumber ?? null,
			expiryDate: stored?.expiryDate ?? live.till,
			issueDate: stored?.issueDate ?? live.from,
			kind,
			name,
		};
	});
}
