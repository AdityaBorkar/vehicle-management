import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, ShieldCheck } from "lucide-react";

import { CenteredLoader } from "#/components/centered-loader";
import { PageHeader } from "#/components/page-header";
import { SettingsNav } from "#/components/settings-nav";
import { Badge } from "#/components/ui/badge";
import { Card } from "#/components/ui/card";
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
		<div className="space-y-8">
			<PageHeader
				description="The number reminders will use, and the state of WhatsApp delivery for this fleet."
				eyebrow="Account / WhatsApp"
				title="WhatsApp"
			/>
			<SettingsNav />

			<Card className="max-w-3xl">
				<div className="flex items-center gap-4 px-5">
					<div className="grid size-11 place-items-center rounded-full border border-border bg-muted/40">
						<MessageCircle className="size-5" strokeWidth={1.6} />
					</div>
					<div className="min-w-0 flex-1">
						<h2 className="font-medium text-[15px]">Login number</h2>
						<p className="text-muted-foreground text-sm">
							One-time codes are sent to this number
						</p>
					</div>
					{phoneNumber ? (
						<Badge variant="secondary">
							<ShieldCheck className="mr-1 size-3" />
							Verified
						</Badge>
					) : null}
				</div>
				<div className="flex items-center justify-between border-t border-border px-5 py-4">
					<span className="text-muted-foreground text-sm">Phone</span>
					<span className="font-mono text-[13px]">{phoneNumber ?? "—"}</span>
				</div>
			</Card>

			<div className="max-w-3xl rounded-2xl border border-dashed border-border px-5 py-6">
				<p className="eyebrow">Coming soon</p>
				<p className="mt-2 max-w-lg text-muted-foreground text-sm">
					WhatsApp reminders and group commands are not configured yet. Document
					expiry reminders currently appear under Calendar.
				</p>
			</div>
		</div>
	);
}
