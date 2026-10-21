import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, Mail, Phone, ShieldCheck, User } from "lucide-react";

import { CenteredLoader } from "#/components/centered-loader";
import { PageHeader } from "#/components/page-header";
import { SettingsNav } from "#/components/settings-nav";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/(app)/settings/user")({
	component: UserSettingsPage,
});

function UserSettingsPage() {
	const { data: session, isPending } = authClient.useSession();
	const navigate = useNavigate();

	if (isPending) {
		return <CenteredLoader />;
	}

	const user = session?.user;
	if (!user) {
		return (
			<div className="py-12 text-center">
				<p className="text-muted-foreground">Not signed in</p>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<PageHeader
				description="Your account and how you sign in. One phone number, one session, no passwords."
				eyebrow="Account / Profile"
				title="Profile"
			/>
			<SettingsNav />

			<Card className="max-w-3xl">
				<div className="flex flex-col gap-5 px-5 sm:flex-row sm:items-center">
					<div className="grid size-14 shrink-0 place-items-center rounded-full bg-primary font-medium text-lg text-primary-foreground">
						{user.name?.charAt(0).toUpperCase() ?? <User className="size-6" />}
					</div>
					<div className="min-w-0 flex-1">
						<h2 className="truncate font-medium text-2xl tracking-[-0.03em]">
							{user.name}
						</h2>
						<p className="truncate text-muted-foreground text-sm">
							{user.email}
						</p>
					</div>
					<Badge variant="secondary">
						<ShieldCheck className="mr-1 size-3" />
						Phone verified
					</Badge>
				</div>

				<div className="border-t border-border">
					<div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
						<span className="flex items-center gap-2 text-muted-foreground text-sm">
							<Mail className="size-4" strokeWidth={1.7} />
							Email
						</span>
						<span className="flex items-center gap-2 text-sm">
							{user.email}
							{user.emailVerified && (
								<Badge variant="outline">
									<ShieldCheck className="mr-1 size-3" />
									Verified
								</Badge>
							)}
						</span>
					</div>
					<div className="flex flex-col gap-1 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
						<span className="flex items-center gap-2 text-muted-foreground text-sm">
							<Phone className="size-4" strokeWidth={1.7} />
							Phone
						</span>
						<span className="font-mono text-[13px]">
							{user.phoneNumber ?? "—"}
						</span>
					</div>
				</div>
			</Card>

			<div className="flex max-w-3xl items-center justify-between rounded-2xl border border-border bg-card px-5 py-4">
				<div>
					<p className="font-medium text-sm">Sign out of this device</p>
					<p className="text-muted-foreground text-xs">
						Your records stay safe. You can sign back in with a one-time code.
					</p>
				</div>
				<Button
					onClick={async () => {
						await authClient.signOut();
						await navigate({ to: "/" });
					}}
					type="button"
					variant="outline"
				>
					<LogOut className="size-4" />
					Sign out
				</Button>
			</div>
		</div>
	);
}
