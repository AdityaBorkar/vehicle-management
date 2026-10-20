import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, Mail, Phone, ShieldCheck, User } from "lucide-react";

import { CenteredLoader } from "#/components/centered-loader";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
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
		<div className="space-y-6">
			<h1 className="font-bold text-2xl">Profile</h1>
			<Card>
				<CardHeader className="flex flex-row items-center gap-3">
					<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground text-lg">
						{user.name?.charAt(0).toUpperCase() ?? <User className="h-6 w-6" />}
					</div>
					<div>
						<CardTitle className="text-lg">{user.name}</CardTitle>
						<p className="text-muted-foreground text-sm">{user.email}</p>
					</div>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					<div className="flex items-center justify-between">
						<span className="flex items-center gap-2 text-muted-foreground">
							<Mail className="h-4 w-4" />
							Email
						</span>
						<span className="flex items-center gap-2">
							{user.email}
							{user.emailVerified && (
								<Badge variant="secondary">
									<ShieldCheck className="mr-1 h-3 w-3" />
									Verified
								</Badge>
							)}
						</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="flex items-center gap-2 text-muted-foreground">
							<Phone className="h-4 w-4" />
							Phone
						</span>
						<span>{user.phoneNumber ?? "—"}</span>
					</div>
				</CardContent>
			</Card>
			<Button
				onClick={async () => {
					await authClient.signOut();
					await navigate({ to: "/" });
				}}
				type="button"
				variant="outline"
			>
				<LogOut className="mr-2 h-4 w-4" />
				Sign out
			</Button>
		</div>
	);
}
