import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/drivers/")({
  component: DriversPage,
});

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Plus, Trash2, User } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { orpc } from "#/lib/orpc-query";

function DriversPage() {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DriverForm | null>(null);
  const queryClient = useQueryClient();

  const { data: driverList, isLoading } = useQuery(
    orpc.driver.list.queryOptions(),
  );
  const createMutation = useMutation(
    orpc.driver.create.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.driver.list.key() });
        setOpen(false);
        setEditing(null);
        toast.success("Driver created successfully");
      },
    }),
  );
  const updateMutation = useMutation(
    orpc.driver.update.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.driver.list.key() });
        setOpen(false);
        setEditing(null);
        toast.success("Driver updated successfully");
      },
    }),
  );
  const deleteMutation = useMutation(
    orpc.driver.remove.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.driver.list.key() });
        toast.success("Driver deleted");
      },
    }),
  );

  const drivers = driverList ?? [];

  function handleEdit(driver: (typeof drivers)[0]) {
    setEditing({
      id: driver.id,
      name: driver.name,
      phoneNumber: driver.phoneNumber ?? "",
    });
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get("name") as string,
      phoneNumber: (fd.get("phoneNumber") as string) || undefined,
    };

    if (editing?.id) {
      updateMutation.mutate({
        id: editing.id,
        ...data,
        phoneNumber: data.phoneNumber || null,
      });
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
        <h1 className="font-bold text-2xl">Drivers</h1>
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
              Add Driver
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Driver" : "Add Driver"}
              </DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update driver details"
                  : "Enter driver name and phone number"}
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor={`${uid}-name`}>Name *</Label>
                <Input
                  defaultValue={editing?.name ?? ""}
                  id={`${uid}-name`}
                  name="name"
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${uid}-phoneNumber`}>Phone Number</Label>
                <Input
                  defaultValue={editing?.phoneNumber ?? ""}
                  id={`${uid}-phoneNumber`}
                  name="phoneNumber"
                  placeholder="+91 98765 43210"
                />
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

      {drivers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <User className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h2 className="font-semibold text-lg">No drivers yet</h2>
              <p className="text-muted-foreground text-sm">
                Add your first driver to manage their documents
              </p>
            </div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Driver
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    <Link
                      className="hover:underline"
                      params={{ driverId: String(d.id) }}
                      to="/drivers/$driverId"
                    >
                      {d.name}
                    </Link>
                  </TableCell>
                  <TableCell>{d.phoneNumber || "—"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button size="icon-xs" type="button" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(d)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate({ id: d.id })}
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

type DriverForm = {
  id?: number;
  name: string;
  phoneNumber: string;
};
