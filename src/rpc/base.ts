import { ORPCError, os } from "@orpc/server";

import { auth } from "#/lib/auth-server";

export const base = os.$context<{ headers: Headers }>();

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

export const authorized = base.use(authMiddleware);
