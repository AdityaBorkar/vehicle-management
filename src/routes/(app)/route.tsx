import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getSession } from "../api/-auth";

export const Route = createFileRoute("/(app)")({
	beforeLoad: async () => {
		const data = await getSession();
		if (!data?.user) {
			throw redirect({ to: "/" });
		}
		return data;
	},
	component: AuthLayout,
});

function AuthLayout() {
	return <Outlet />;
}
