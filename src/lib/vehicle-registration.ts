/**
 * Canonical vehicle registration-number normalization.
 *
 * `formatVin` only strips separators and checks charset; portals and the
 * vehicle RPC additionally require the Indian registration shape
 * (`MH01CR7464`). Centralizing both steps removes the
 * format-then-regex copy-paste in procedures, workflows, and the CLI.
 */

import { formatVin } from "./utils";

export const REGISTRATION_NUMBER_RE = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/;

export function normalizeRegistrationNumber(value: string): string {
	const normalized = formatVin(value);
	if (!REGISTRATION_NUMBER_RE.test(normalized)) {
		throw new Error(
			`Invalid registrationNumber: "${value}". Expected format like "MH01CR7464".`,
		);
	}
	return normalized;
}

export function normalizeChassisLast5(value: string): string {
	const formatted = value.toUpperCase().replace(/[\s-]+/g, "");
	if (!/^[A-Z0-9]{5}$/.test(formatted)) {
		throw new Error(
			`Invalid chassis suffix: "${value}". Enter exactly the last 5 characters of the chassis number (A-Z, 0-9).`,
		);
	}
	return formatted;
}
