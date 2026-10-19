import type { QueryClient } from "@tanstack/query-core";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Car, Home, LogOut, Users } from "lucide-react";

// import PostHogProvider from "#/posthog/provider";
import { Button } from "#/components/ui/button";
import { Toaster } from "#/components/ui/sonner";
import { authClient } from "#/lib/auth/client";

import appCss from "./styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      links: [{ href: appCss, rel: "stylesheet" }],
      meta: [
        { charSet: "utf-8" },
        { content: "width=device-width, initial-scale=1", name: "viewport" },
        { title: "Vehicle Management" },
      ],
    }),
    shellComponent: RootDocument,
  },
);

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {/*<PostHogProvider>*/}
        <AppShell>{children}</AppShell>
        <Toaster />
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        {/*</PostHogProvider>*/}
        <Scripts />
      </body>
    </html>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session?.user) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 flex-col border-r bg-card">
        <div className="flex h-14 items-center border-b px-4">
          <Car className="mr-2 h-5 w-5 text-primary" />
          <span className="font-semibold">Vahan</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <NavLink icon={Home} label="Dashboard" to="/" />
          <NavLink icon={Car} label="Vehicles" to="/vehicles" />
          <NavLink icon={Users} label="Drivers" to="/drivers" />
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-xs">
              {session.user.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">
                {session.user.name}
              </p>
              <p className="truncate text-muted-foreground text-xs">
                {session.user.email}
              </p>
            </div>
          </div>
          <Button
            className="w-full justify-start"
            onClick={() => void authClient.signOut()}
            size="sm"
            type="button"
            variant="ghost"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6">{children}</div>
      </main>
    </div>
  );
}

export function NavLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:font-medium [&.active]:text-accent-foreground"
      to={to}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
