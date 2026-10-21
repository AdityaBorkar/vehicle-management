import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";

import { PageHeader } from "#/components/page-header";
import { Card } from "#/components/ui/card";

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
		<div className="space-y-8">
			<PageHeader
				description="Automated RTO workflows are not wired up yet. This area lists the routes available in this build."
				eyebrow="Debug / Workflows"
				title="Workflows"
			/>
			<Card className="max-w-3xl">
				<div className="flex items-center gap-4 px-5">
					<div className="grid size-11 place-items-center rounded-full border border-border bg-muted/40">
						<FlaskConical className="size-5" strokeWidth={1.6} />
					</div>
					<div>
						<h2 className="font-medium text-[15px]">Debug area</h2>
						<p className="text-muted-foreground text-sm">
							Reachable app routes in this build
						</p>
					</div>
				</div>
				<ul className="grid gap-1 border-t border-border px-5 py-4 font-mono text-xs sm:grid-cols-2">
					{KNOWN_ROUTES.map((route) => (
						<li
							className="rounded-lg px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
							key={route}
						>
							{route}
						</li>
					))}
				</ul>
			</Card>
		</div>
	);
}
