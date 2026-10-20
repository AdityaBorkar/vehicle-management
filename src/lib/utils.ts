export { cn } from "cn";

/**
 * Phone number normalization.
 *
 * better-auth's phone-number plugin matches `phone_number` by exact string,
 * so `9820XXXXXX` and `+919820XXXXXX` are different users. Normalize to E.164
 * on every write (seed) and every login attempt so they always match.
 *
 * Default region is India (+91): this app's login placeholder and data use
 * Indian mobile numbers.
 */
export function normalizePhoneNumber(input: string): string {
	const trimmed = input.trim();
	const hasPlus = trimmed.startsWith("+");
	const digits = trimmed.replace(/\D/g, "");
	if (hasPlus) {
		return `+${digits}`;
	}
	// 10-digit Indian mobile, e.g. 9820XXXXXX -> +919820XXXXXX
	if (digits.length === 10) {
		return `+91${digits}`;
	}
	// National format with trunk prefix, e.g. 09820XXXXXX
	if (digits.length === 11 && digits.startsWith("0")) {
		return `+91${digits.slice(1)}`;
	}
	// Already has country code without +, e.g. 919820XXXXXX
	if (digits.length === 12 && digits.startsWith("91")) {
		return `+${digits}`;
	}
	return digits;
}

export function isValidPhoneNumber(input: string): boolean {
	return /^\+\d{7,15}$/.test(normalizePhoneNumber(input));
}

/**
 * Standard VIN / vehicle-identifier formatting.
 *
 * Canonical form is uppercase with all separators (spaces, hyphens)
 * stripped, e.g. "mh 01-cr 7464" -> "MH01CR7464" and
 * "mat 123456 abc" -> "MAT123456ABC".
 *
 * Throws when the input is empty or contains characters outside
 * [A-Z0-9] after stripping separators.
 */
export function formatVin(value: string): string {
	const formatted = value.toUpperCase().replace(/[\s-]+/g, "");
	if (!formatted) {
		throw new Error("VIN is empty. Enter the vehicle / VIN number.");
	}
	if (!/^[A-Z0-9]+$/.test(formatted)) {
		throw new Error(
			`Invalid VIN: "${value}". Only letters, digits, spaces and hyphens are allowed.`,
		);
	}
	return formatted;
}

/** True 17-character VINs never contain I, O or Q. */
export function isStandardVin17(value: string): boolean {
	return /^[A-HJ-NPR-Z0-9]{17}$/.test(value);
}
