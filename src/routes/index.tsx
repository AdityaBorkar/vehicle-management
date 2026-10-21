import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	ArrowUpRight,
	Bell,
	Car,
	FileText,
	Loader2,
	Phone,
	ShieldCheck,
} from "lucide-react";
import type { ComponentType, FormEvent, ReactNode } from "react";
import { useId, useState } from "react";

import { Wordmark } from "#/components/brand";
import { Stamp } from "#/components/stamp";
import { ThemeToggle } from "#/components/theme-toggle";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { authClient } from "#/lib/auth-client";
import { MAIN_CONTENT_ID } from "#/lib/constants";
import { isValidPhoneNumber, normalizePhoneNumber } from "#/lib/utils";
import { getSession } from "./api/-auth";
import { getDevOtpCode } from "./api/-dev";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const data = await getSession();
		if (data?.user) {
			throw redirect({ to: "/dashboard" });
		}
		return data;
	},
	component: LoginPage,
});

const highlights: {
	icon: ComponentType<{ className?: string; strokeWidth?: number }>;
	title: string;
	description: string;
}[] = [
	{
		description: "One-time codes. No passwords to manage or forget.",
		icon: Phone,
		title: "Phone-first access",
	},
	{
		description: "Registrations, insurance, fitness and PUC — kept current.",
		icon: FileText,
		title: "Compliant by default",
	},
	{
		description: "Renewals surface before they lapse, never after.",
		icon: Bell,
		title: "Reminders that arrive early",
	},
];

function FormError({ message }: { message: string }): ReactNode {
	if (!message) return null;
	return (
		<div
			className="rise-in flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-destructive text-sm"
			role="alert"
		>
			<span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-destructive" />
			<span>{message}</span>
		</div>
	);
}

function formatPhoneDisplay(value: string): string {
	const digits = value.replace(/\D/g, "");
	if (digits.length === 12 && digits.startsWith("91")) {
		return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
	}
	return value;
}

