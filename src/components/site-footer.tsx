import { Link } from "@tanstack/react-router";

import { LogoMark } from "#/components/brand";

const columns = [
	{
		links: [
			{ label: "Overview", to: "/dashboard" },
			{ label: "Vehicles", to: "/vehicles" },
			{ label: "Drivers", to: "/drivers" },
		],
		title: "Fleet",
	},
	{
		links: [
			{ label: "Documents", to: "/documents" },
			{ label: "UPI QR", to: "/upi" },
			{ label: "Connections", to: "/settings/connections" },
		],
		title: "Records",
	},
	{
		links: [
			{ label: "Profile", to: "/settings/user" },
			{ label: "WhatsApp", to: "/settings/whatsapp" },
			{ label: "Workflows", to: "/workflows" },
		],
		title: "Account",
	},
] as const;

export function SiteFooter() {
	const year = new Date().getFullYear();

	return (
		<footer className="no-print mt-20 bg-footer text-footer-foreground">
			<div className="mx-auto max-w-[1320px] px-5 pt-14 pb-8 md:px-8 md:pt-20">
				<div className="grid gap-12 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
					<div className="max-w-xs">
						<Link className="inline-flex items-center gap-2" to="/dashboard">
							<LogoMark className="size-5" />
							<span className="font-semibold text-[17px] tracking-[-0.04em]">
								Vahan
							</span>
						</Link>
						<p className="mt-4 text-sm opacity-55">
							Vehicles, drivers, documents and reminders — every detail in one
							calm, ordered place.
						</p>
						<p className="mt-8 font-mono text-[10px] uppercase tracking-[0.16em] opacity-40">
							Fleet operations, in order
						</p>
					</div>

					{columns.map((column) => (
						<div key={column.title}>
							<p className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-40">
								{column.title}
							</p>
							<ul className="mt-4 space-y-2.5">
								{column.links.map((link) => (
									<li key={link.to}>
										<Link
											className="text-sm opacity-70 transition-opacity hover:opacity-100"
											to={link.to}
										>
											{link.label}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>

				<p
					aria-hidden="true"
					className="pointer-events-none mt-16 select-none font-semibold text-[clamp(4.5rem,14vw,12rem)] leading-[0.75] tracking-[-0.06em] opacity-[0.07]"
				>
					Vahan
				</p>

				<div className="mt-8 flex flex-col gap-3 border-t border-footer-border pt-6 text-[11px] opacity-45 sm:flex-row sm:items-center sm:justify-between">
					<p>© {year} Vahan. All rights reserved.</p>
					<p className="font-mono uppercase tracking-[0.14em]">
						Built for operators
					</p>
				</div>
			</div>
		</footer>
	);
}
