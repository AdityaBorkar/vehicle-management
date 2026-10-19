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
