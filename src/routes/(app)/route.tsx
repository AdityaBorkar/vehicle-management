import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/(app)"!</div>;
}

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (data?.user) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-bold text-2xl">Vehicle Management</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Manage your vehicles and driving licenses
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
