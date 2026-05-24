import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import { orpc } from "@/lib/orpc-query";

export const Route = createFileRoute("/licenses/$licenseId")({
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (!data?.user) {
      throw redirect({ to: "/auth/login" });
    }
  },
  component: LicenseDetailPage,
});

function LicenseDetailPage() {
  const licenseId = Number(Route.useParams().licenseId);
  const queryClient = useQueryClient();

  const { data: license, isLoading } = useQuery(
    orpc.license.getById.queryOptions({ input: { id: licenseId } }),
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!license) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">License not found</p>
        <Link
          className="mt-2 inline-block text-primary text-sm hover:underline"
          to="/licenses"
        >
          Back to Licenses
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/licenses">
            <Button size="icon" type="button" variant="ghost">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-bold text-2xl">{license.licenseNumber}</h1>
          {license.bloodGroup && (
            <Badge variant="secondary">{license.bloodGroup}</Badge>
          )}
        </div>
        <Button
          disabled={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate({ id: license.id })}
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
            <CardTitle className="text-base">License Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Holder Name" value={license.holderName} />
            <DetailRow
              label="Date of Birth"
              value={formatDate(license.dateOfBirth)}
            />
            <DetailRow label="Address" value={license.address} />
            <DetailRow label="Vehicle Classes" value={license.vehicleClasses} />
            <DetailRow label="Blood Group" value={license.bloodGroup} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Validity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow
              label="Issue Date"
              value={formatDate(license.issueDate)}
            />
            <DetailRow
              badge={
                license.expiryDate ? (
                  <ExpiryBadge date={license.expiryDate} />
                ) : undefined
              }
              label="Expiry Date"
              value={formatDate(license.expiryDate)}
            />
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
