import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Bell, Car, CreditCard, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import { orpc } from "@/lib/orpc-query";

export const Route = createFileRoute("/(app)/dashboard")({
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (!data?.user) {
      throw redirect({ to: "/auth/login" });
    }
  },
  component: Dashboard,
});

function Dashboard() {
  const { data: vehicleList } = useQuery(orpc.vehicle.list.queryOptions());
  const { data: licenseList } = useQuery(orpc.license.list.queryOptions());
  const { data: upcomingReminders } = useQuery(
    orpc.reminder.getUpcoming.queryOptions(),
  );

  const vehicles = vehicleList ?? [];
  const licenses = licenseList ?? [];
  const reminders = upcomingReminders ?? [];

  const expiringInsurance = vehicles.filter((v) => {
    if (!v.insuranceValidTill) return false;
    const daysLeft = Math.ceil(
      (v.insuranceValidTill.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return daysLeft <= 30 && daysLeft >= 0;
  });

  const expiringLicenses = licenses.filter((l) => {
    if (!l.expiryDate) return false;
    const daysLeft = Math.ceil(
      (l.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return daysLeft <= 30 && daysLeft >= 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-2xl">Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-sm">Vehicles</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{vehicles.length}</div>
            {expiringInsurance.length > 0 && (
              <p className="text-destructive text-xs">
                {expiringInsurance.length} insurance expiring soon
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-sm">Licenses</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{licenses.length}</div>
            {expiringLicenses.length > 0 && (
              <p className="text-destructive text-xs">
                {expiringLicenses.length} expiring soon
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-sm">
              Upcoming Reminders
            </CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{reminders.length}</div>
            {reminders.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Next: {reminders[0]?.title}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {vehicles.length === 0 && licenses.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Car className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h2 className="font-semibold text-lg">Get Started</h2>
              <p className="text-muted-foreground text-sm">
                Add your first vehicle or driving license to get started
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/vehicles">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Vehicle
                </Button>
              </Link>
              <Link to="/licenses">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add License
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {reminders.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold text-lg">Upcoming Reminders</h2>
          <div className="space-y-2">
            {reminders.slice(0, 5).map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-sm">{r.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {r.type} &middot; Due{" "}
                      {new Date(r.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <ReminderBadge dueDate={r.dueDate} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReminderBadge({ dueDate }: { dueDate: Date }) {
  const daysLeft = Math.ceil(
    (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (daysLeft <= 0)
    return (
      <span className="rounded bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs">
        Overdue
      </span>
    );
  if (daysLeft <= 3)
    return (
      <span className="rounded bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs">
        {daysLeft}d left
      </span>
    );
  if (daysLeft <= 7)
    return (
      <span className="rounded bg-yellow-500/10 px-2 py-0.5 font-medium text-xs text-yellow-600 dark:text-yellow-400">
        {daysLeft}d left
      </span>
    );
  return (
    <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
      {daysLeft}d left
    </span>
  );
}
