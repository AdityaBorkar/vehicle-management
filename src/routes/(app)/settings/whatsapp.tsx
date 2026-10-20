import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, ShieldCheck } from "lucide-react";

import { CenteredLoader } from "#/components/centered-loader";
import { Badge } from "#/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/(app)/settings/whatsapp")({
	component: WhatsappSettingsPage,
});

function WhatsappSettingsPage() {
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return <CenteredLoader />;
	}

	const phoneNumber = session?.user?.phoneNumber;

	return (
		<div className="space-y-6">
			<h1 className="font-bold text-2xl">WhatsApp</h1>
			<Card>
				<CardHeader className="flex flex-row items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
						<MessageCircle className="h-5 w-5 text-primary" />
					</div>
					<div>
						<CardTitle className="text-base">Login number</CardTitle>
						<p className="text-muted-foreground text-sm">
							OTP codes are sent to this number
						</p>
					</div>
				</CardHeader>
				<CardContent className="flex items-center justify-between text-sm">
					<span className="font-medium">{phoneNumber ?? "—"}</span>
					{phoneNumber ? (
						<Badge variant="secondary">
							<ShieldCheck className="mr-1 h-3 w-3" />
							Verified
						</Badge>
					) : null}
				</CardContent>
			</Card>
			<Card>
				<CardContent className="py-6 text-muted-foreground text-sm">
					WhatsApp reminders and group commands are not configured yet. Document
					expiry reminders currently appear under Calendar.
				</CardContent>
			</Card>
		</div>
	);
}
