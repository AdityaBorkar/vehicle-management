import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/documents/")({
	component: DocumentsPage,
});

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, FileText, Plus, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { CenteredLoader } from "#/components/centered-loader";
import {
	AddDocumentDialog,
	RenewDialog,
} from "#/components/documents/document-dialogs";
import {
	type DocItem,
	KIND_LABELS,
	VEHICLE_EXPIRY_FIELDS,
} from "#/components/documents/document-vault";
import { EmptyState } from "#/components/empty-state";
import { PageHeader } from "#/components/page-header";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
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
import { daysUntil, formatDate } from "#/lib/dates";
import { getDocumentDisplayStatus } from "#/lib/document-status";
import { DOCUMENT_KINDS } from "#/lib/manual-documents";
import { orpc } from "#/lib/rpc";

const KIND_OPTIONS = DOCUMENT_KINDS;

const STATUS_LABELS: Record<string, string> = {
	all: "All statuses",
	expired: "Expired",
	expiring: "Expiring soon",
	history: "History",
	"no-expiry": "No expiry",
	valid: "Valid",
};

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
			const status = getDocumentDisplayStatus(d);
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
		<div className="space-y-8">
			<PageHeader
				actions={
					<Button onClick={() => setAddOpen(true)} size="lg" type="button">
						<Plus className="size-4" />
						Add document
					</Button>
				}
				description="Every document ever held, in one vault. Renewals keep the old rows — nothing is deleted."
				eyebrow="Records / Vault"
				meta={
					<>
						<span>
							{docs.length} {docs.length === 1 ? "document" : "documents"} in
							view
						</span>
						<span>History preserved on every renewal</span>
					</>
				}
				title="Documents"
			/>

			<div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 sm:flex-row sm:items-center">
				<div className="relative flex-1">
					<Search className="absolute top-3 left-3 size-4 text-muted-foreground" />
					<Input
						className="border-transparent bg-transparent pl-9 focus-visible:border-transparent focus-visible:ring-0"
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search name, VIN, registration, DL number…"
						value={search}
					/>
				</div>
				<div className="flex gap-2">
					<Select
						onValueChange={(v) => setKindFilter(v ?? "all")}
						value={kindFilter}
					>
						<SelectTrigger className="w-full sm:w-44">
							<SelectValue placeholder="All kinds">
								{(value: string | null) =>
									value && value !== "all"
										? (KIND_LABELS[value] ?? value)
										: "All kinds"
								}
							</SelectValue>
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
						<SelectTrigger className="w-full sm:w-44">
							<SelectValue placeholder="All statuses">
								{(value: string | null) =>
									STATUS_LABELS[value ?? "all"] ?? "All statuses"
								}
							</SelectValue>
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
			</div>

			{docs.length === 0 ? (
				<EmptyState
					action={
						(docList ?? []).length === 0 ? (
							<Button onClick={() => setAddOpen(true)} size="lg">
								<Plus className="size-4" />
								Add your first document
							</Button>
						) : undefined
					}
					description={
						(docList ?? []).length === 0
							? "Add your first document, or add vehicles and licenses — their papers show up here automatically."
							: "Try a different search or filter to widen the view."
					}
					icon={FileText}
					title={
						(docList ?? []).length === 0
							? "No documents yet"
							: "No documents found"
					}
				/>
			) : (
				<div className="overflow-hidden rounded-2xl border border-border bg-card">
					<div className="flex items-center justify-between border-b border-border px-5 py-4">
						<p className="font-medium text-[15px] tracking-[-0.01em]">
							Document vault
						</p>
						<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
							{docs.length} {docs.length === 1 ? "record" : "records"}
						</p>
					</div>
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
										getDocumentDisplayStatus(d) === "superseded" ||
										getDocumentDisplayStatus(d) === "archived"
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
										{d.fileKey && d.storedId ? (
											<a
												className="text-xs underline"
												href={`/api/documents/${d.storedId}`}
											>
												{d.fileName || "Download file"}
											</a>
										) : null}
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
									<TableCell className="text-muted-foreground">
										{formatDate(d.issueDate)}
									</TableCell>
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
													<RefreshCw className="size-4" />
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
														<Archive className="size-4 text-muted-foreground" />
													</Button>
												)}
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
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
	const status = getDocumentDisplayStatus(doc);
	switch (status) {
		case "expired":
			return <Badge variant="destructive">Expired</Badge>;
		case "expiring": {
			const left = doc.expiryDate ? daysUntil(doc.expiryDate) : 0;
			return <Badge variant="destructive">{left}d left</Badge>;
		}
		case "valid": {
			const left = doc.expiryDate ? daysUntil(doc.expiryDate) : 0;
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
