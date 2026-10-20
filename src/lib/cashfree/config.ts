/**
 * Cashfree Vehicle RC verification endpoint configuration.
 *
 * Docs: POST `{verification_id, vehicle_number}` to
 * `{base}/vehicle-rc` with `x-client-id` / `x-client-secret` headers.
 * Sandbox: https://sandbox.cashfree.com/verification
 * Production: https://api.cashfree.com/verification
 */
import { CashfreeError } from "./errors";

export const CASHFREE_SANDBOX_BASE_URL =
	"https://sandbox.cashfree.com/verification";
export const CASHFREE_PRODUCTION_BASE_URL =
	"https://api.cashfree.com/verification";
export const CASHFREE_ENDPOINT_PATH = "/vehicle-rc";
export const CASHFREE_LOG_PREFIX = "cashfree";

export type CashfreeEnv = "production" | "sandbox";

function resolveEnv(): CashfreeEnv {
	const raw = process.env.CASHFREE_ENV?.trim().toLowerCase();
	if (!raw || raw === "sandbox") return "sandbox";
	if (raw === "production" || raw === "prod") return "production";
	throw new CashfreeError(
		`Unknown CASHFREE_ENV "${raw}". Expected "sandbox" or "production".`,
		"INVALID_ENV",
		500,
	);
}

function stripTrailingSlash(url: string): string {
	return url.replace(/\/+$/, "");
}

/** Base URL override wins, otherwise sandbox unless CASHFREE_ENV=production. */
export function getCashfreeBaseUrl(): string {
	const override = process.env.CASHFREE_BASE_URL?.trim();
	if (override) return stripTrailingSlash(override);
	return resolveEnv() === "production"
		? CASHFREE_PRODUCTION_BASE_URL
		: CASHFREE_SANDBOX_BASE_URL;
}

export function getCashfreeEndpoint(): string {
	return `${getCashfreeBaseUrl()}${CASHFREE_ENDPOINT_PATH}`;
}

export function getCashfreeCredentials(): {
	clientId: string;
	clientSecret: string;
} {
	// Trim: trailing whitespace/newlines in env files otherwise surface as
	// a confusing authentication_failed rejection from the provider.
	const clientId = process.env.CASHFREE_CLIENT_ID?.trim();
	const clientSecret = process.env.CASHFREE_CLIENT_SECRET?.trim();
	if (!clientId || !clientSecret) {
		throw new CashfreeError(
			"CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET are not configured on the server.",
			"MISSING_CREDENTIALS",
			500,
		);
	}
	return { clientId, clientSecret };
}

/**
 * Build a unique `verification_id` for Cashfree (max 50 chars, only
 * alphanum plus `.` `-` `_`; 409 on reuse).
 */
const MAX_VERIFICATION_ID_LEN = 50;

export function buildVerificationId(
	vehicleNumber: string,
	now: number = Date.now(),
): string {
	const sanitized = vehicleNumber
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "")
		.slice(0, 20);
	return `vm-${sanitized}-${now}`.slice(0, MAX_VERIFICATION_ID_LEN);
}
