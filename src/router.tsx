import { QueryClient } from "@tanstack/query-core";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { routeTree } from "./routeTree.gen";

const QUERY_STALE_MS = 60 * 1000;

export function getRouter() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { staleTime: QUERY_STALE_MS },
		},
	});

	const router = createTanStackRouter({
		context: { queryClient },
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		routeTree,
		scrollRestoration: true,
	});

	setupRouterSsrQueryIntegration({ queryClient, router });

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
