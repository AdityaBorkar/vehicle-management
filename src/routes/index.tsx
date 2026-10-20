import { createFileRoute, redirect } from "@tanstack/react-router";
import { Car } from "lucide-react";
import { useId, useState } from "react";

import { ThemeToggle } from "#/components/theme-toggle";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { authClient } from "#/lib/auth-client";
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

function LoginPage() {
	const uid = useId();
	const [phoneNumber, setPhoneNumber] = useState("");
	const [code, setCode] = useState("");
	const [otpSent, setOtpSent] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSendOtp(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		const normalizedPhone = normalizePhoneNumber(phoneNumber);
		if (!isValidPhoneNumber(normalizedPhone)) {
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

	async function handleDevLogin() {
		setError("");
		const normalizedPhone = normalizePhoneNumber(phoneNumber);
		if (!isValidPhoneNumber(normalizedPhone)) {
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
			window.location.href = "/";
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "An unexpected error occurred",
			);
		} finally {
			setLoading(false);
		}
	}

	async function handleVerifyOtp(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			const result = await authClient.phoneNumber.verify({
				code,
				phoneNumber: normalizePhoneNumber(phoneNumber),
			});
			if (result.error) {
				// better-auth returns 500 "Failed to update user" when no user
				// row matches (signups are disabled, so no auto-create).
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
				window.location.href = "/";
			}
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="relative flex min-h-screen items-center justify-center bg-muted/30 p-4">
			<ThemeToggle className="absolute top-4 right-4" />
			<Card className="w-full max-w-sm shadow-lg">
				<CardHeader className="text-center">
					<div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
						<Car className="h-6 w-6 text-primary" />
					</div>
					<CardTitle className="text-xl">Vahan</CardTitle>
					<CardDescription>
						{otpSent
							? "Enter the OTP sent to your phone"
							: "Enter your phone number to receive an OTP"}
					</CardDescription>
				</CardHeader>
				{otpSent ? (
					<form onSubmit={handleVerifyOtp}>
						<CardContent className="space-y-4">
							{error && (
								<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
									{error}
								</div>
							)}
							<div className="space-y-2">
								<Label htmlFor={`${uid}-otp`}>OTP</Label>
								<Input
									autoFocus
									id={`${uid}-otp`}
									inputMode="numeric"
									maxLength={6}
									onChange={(e) => setCode(e.target.value)}
									placeholder="123456"
									required
									type="text"
									value={code}
								/>
							</div>
						</CardContent>
						<CardFooter className="flex flex-col gap-3">
							<Button className="w-full" disabled={loading} type="submit">
								{loading ? "Verifying..." : "Verify OTP"}
							</Button>
							<Button
								className="text-muted-foreground"
								onClick={() => {
									setOtpSent(false);
									setCode("");
									setError("");
								}}
								size="sm"
								type="button"
								variant="ghost"
							>
								Use a different phone number
							</Button>
						</CardFooter>
					</form>
				) : (
					<form onSubmit={handleSendOtp}>
						<CardContent className="space-y-4">
							{error && (
								<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
									{error}
								</div>
							)}
							<div className="space-y-2">
								<Label htmlFor={`${uid}-phone`}>Phone Number</Label>
								<Input
									autoFocus
									id={`${uid}-phone`}
									onChange={(e) => setPhoneNumber(e.target.value)}
									placeholder="+919876543210"
									required
									type="tel"
									value={phoneNumber}
								/>
							</div>
						</CardContent>
						<CardFooter className="flex-col gap-2">
							<Button className="w-full" disabled={loading} type="submit">
								{loading ? "Sending..." : "Send OTP"}
							</Button>
							{import.meta.env.DEV ? (
								<Button
									className="w-full"
									disabled={loading}
									onClick={() => void handleDevLogin()}
									type="button"
									variant="secondary"
								>
									{loading ? "Working..." : "Dev login (autofill OTP)"}
								</Button>
							) : null}
						</CardFooter>
					</form>
				)}
			</Card>
		</div>
	);
}
