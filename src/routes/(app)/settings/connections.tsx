import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Link2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { orpc } from "#/lib/rpc";

export const Route = createFileRoute("/(app)/settings/connections")({
	component: ConnectionsPage,
});

function ConnectionsPage() {
	const { data: vehicleList, isLoading } = useQuery(
		orpc.vehicle.list.queryOptions(),
	);
	const [vehicleId, setVehicleId] = useState<string>("");

	const vehicles = vehicleList ?? [];
	const selectedId = Number(vehicleId);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<h1 className="font-bold text-2xl">Connections</h1>

			{vehicles.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center gap-4 py-12">
						<Link2 className="h-12 w-12 text-muted-foreground" />
						<div className="text-center">
							<h2 className="font-semibold text-lg">No vehicles yet</h2>
							<p className="text-muted-foreground text-sm">
								Add a vehicle before linking GPS, FASTag, or diesel cards
							</p>
						</div>
					</CardContent>
				</Card>
			) : (
				<>
					<div className="max-w-sm">
						<Select
							onValueChange={(v) => setVehicleId(v ?? "")}
							value={vehicleId}
						>
							<SelectTrigger aria-label="Select vehicle">
								<SelectValue placeholder="Select a vehicle">
									{(value: string | null) =>
										vehicles.find((v) => String(v.id) === value)
											?.registrationNumber ?? "Select a vehicle"
									}
								</SelectValue>
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

					{Number.isFinite(selectedId) && selectedId > 0 ? (
						<div className="grid gap-6 md:grid-cols-3">
							<GpsCard vehicleId={selectedId} />
							<FastagCard vehicleId={selectedId} />
							<DieselCard vehicleId={selectedId} />
						</div>
					) : (
						<Card>
							<CardContent className="py-8 text-center text-muted-foreground text-sm">
								Select a vehicle to manage its linked devices
							</CardContent>
						</Card>
					)}
				</>
			)}
		</div>
	);
}

function DeviceRow({
	label,
	sub,
	active,
	onDelete,
	deleteLabel,
}: {
	label: string;
	sub?: string | null;
	active?: boolean | null;
	onDelete: () => void;
	deleteLabel: string;
}) {
	return (
		<div className="flex items-center justify-between gap-2 text-sm">
			<div className="min-w-0">
				<p className="truncate font-medium">{label}</p>
				{sub ? (
					<p className="truncate text-muted-foreground text-xs">{sub}</p>
				) : null}
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<Badge variant={active ? "default" : "secondary"}>
					{active ? "Active" : "Inactive"}
				</Badge>
				<Button
					aria-label={deleteLabel}
					onClick={onDelete}
					size="icon-xs"
					type="button"
					variant="ghost"
				>
					<Trash2 className="h-4 w-4 text-destructive" />
				</Button>
			</div>
		</div>
	);
}

function GpsCard({ vehicleId }: { vehicleId: number }) {
	const queryClient = useQueryClient();
	const { data } = useQuery(
		orpc.gpsDevice.list.queryOptions({ input: { vehicleId } }),
	);
	const create = useMutation(
		orpc.gpsDevice.create.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.gpsDevice.list.key({ input: { vehicleId } }),
				});
				toast.success("GPS device linked");
			},
		}),
	);
	const remove = useMutation(
		orpc.gpsDevice.remove.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.gpsDevice.list.key({ input: { vehicleId } }),
				});
				toast.success("GPS device removed");
			},
		}),
	);

	const devices = data ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">GPS Devices</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{devices.length === 0 && (
					<p className="text-muted-foreground text-sm">None linked</p>
				)}
				{devices.map((d) => (
					<DeviceRow
						active={d.isActive}
						deleteLabel={`Remove GPS device ${d.deviceId}`}
						key={d.id}
						label={d.deviceId}
						onDelete={() => remove.mutate({ id: d.id })}
						sub={d.provider}
					/>
				))}
				<form
					className="flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						const fd = new FormData(e.currentTarget);
						const deviceId = (fd.get("deviceId") as string).trim();
						if (!deviceId) return;
						create.mutate({
							deviceId,
							vehicleId,
						});
						e.currentTarget.reset();
					}}
				>
					<Input
						aria-label="New GPS device ID"
						name="deviceId"
						placeholder="Device ID"
						required
					/>
					<Button
						aria-label="Link GPS device"
						disabled={create.isPending}
						size="icon"
						type="submit"
					>
						<Plus className="h-4 w-4" />
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

function FastagCard({ vehicleId }: { vehicleId: number }) {
	const queryClient = useQueryClient();
	const { data } = useQuery(
		orpc.fastag.list.queryOptions({ input: { vehicleId } }),
	);
	const create = useMutation(
		orpc.fastag.create.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.fastag.list.key({ input: { vehicleId } }),
				});
				toast.success("FASTag linked");
			},
		}),
	);
	const remove = useMutation(
		orpc.fastag.remove.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.fastag.list.key({ input: { vehicleId } }),
				});
				toast.success("FASTag removed");
			},
		}),
	);

	const tags = data ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">FASTag</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{tags.length === 0 && (
					<p className="text-muted-foreground text-sm">None linked</p>
				)}
				{tags.map((f) => (
					<DeviceRow
						active={f.isActive}
						deleteLabel={`Remove FASTag ${f.tagId}`}
						key={f.id}
						label={f.tagId}
						onDelete={() => remove.mutate({ id: f.id })}
						sub={f.bankWallet}
					/>
				))}
				<form
					className="flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						const fd = new FormData(e.currentTarget);
						const tagId = (fd.get("tagId") as string).trim();
						if (!tagId) return;
						create.mutate({ tagId, vehicleId });
						e.currentTarget.reset();
					}}
				>
					<Input
						aria-label="New FASTag ID"
						name="tagId"
						placeholder="Tag ID"
						required
					/>
					<Button
						aria-label="Link FASTag"
						disabled={create.isPending}
						size="icon"
						type="submit"
					>
						<Plus className="h-4 w-4" />
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

function DieselCard({ vehicleId }: { vehicleId: number }) {
	const queryClient = useQueryClient();
	const { data } = useQuery(
		orpc.dieselCard.list.queryOptions({ input: { vehicleId } }),
	);
	const create = useMutation(
		orpc.dieselCard.create.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.dieselCard.list.key({ input: { vehicleId } }),
				});
				toast.success("Diesel card linked");
			},
		}),
	);
	const remove = useMutation(
		orpc.dieselCard.remove.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.dieselCard.list.key({ input: { vehicleId } }),
				});
				toast.success("Diesel card removed");
			},
		}),
	);

	const cards = data ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Diesel Cards</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{cards.length === 0 && (
					<p className="text-muted-foreground text-sm">None linked</p>
				)}
				{cards.map((c) => (
					<DeviceRow
						active={c.isActive}
						deleteLabel={`Remove diesel card ${c.cardNumber}`}
						key={c.id}
						label={c.cardNumber}
						onDelete={() => remove.mutate({ id: c.id })}
						sub={c.provider}
					/>
				))}
				<form
					className="flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						const fd = new FormData(e.currentTarget);
						const cardNumber = (fd.get("cardNumber") as string).trim();
						if (!cardNumber) return;
						create.mutate({ cardNumber, vehicleId });
						e.currentTarget.reset();
					}}
				>
					<Input
						aria-label="New diesel card number"
						name="cardNumber"
						placeholder="Card number"
						required
					/>
					<Button
						aria-label="Link diesel card"
						disabled={create.isPending}
						size="icon"
						type="submit"
					>
						<Plus className="h-4 w-4" />
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
