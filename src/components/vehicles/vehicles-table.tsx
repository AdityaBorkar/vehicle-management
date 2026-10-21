import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { PuccCertificateMenuItem } from "#/components/pucc-certificate-button";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";

export interface VehicleTableRow {
	fuelType: string | null;
	id: number;
	insuranceValidTill: Date | null;
	make: string | null;
	model: string | null;
	registrationNumber: string;
	vin: string | null;
	year: number | null;
}

export function VehiclesTable({
	onDelete,
	onEdit,
	vehicles,
}: {
	onDelete: (id: number) => void;
	onEdit: (vehicle: VehicleTableRow) => void;
	vehicles: VehicleTableRow[];
}) {
	const navigate = useNavigate();
	return (
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
										<DropdownMenuItem onClick={() => onEdit(v)}>
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
											onClick={() => onDelete(v.id)}
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
