import { Loader2, ShieldCheck } from "lucide-react";

import { Button } from "#/components/ui/button";
import { DropdownMenuItem } from "#/components/ui/dropdown-menu";
import { usePuccCertificate } from "#/components/use-pucc-certificate";

interface PuccCertificateButtonProps {
	className?: string;
	registrationNumber: string;
	vehicleId: number;
	vin?: string | null | undefined;
}

/** Opens the stored PUCC PDF in a new tab; fetches + stores first if none. */
export function PuccCertificateButton({
	className,
	registrationNumber,
	vehicleId,
	vin,
}: PuccCertificateButtonProps) {
	const { busy, open } = usePuccCertificate({
		registrationNumber,
		vehicleId,
		vin,
	});
	return (
		<Button
			className={className}
			disabled={busy}
			onClick={open}
			size="sm"
			type="button"
			variant="outline"
		>
			{busy ? (
				<Loader2 className="mr-2 h-4 w-4 animate-spin" />
			) : (
				<ShieldCheck className="mr-2 h-4 w-4" />
			)}
			{busy ? "Fetching PUCC…" : "Show PUCC Certificate"}
		</Button>
	);
}

/** Dropdown-friendly variant for the vehicles table row actions. */
export function PuccCertificateMenuItem({
	registrationNumber,
	vehicleId,
	vin,
}: PuccCertificateButtonProps) {
	const { busy, open } = usePuccCertificate({
		registrationNumber,
		vehicleId,
		vin,
	});
	return (
		<DropdownMenuItem disabled={busy} onClick={open}>
			{busy ? (
				<Loader2 className="mr-2 h-4 w-4 animate-spin" />
			) : (
				<ShieldCheck className="mr-2 h-4 w-4" />
			)}
			{busy ? "Fetching PUCC…" : "Show PUCC certificate"}
		</DropdownMenuItem>
	);
}
