import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Download, QrCode, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { FormEvent, ReactNode } from "react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";

export const Route = createFileRoute("/(app)/upi")({
	component: UpiQrPage,
});

const DEFAULT_UPI_ID = "vasundhara.gta@oksbi";
const TRACKING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateTrackingNote(): string {
	const bytes = new Uint32Array(5);
	crypto.getRandomValues(bytes);
	let note = "";
	for (const b of bytes) {
		note += TRACKING_ALPHABET[b % TRACKING_ALPHABET.length];
	}
	return note;
}

function buildUpiUri(upiId: string, amount: string, note: string): string {
	const params = new URLSearchParams({
		am: amount,
		cu: "INR",
		pa: upiId,
		tn: note,
		tr: note,
	});
	return `upi://pay?${params.toString()}`;
}

function isValidUpiId(value: string): boolean {
	return /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test(value);
}

function parseAmount(value: string): string | null {
	const trimmed = value.trim();
	if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
	const num = Number(trimmed);
	if (!Number.isFinite(num) || num <= 0) return null;
	return num.toFixed(2);
}

type GeneratedQr = {
	upiId: string;
	amount: string;
	note: string;
	uri: string;
};

function UpiQrPage(): ReactNode {
	const uid = useId();
	const svgRef = useRef<SVGSVGElement>(null);
	const [upiId, setUpiId] = useState(DEFAULT_UPI_ID);
	const [amount, setAmount] = useState("");
	const [error, setError] = useState("");
	const [copied, setCopied] = useState(false);
	const [qr, setQr] = useState<GeneratedQr | null>(null);

	function handleSubmit(e: FormEvent): void {
		e.preventDefault();
		setError("");
		setCopied(false);

		const cleanUpiId = upiId.trim();
		if (!isValidUpiId(cleanUpiId)) {
			setError("Enter a valid UPI ID (e.g. name@bank).");
			return;
		}
		const normalizedAmount = parseAmount(amount);
		if (!normalizedAmount) {
			setError("Enter a valid amount greater than 0 (up to 2 decimals).");
			return;
		}

		// Hidden tracking remark: fresh 5-char alphanumeric code per QR.
		const note = generateTrackingNote();
		const uri = buildUpiUri(cleanUpiId, normalizedAmount, note);
		setQr({ amount: normalizedAmount, note, upiId: cleanUpiId, uri });
	}

	function handleRegenerate(): void {
		if (!qr) return;
		const note = generateTrackingNote();
		const uri = buildUpiUri(qr.upiId, qr.amount, note);
		setQr({ ...qr, note, uri });
		setCopied(false);
	}

	async function handleCopy(): Promise<void> {
		if (!qr) return;
		try {
			await navigator.clipboard.writeText(qr.uri);
			setCopied(true);
			toast.success("UPI link copied");
		} catch {
			toast.error("Failed to copy — select and copy the link manually");
		}
	}

	function handleDownload(): void {
		const svg = svgRef.current;
		if (!svg || !qr) return;
		const markup = new XMLSerializer().serializeToString(svg);
		const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `upi-qr-${qr.note}.svg`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-bold text-2xl">UPI Payment QR</h1>
				<p className="text-muted-foreground text-sm">
					Enter an amount to generate a scannable UPI QR with a hidden tracking
					note.
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Payment details</CardTitle>
						<CardDescription>
							A 5-character tracking code is embedded in the QR automatically.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form className="space-y-4" onSubmit={handleSubmit}>
							{error !== "" ? (
								<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
									{error}
								</div>
							) : null}
							<div className="space-y-2">
								<Label htmlFor={`${uid}-upiId`}>UPI ID</Label>
								<Input
									autoComplete="off"
									id={`${uid}-upiId`}
									onChange={(e) => setUpiId(e.target.value)}
									placeholder="name@bank"
									required
									value={upiId}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor={`${uid}-amount`}>Amount (₹)</Label>
								<Input
									id={`${uid}-amount`}
									inputMode="decimal"
									min="0"
									onChange={(e) => setAmount(e.target.value)}
									placeholder="500.00"
									required
									step="0.01"
									type="number"
									value={amount}
								/>
							</div>
							{/* Hidden tracking remark — auto-generated per QR, never typed. */}
							<input name="tn" readOnly type="hidden" value={qr?.note ?? ""} />
							<Button className="w-full" type="submit">
								<QrCode className="mr-2 h-4 w-4" />
								Generate QR
							</Button>
						</form>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>QR code</CardTitle>
						<CardDescription>
							{qr
								? "Scan with any UPI app to pay."
								: "Your QR will appear here."}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{!qr ? (
							<div className="flex flex-col items-center gap-3 py-12 text-center">
								<QrCode className="h-12 w-12 text-muted-foreground" />
								<p className="text-muted-foreground text-sm">
									Enter a UPI ID and amount, then generate a QR.
								</p>
							</div>
						) : (
							<div className="flex flex-col items-center gap-4">
								<div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-foreground/10">
									<QRCodeSVG
										height={224}
										ref={svgRef}
										value={qr.uri}
										width={224}
									/>
								</div>
								<dl className="w-full space-y-1.5 text-sm">
									<div className="flex justify-between gap-4">
										<dt className="text-muted-foreground">Pay to</dt>
										<dd className="break-all font-medium">{qr.upiId}</dd>
									</div>
									<div className="flex justify-between gap-4">
										<dt className="text-muted-foreground">Amount</dt>
										<dd className="font-medium">₹{qr.amount}</dd>
									</div>
									<div className="flex justify-between gap-4">
										<dt className="text-muted-foreground">Tracking ref</dt>
										<dd className="font-mono font-medium tracking-widest">
											{qr.note}
										</dd>
									</div>
								</dl>
								<p className="w-full break-all rounded-md bg-muted p-2 font-mono text-muted-foreground text-xs">
									{qr.uri}
								</p>
								<div className="flex w-full flex-wrap gap-2">
									<Button
										className="flex-1"
										onClick={() => void handleCopy()}
										type="button"
										variant="outline"
									>
										{copied ? (
											<Check className="mr-2 h-4 w-4" />
										) : (
											<Copy className="mr-2 h-4 w-4" />
										)}
										{copied ? "Copied" : "Copy link"}
									</Button>
									<Button
										className="flex-1"
										onClick={handleDownload}
										type="button"
										variant="outline"
									>
										<Download className="mr-2 h-4 w-4" />
										Download
									</Button>
									<Button
										className="flex-1"
										onClick={handleRegenerate}
										type="button"
										variant="ghost"
									>
										<RefreshCw className="mr-2 h-4 w-4" />
										New code
									</Button>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
