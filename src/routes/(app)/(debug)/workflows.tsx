import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";

export const Route = createFileRoute("/(app)/(debug)/workflows")({
	component: WorkflowsPage,
});

const KNOWN_ROUTES = [
	"/dashboard",
	"/vehicles",
	"/drivers",
	"/calendar",
	"/settings/user",
	"/settings/connections",
	"/settings/whatsapp",
	"/workflows",
];

function WorkflowsPage() {
	return (
		<div className="space-y-6">
			<h1 className="font-bold text-2xl">Workflows</h1>
			<Card>
				<CardHeader className="flex flex-row items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
						<FlaskConical className="h-5 w-5 text-primary" />
					</div>
					<div>
						<CardTitle className="text-base">Debug area</CardTitle>
						<p className="text-muted-foreground text-sm">
							Automated RTO workflows are not wired up yet
						</p>
					</div>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<p className="text-muted-foreground">
						Reachable app routes in this build:
					</p>
					<ul className="list-inside list-disc space-y-1 font-mono text-xs">
						{KNOWN_ROUTES.map((r) => (
							<li key={r}>{r}</li>
						))}
					</ul>
				</CardContent>
			</Card>
		</div>
	);
}