function LoginPage(): ReactNode {
	const uid = useId();
	const [phoneNumber, setPhoneNumber] = useState("");
	const [code, setCode] = useState("");
	const [otpSent, setOtpSent] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	function resetToPhone(): void {
		setOtpSent(false);
		setCode("");
		setError("");
	}

	function reloadHome(): void {
		window.location.href = "/";
	}

	function validatePhone(value: string): string | null {
		const normalized = normalizePhoneNumber(value);
		if (!isValidPhoneNumber(normalized)) {
			return null;
		}
		return normalized;
	}

	async function handleSendOtp(e: FormEvent): Promise<void> {
		e.preventDefault();
		setError("");
		const normalizedPhone = validatePhone(phoneNumber);
		if (!normalizedPhone) {
			setError("Enter a valid phone number.");
			return;
		}
		setLoading(true);
		try {
			const result = await authClient.phoneNumber.sendOtp({
				phoneNumber: normalizedPhone,
			});
			if (result.error) {
				setError(result.error.message ?? "Failed to send OTP");
			} else {
				setOtpSent(true);
			}
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setLoading(false);
		}
	}

	async function handleDevLogin(): Promise<void> {
		setError("");
		const normalizedPhone = validatePhone(phoneNumber);
		if (!normalizedPhone) {
			setError("Enter a valid phone number first.");
			return;
		}
		setLoading(true);
		try {
			const sent = await authClient.phoneNumber.sendOtp({
				phoneNumber: normalizedPhone,
			});
			if (sent.error) {
				setError(sent.error.message ?? "Failed to send OTP");
				return;
			}
			const { code: devCode } = await getDevOtpCode({
				data: { phoneNumber: normalizedPhone },
			});
			const verified = await authClient.phoneNumber.verify({
				code: devCode,
				phoneNumber: normalizedPhone,
			});
			if (verified.error) {
				setError(verified.error.message ?? "Verification failed");
				return;
			}
			reloadHome();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "An unexpected error occurred",
			);
		} finally {
			setLoading(false);
		}
	}

	async function handleVerifyOtp(e: FormEvent): Promise<void> {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			const result = await authClient.phoneNumber.verify({
				code,
				phoneNumber: normalizePhoneNumber(phoneNumber),
			});
			if (result.error) {
				// Signups are disabled, so better-auth returns 500 when no user row matches.
				const status = (result.error as { status?: number }).status;
				if (
					status === 500 ||
					result.error.message === "Failed to update user"
				) {
					setError(
						"This phone number is not registered. Contact your admin, or retry with the exact seeded number.",
					);
				} else {
					setError(result.error.message ?? "Verification failed");
				}
			} else {
				reloadHome();
			}
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setLoading(false);
		}
	}

	const normalized = validatePhone(phoneNumber);

	return (
		<div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
			<div className="hero-glow" />
			<div
				aria-hidden="true"
				className="orb top-[-14rem] right-[-10rem] size-[34rem] opacity-30"
			/>
			<div
				aria-hidden="true"
				className="orb bottom-[-18rem] left-[-12rem] size-[30rem] opacity-20"
			/>

			<header className="relative z-10 mx-auto flex w-full max-w-[1320px] items-center justify-between px-5 py-6 md:px-8">
				<Wordmark showTag />
				<div className="flex items-center gap-3">
					<span className="hidden text-muted-foreground text-sm sm:inline">
						Secure, passwordless access
					</span>
					<ThemeToggle />
				</div>
			</header>

			<main
				className="relative z-10 mx-auto grid w-full max-w-[1320px] flex-1 items-center gap-12 px-5 pt-4 pb-16 md:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-24 lg:pt-8 lg:pb-24"
				id={MAIN_CONTENT_ID}
			>
				<section className="page-enter">
					<p className="eyebrow eyebrow-dot">Fleet operations, in order</p>
					<h1 className="display mt-6 max-w-[12ch]">
						Run your fleet from one place.
					</h1>
					<p className="lede mt-7 max-w-md">
						Every vehicle, driver, document and renewal in one calm, ordered
						view. Sign in with the phone number connected to your fleet.
					</p>

					<ul className="mt-10 hidden max-w-md border-y border-border md:block">
						{highlights.map(({ description, icon: Icon, title }) => (
							<li className="flex items-start gap-4 py-4" key={title}>
								<span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card">
									<Icon className="size-4" strokeWidth={1.6} />
								</span>
								<div>
									<p className="font-medium text-[15px] tracking-[-0.01em]">
										{title}
									</p>
									<p className="mt-0.5 text-muted-foreground text-sm">
										{description}
									</p>
								</div>
							</li>
						))}
					</ul>

					<div className="mt-10 hidden items-center gap-6 lg:flex">
						<Stamp className="size-36 opacity-80" />
						<div className="max-w-[22ch]">
							<p className="font-medium text-sm">Built for operators</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Less paperwork. Fewer surprises. Every detail where it should
								be.
							</p>
						</div>
					</div>
				</section>

				<section className="relative w-full max-w-md justify-self-end lg:max-w-none">
					<div className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.35)] md:p-8">
						<div className="dot-grid pointer-events-none absolute inset-0 text-foreground opacity-[0.10] [mask-image:radial-gradient(70%_60%_at_100%_0%,black,transparent)]" />
						<div className="relative">
							<div className="flex items-center justify-between">
								<p className="eyebrow">
									{otpSent ? "Verification" : "Sign in"}
								</p>
								<div aria-hidden="true" className="flex items-center gap-1.5">
									<span className="h-1 w-6 rounded-full bg-foreground" />
									<span
										className={`h-1 w-6 rounded-full ${otpSent ? "bg-foreground" : "bg-border"}`}
									/>
								</div>
							</div>

							<h2 className="mt-4 text-[2rem] leading-[1.05] tracking-[-0.04em]">
								{otpSent ? "Enter your code." : "Welcome back."}
							</h2>
							<p className="mt-2 max-w-sm text-muted-foreground text-sm">
								{otpSent
									? `We sent a six-digit code to ${formatPhoneDisplay(normalized ?? normalizePhoneNumber(phoneNumber))}.`
									: "Use the phone number registered to your fleet. We’ll send a one-time code."}
							</p>

							{otpSent ? (
								<form className="mt-8 space-y-5" onSubmit={handleVerifyOtp}>
									<FormError message={error} />
									<div className="space-y-2">
										<Label htmlFor={`${uid}-otp`}>One-time code</Label>
										<Input
											autoComplete="one-time-code"
											autoFocus
											className="h-14 rounded-2xl border-border text-center font-mono text-2xl tracking-[0.42em] placeholder:tracking-[0.2em] placeholder:text-muted-foreground/50"
											id={`${uid}-otp`}
											inputMode="numeric"
											maxLength={6}
											onChange={(e) =>
												setCode(e.target.value.replace(/\D/g, ""))
											}
											pattern="[0-9]*"
											placeholder="000000"
											required
											type="text"
											value={code}
										/>
									</div>
									<Button
										className="h-11 w-full text-[15px]"
										disabled={loading || code.length < 6}
										size="lg"
										type="submit"
									>
										{loading ? (
											<>
												<Loader2 className="size-4 animate-spin" />
												Verifying…
											</>
										) : (
											<>
												Verify and continue
												<ArrowUpRight className="size-4" />
											</>
										)}
									</Button>
									<Button
										className="w-full text-muted-foreground"
										onClick={resetToPhone}
										size="sm"
										type="button"
										variant="ghost"
									>
										Use a different phone number
									</Button>
								</form>
							) : (
								<form className="mt-8 space-y-5" onSubmit={handleSendOtp}>
									<FormError message={error} />
									<div className="space-y-2">
										<Label htmlFor={`${uid}-phone`}>Phone number</Label>
										<Input
											autoComplete="tel"
											autoFocus
											className="h-11 rounded-xl"
											id={`${uid}-phone`}
											onChange={(e) => setPhoneNumber(e.target.value)}
											placeholder="+91 98765 43210"
											required
											type="tel"
											value={phoneNumber}
										/>
										<p className="text-muted-foreground text-xs">
											Indian numbers can be entered without the +91 prefix.
										</p>
									</div>
									<Button
										className="h-11 w-full text-[15px]"
										disabled={loading}
										size="lg"
										type="submit"
									>
										{loading ? (
											<>
												<Loader2 className="size-4 animate-spin" />
												Sending code…
											</>
										) : (
											<>
												Send one-time code
												<ArrowUpRight className="size-4" />
											</>
										)}
									</Button>
									{import.meta.env.DEV ? (
										<Button
											className="h-11 w-full text-[15px]"
											disabled={loading}
											onClick={() => void handleDevLogin()}
											size="lg"
											type="button"
											variant="secondary"
										>
											{loading ? "Working…" : "Dev login (autofill OTP)"}
										</Button>
									) : null}
								</form>
							)}

							<div className="mt-7 flex items-center gap-2 border-t border-border pt-4 text-muted-foreground text-xs">
								<ShieldCheck className="size-3.5" strokeWidth={1.7} />
								Protected by phone OTP · No passwords stored
							</div>
						</div>
					</div>
					<p className="mt-4 text-center text-muted-foreground text-xs">
						Need access? Contact your fleet administrator.
					</p>
				</section>
			</main>

			<footer className="relative z-10 mx-auto flex w-full max-w-[1320px] flex-col gap-2 border-t border-border px-5 py-5 text-muted-foreground text-xs sm:flex-row sm:items-center sm:justify-between md:px-8">
				<p>© {new Date().getFullYear()} Vahan. All rights reserved.</p>
				<p className="flex items-center gap-2">
					<Car className="size-3.5" strokeWidth={1.7} />
					Fleet operations, in order
				</p>
			</footer>
		</div>
	);
}
