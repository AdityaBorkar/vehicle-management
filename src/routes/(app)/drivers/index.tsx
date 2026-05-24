import { createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/(app)/drivers/")({
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (!data?.user) {
      throw redirect({ to: "/auth/login" });
    }
  },
  component: LicensesPage,
});

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
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

function LicensesPage() {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LicenseForm | null>(null);
  const queryClient = useQueryClient();

  const { data: licenseList, isLoading } = useQuery(
    orpc.license.list.queryOptions(),
  );
  const createMutation = useMutation(
    orpc.license.create.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.license.list.key() });
        setOpen(false);
        setEditing(null);
        toast.success("License created successfully");
      },
    }),
  );
  const updateMutation = useMutation(
    orpc.license.update.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.license.list.key() });
        setOpen(false);
        setEditing(null);
        toast.success("License updated successfully");
      },
    }),
  );
  const deleteMutation = useMutation(
    orpc.license.remove.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.license.list.key() });
        toast.success("License deleted");
      },
    }),
  );

  const licenses = licenseList ?? [];

  function handleEdit(license: (typeof licenses)[0]) {
    setEditing({
      address: license.address ?? "",
      bloodGroup: license.bloodGroup ?? "",
      dateOfBirth: license.dateOfBirth ? toDateInput(license.dateOfBirth) : "",
      expiryDate: license.expiryDate ? toDateInput(license.expiryDate) : "",
      holderName: license.holderName,
      id: license.id,
      issueDate: license.issueDate ? toDateInput(license.issueDate) : "",
      licenseNumber: license.licenseNumber,
      vehicleClasses: license.vehicleClasses ?? "",
    });
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
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
      expiryDate: fd.get("expiryDate")
        ? new Date(fd.get("expiryDate") as string)
        : undefined,
      holderName: fd.get("holderName") as string,
      issueDate: fd.get("issueDate")
        ? new Date(fd.get("issueDate") as string)
        : undefined,
      licenseNumber: fd.get("licenseNumber") as string,
      vehicleClasses: (fd.get("vehicleClasses") as string) || undefined,
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
        <h1 className="font-bold text-2xl">Driving Licenses</h1>
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
              Add License
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit License" : "Add License"}
              </DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update license details"
                  : "Enter driving license details"}
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${uid}-licenseNumber`}>
                    License Number *
                  </Label>
                  <Input
                    defaultValue={editing?.licenseNumber ?? ""}
                    id={`${uid}-licenseNumber`}
                    name="licenseNumber"
                    placeholder="MH0120180123456"
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${uid}-holderName`}>Holder Name *</Label>
                  <Input
                    defaultValue={editing?.holderName ?? ""}
                    id={`${uid}-holderName`}
                    name="holderName"
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${uid}-dateOfBirth`}>Date of Birth</Label>
                  <Input
                    defaultValue={editing?.dateOfBirth ?? ""}
                    id={`${uid}-dateOfBirth`}
                    name="dateOfBirth"
                    type="date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bloodGroup">Blood Group</Label>
                  <Select
                    defaultValue={editing?.bloodGroup ?? ""}
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
                  <Label htmlFor={`${uid}-address`}>Address</Label>
                  <Input
                    defaultValue={editing?.address ?? ""}
                    id={`${uid}-address`}
                    name="address"
                    placeholder="123 Main St, City"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${uid}-vehicleClasses`}>
                    Vehicle Classes
                  </Label>
                  <Input
                    defaultValue={editing?.vehicleClasses ?? ""}
                    id={`${uid}-vehicleClasses`}
                    name="vehicleClasses"
                    placeholder="LMV, MCWG"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${uid}-issueDate`}>Issue Date</Label>
                  <Input
                    defaultValue={editing?.issueDate ?? ""}
                    id={`${uid}-issueDate`}
                    name="issueDate"
                    type="date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${uid}-expiryDate`}>Expiry Date</Label>
                  <Input
                    defaultValue={editing?.expiryDate ?? ""}
                    id={`${uid}-expiryDate`}
                    name="expiryDate"
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

      {licenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h2 className="font-semibold text-lg">No licenses yet</h2>
              <p className="text-muted-foreground text-sm">
                Add your first driving license to get started
              </p>
            </div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add License
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>License No.</TableHead>
                <TableHead>Holder</TableHead>
                <TableHead>Classes</TableHead>
                <TableHead>Blood Group</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {licenses.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">
                    {l.licenseNumber}
                  </TableCell>
                  <TableCell>{l.holderName}</TableCell>
                  <TableCell>{l.vehicleClasses || "—"}</TableCell>
                  <TableCell>
                    {l.bloodGroup ? (
                      <Badge variant="secondary">{l.bloodGroup}</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {l.expiryDate ? (
                      <LicenseExpiryBadge date={l.expiryDate} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button size="icon-xs" type="button" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(l)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate({ id: l.id })}
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

export function LicenseExpiryBadge({ date }: { date: Date }) {
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

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type LicenseForm = {
  id?: number;
  licenseNumber: string;
  holderName: string;
  dateOfBirth: string;
  address: string;
  vehicleClasses: string;
  issueDate: string;
  expiryDate: string;
  bloodGroup: string;
};
