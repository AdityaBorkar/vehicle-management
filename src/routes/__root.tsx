import type { QueryClient } from "@tanstack/query-core";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRouteWithContext,
	type ErrorComponentProps,
	HeadContent,
	Link,
	Scripts,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";

import { CenteredLoader } from "#/components/centered-loader";
import { SiteFooter } from "#/components/site-footer";
import { SiteHeader } from "#/components/site-header";
import { ThemeProvider } from "#/components/theme-provider";
// import PostHogProvider from "#/posthog/provider";
import { Button, buttonVariants } from "#/components/ui/button";
import { Toaster } from "#/components/ui/sonner";
import { authClient } from "#/lib/auth-client";
import { MAIN_CONTENT_ID } from "#/lib/constants";
import appCss from "./styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
	{
		errorComponent: ErrorPage,
		head: () => ({
			links: [
				{ href: appCss, rel: "stylesheet" },
				{ href: "/favicon.svg", rel: "icon", type: "image/svg+xml" },
			],
			meta: [
				{ charSet: "utf-8" },
				{ content: "width=device-width, initial-scale=1", name: "viewport" },
				{ title: "Vahan — Fleet operations, in order" },
				{
					content:
						"Vehicles, drivers, documents and reminders — every detail in one calm, ordered place.",
					name: "description",
				},
				{
					content: "#ffffff",
					media: "(prefers-color-scheme: light)",
					name: "theme-color",
				},
				{
					content: "#0a0a0a",
					media: "(prefers-color-scheme: dark)",
					name: "theme-color",
				},
			],
		}),
		notFoundComponent: NotFoundPage,
		shellComponent: RootDocument,
	},
);

function ErrorPage({ error, reset }: ErrorComponentProps): ReactNode {
	return (
		<div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
			<div className="dot-grid pointer-events-none absolute inset-0 text-foreground opacity-[0.12] [mask-image:radial-gradient(50%_50%_at_50%_50%,black,transparent)]" />
			<p className="eyebrow relative">Something went wrong</p>
			<h1 className="display relative mt-4">A detour.</h1>
			<p className="lede relative mt-4 max-w-md">
				We hit an unexpected error. Try again, or head back to the overview.
			</p>
			<div className="relative mt-8 flex flex-wrap justify-center gap-3">
				<Button onClick={reset} size="lg" type="button">
					Try again
				</Button>
				<Link
					className={buttonVariants({ size: "lg", variant: "outline" })}
					to="/dashboard"
				>
					Back to overview
				</Link>
			</div>
			<details className="relative mt-10 max-w-lg text-left">
				<summary className="eyebrow cursor-pointer">Error details</summary>
				<pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-card p-3 font-mono text-muted-foreground text-xs">
					{error instanceof Error ? error.message : String(error)}
				</pre>
			</details>
		</div>
	);
}

function NotFoundPage(): ReactNode {
	return (
		<div className="relative flex min-h-[65vh] flex-col items-center justify-center overflow-hidden py-16 text-center">
			<div className="dot-grid pointer-events-none absolute inset-0 text-foreground opacity-[0.12] [mask-image:radial-gradient(50%_50%_at_50%_50%,black,transparent)]" />
			<p className="eyebrow relative">Error 404</p>
			<h1 className="display relative mt-4">Off the map.</h1>
			<p className="lede relative mt-4 max-w-md">
				This page doesn’t exist — or it moved. Head back to the overview and
				pick up the thread.
			</p>
			<Link
				className={buttonVariants({ className: "relative mt-8", size: "lg" })}
				to="/dashboard"
			>
				Back to overview
			</Link>
		</div>
	);
}

function RootDocument({ children }: { children: ReactNode }): ReactNode {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				<a className="skip-link" href={`#${MAIN_CONTENT_ID}`}>
					Skip to content
				</a>
				{/*<PostHogProvider>*/}
				<ThemeProvider>
					<AppShell>{children}</AppShell>
					<Toaster />
				</ThemeProvider>
				{/*</PostHogProvider>*/}
				<TanStackDevtools
					config={{ position: "bottom-right" }}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}

export function AppShell({ children }: { children: ReactNode }): ReactNode {
	const { data: session, isPending } = authClient.useSession();
	const navigate = useNavigate();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	async function handleSignOut(): Promise<void> {
		await authClient.signOut();
		await navigate({ to: "/" });
	}

	if (isPending) {
		return <CenteredLoader />;
	}

	if (!session?.user) {
		return <>{children}</>;
	}

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<SiteHeader
				onSignOut={() => void handleSignOut()}
				user={{ email: session.user.email, name: session.user.name }}
			/>
			<main
				className="page-enter mx-auto w-full max-w-[1320px] flex-1 px-5 py-10 md:px-8 md:py-14"
				id={MAIN_CONTENT_ID}
				key={pathname}
			>
				{children}
			</main>
			<SiteFooter />
		</div>
	);
}
