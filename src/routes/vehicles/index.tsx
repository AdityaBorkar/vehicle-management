import { createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/vehicles/")({
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (!data?.user) {
      throw redirect({ to: "/auth/login" });
    }
  },
  component: VehiclesPage,
});

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orpc } from "@/lib/orpc-query";

function VehiclesPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleForm | null>(null);
  const queryClient = useQueryClient();

  const { data: vehicleList, isLoading } = useQuery(
    orpc.vehicle.list.queryOptions(),
  );
  const createMutation = useMutation(
    orpc.vehicle.create.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.vehicle.list.key() });
        setOpen(false);
        setEditing(null);
        toast.success("Vehicle created successfully");
      },
    }),
  );
  const updateMutation = useMutation(
    orpc.vehicle.update.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.vehicle.list.key() });
        setOpen(false);
        setEditing(null);
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

  const vehicles = vehicleList ?? [];

  function handleEdit(vehicle: (typeof vehicles)[0]) {
    setEditing({
      color: vehicle.color ?? "",
      fitnessValidTill: vehicle.fitnessValidTill
        ? vehicle.fitnessValidTill.toISOString().split("T")[0]
        : "",
      fuelType: vehicle.fuelType ?? "",
      id: vehicle.id,
      insuranceValidTill: vehicle.insuranceValidTill
        ? vehicle.insuranceValidTill.toISOString().split("T")[0]
        : "",
      make: vehicle.make ?? "",
      model: vehicle.model ?? "",
      pollutionValidTill: vehicle.pollutionValidTill
        ? vehicle.pollutionValidTill.toISOString().split("T")[0]
        : "",
      registrationDate: vehicle.registrationDate
        ? vehicle.registrationDate.toISOString().split("T")[0]
        : "",
      registrationNumber: vehicle.registrationNumber,
      year: vehicle.year?.toString() ?? "",
    });
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      color: (fd.get("color") as string) || undefined,
      fitnessValidTill: fd.get("fitnessValidTill")
        ? new Date(fd.get("fitnessValidTill") as string)
        : undefined,
      fuelType: ((fd.get("fuelType") as string) || undefined) as
        | "Diesel"
        | "Petrol"
        | "CNG"
        | "EV"
        | "Other"
        | undefined,
      insuranceValidTill: fd.get("insuranceValidTill")
        ? new Date(fd.get("insuranceValidTill") as string)
        : undefined,
      make: (fd.get("make") as string) || undefined,
      model: (fd.get("model") as string) || undefined,
      pollutionValidTill: fd.get("pollutionValidTill")
        ? new Date(fd.get("pollutionValidTill") as string)
        : undefined,
      registrationDate: fd.get("registrationDate")
        ? new Date(fd.get("registrationDate") as string)
        : undefined,
      registrationNumber: fd.get("registrationNumber") as string,
      year: fd.get("year") ? Number(fd.get("year")) : undefined,
    };

    if (editing?.id) {
      updateMutation.mutate({ id: editing.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-2xl">Vehicles</h1>
        <Dialog
          onOpenChange={(v: boolean) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
          open={open}
        >
          <DialogTrigger>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Vehicle" : "Add Vehicle"}
              </DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update vehicle details"
                  : "Enter vehicle registration details"}
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="registrationNumber">
                    Registration Number *
                  </Label>
                  <Input
                    defaultValue={editing?.registrationNumber ?? ""}
                    id="registrationNumber"
                    name="registrationNumber"
                    placeholder="MH 01 CR 7464"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="make">Make</Label>
                  <Input
                    defaultValue={editing?.make ?? ""}
                    id="make"
                    name="make"
                    placeholder="Toyota"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    defaultValue={editing?.model ?? ""}
                    id="model"
                    name="model"
                    placeholder="Innova"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input
                    defaultValue={editing?.year ?? ""}
                    id="year"
                    name="year"
                    placeholder="2024"
                    type="number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Input
                    defaultValue={editing?.color ?? ""}
                    id="color"
                    name="color"
                    placeholder="White"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fuelType">Fuel Type</Label>
                  <Select
                    defaultValue={editing?.fuelType ?? ""}
                    name="fuelType"
                  >
                    <SelectTrigger>
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
                  <Label htmlFor="registrationDate">Registration Date</Label>
                  <Input
                    defaultValue={editing?.registrationDate ?? ""}
                    id="registrationDate"
                    name="registrationDate"
                    type="date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fitnessValidTill">Fitness Valid Till</Label>
                  <Input
                    defaultValue={editing?.fitnessValidTill ?? ""}
                    id="fitnessValidTill"
                    name="fitnessValidTill"
                    type="date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insuranceValidTill">
                    Insurance Valid Till
                  </Label>
                  <Input
                    defaultValue={editing?.insuranceValidTill ?? ""}
                    id="insuranceValidTill"
                    name="insuranceValidTill"
                    type="date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pollutionValidTill">
                    Pollution Valid Till
                  </Label>
                  <Input
                    defaultValue={editing?.pollutionValidTill ?? ""}
                    id="pollutionValidTill"
                    name="pollutionValidTill"
                    type="date"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setOpen(false);
                    setEditing(null);
                  }}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  type="submit"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editing
                      ? "Update"
                      : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {vehicles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Car className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h2 className="font-semibold text-lg">No vehicles yet</h2>
              <p className="text-muted-foreground text-sm">
                Add your first vehicle to get started
              </p>
            </div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Vehicle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
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
                <TableRow key={v.id}>
                  <TableCell className="font-medium">
                    {v.registrationNumber}
                  </TableCell>
                  <TableCell>
                    {[v.make, v.model].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell>{v.year ?? "—"}</TableCell>
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
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button size="icon-xs" type="button" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(v)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate({ id: v.id })}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
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
        className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
        variant="secondary"
      >
        {daysLeft}d
      </Badge>
    );
  return <Badge variant="secondary">{daysLeft}d</Badge>;
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
  fitnessValidTill: string;
  insuranceValidTill: string;
  pollutionValidTill: string;
};
