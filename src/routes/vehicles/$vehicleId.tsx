import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import { orpc } from "@/lib/orpc-query";

export const Route = createFileRoute("/vehicles/$vehicleId")({
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (!data?.user) {
      throw redirect({ to: "/auth/login" });
    }
  },
  component: VehicleDetailPage,
});

function VehicleDetailPage() {
  const vehicleId = Number(Route.useParams().vehicleId);
  const queryClient = useQueryClient();

  const { data: vehicle, isLoading } = useQuery(
    orpc.vehicle.getById.queryOptions({ input: { id: vehicleId } }),
  );
  const { data: gpsDevices } = useQuery(
    orpc.gpsDevice.list.queryOptions({ input: { vehicleId } }),
  );
  const { data: fastags } = useQuery(
    orpc.fastag.list.queryOptions({ input: { vehicleId } }),
  );
  const { data: dieselCards } = useQuery(
    orpc.dieselCard.list.queryOptions({ input: { vehicleId } }),
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Vehicle not found</p>
        <Link
          className="mt-2 inline-block text-primary text-sm hover:underline"
          to="/vehicles"
        >
          Back to Vehicles
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/vehicles">
            <Button size="icon" type="button" variant="ghost">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-bold text-2xl">{vehicle.registrationNumber}</h1>
          {vehicle.fuelType && (
            <Badge variant="secondary">{vehicle.fuelType}</Badge>
          )}
        </div>
        <Button
          disabled={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate({ id: vehicle.id })}
          size="sm"
          type="button"
          variant="destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vehicle Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow
              label="Make / Model"
              value={[vehicle.make, vehicle.model].filter(Boolean).join(" ")}
            />
            <DetailRow label="Year" value={vehicle.year?.toString()} />
            <DetailRow label="Color" value={vehicle.color} />
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
                  <div className="flex items-center justify-between" key={d.id}>
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
            <CardTitle className="text-base">FASTag & Diesel Card</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fastags && fastags.length > 0 ? (
              <div className="space-y-2 text-sm">
                {fastags.map((f) => (
                  <div className="flex items-center justify-between" key={f.id}>
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
              <p className="text-muted-foreground text-sm">No FASTag linked</p>
            )}
            {dieselCards && dieselCards.length > 0 ? (
              <div className="space-y-2 text-sm">
                {dieselCards.map((c) => (
                  <div className="flex items-center justify-between" key={c.id}>
                    <span>Diesel Card: {c.cardNumber}</span>
                    <div className="flex items-center gap-2">
                      {c.provider && (
                        <span className="text-muted-foreground">
                          {c.provider}
                        </span>
                      )}
                      <Badge variant={c.isActive ? "default" : "secondary"}>
                        {c.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No diesel card linked
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DetailRow({
  label,
  value,
  badge,
}: {
  label: string;
  value?: string | null;
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
  const daysLeft = Math.ceil(
    (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (daysLeft < 0) return <Badge variant="destructive">Expired</Badge>;
  if (daysLeft <= 30)
    return <Badge variant="destructive">{daysLeft}d left</Badge>;
  if (daysLeft <= 90)
    return <Badge variant="secondary">{daysLeft}d left</Badge>;
  return null;
}

function formatDate(date: Date | null | undefined) {
  if (!date) return null;
  return new Date(date).toLocaleDateString();
}
