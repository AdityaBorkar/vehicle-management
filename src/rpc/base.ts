import { ORPCError, os } from "@orpc/server";

import { auth } from "#/lib/auth-server";

export const base = os.$context<{ headers: Headers }>();

function formatPath(path: readonly string[] | string): string {
	return typeof path === "string" ? path : path.join(".");
}

export const loggingMiddleware = base.middleware(
	async ({ context, next, path }) => {
		const route = formatPath(path);
		const userId = (context as { user?: { id?: string } }).user?.id;
		const prefix = userId ? `[rpc] ${route} user=${userId}` : `[rpc] ${route}`;
		const start = Date.now();
		try {
			const result = await next();
			console.log(`${prefix} ok in ${Date.now() - start}ms`);
			return result;
		} catch (err) {
			const code = err instanceof ORPCError ? err.code : "UNKNOWN";
			console.error(`${prefix} failed (${code}) in ${Date.now() - start}ms`);
			throw err;
		}
	},
);

export const authMiddleware = base.middleware(async ({ context, next }) => {
	const session = await auth.api.getSession({
		headers: context.headers,
	});

	if (!session?.session || !session?.user) {
		throw new ORPCError("UNAUTHORIZED", {
			message: "You must be logged in to perform this action",
		});
	}

	return next({
		context: {
			session: session.session,
			user: session.user,
		},
	});
});

export const publicProcedure = base.use(loggingMiddleware);

export const protectedProcedure = publicProcedure.use(authMiddleware);

// Alias kept for the document-management / APIExpress-lookup side of the
// merge, which names the authed procedure `authorized`. Same middleware,
// minus the logging wrapper.
export const authorized = base.use(authMiddleware);
