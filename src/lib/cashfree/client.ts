/**
 * Server-only Cashfree Vehicle RC verification transport.
 *
 * Never import this module from client components — it reads the
 * `CASHFREE_CLIENT_ID` / `CASHFREE_CLIENT_SECRET` secrets from the server
 * environment.
 *
 * Docs: POST `{verification_id, vehicle_number}` to
 * `{base}/vehicle-rc` with `x-client-id` / `x-client-secret` headers.
 * Success carries `status: "VALID"`; `"INVALID"` means no record.
 * Error payloads are `{type, code, message}`.
 */

import { postJsonWithRetry } from "#/lib/rc/http";
import type { RcVerifySuccess } from "#/lib/rc/types";
import {
	buildVerificationId,
	CASHFREE_ENDPOINT_PATH,
	CASHFREE_LOG_PREFIX,
	getCashfreeCredentials,
	getCashfreeEndpoint,
} from "./config";
import { CashfreeError } from "./errors";

function referenceOf(body: Record<string, unknown>): string | null {
	const raw = body.reference_id ?? body.verification_id;
	if (typeof raw === "string" && raw) return raw;
	if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
	return null;
}

function errorShapeOf(
	body: Record<string, unknown>,
	httpStatus: number,
): { code: string; message: string; requestId?: string | null } | null {
	if (typeof body.type === "string" || typeof body.code === "string") {
		return {
			code: typeof body.code === "string" ? body.code : `HTTP_${httpStatus}`,
			message:
				typeof body.message === "string"
					? body.message
					: "Cashfree RC verification failed.",
			requestId: referenceOf(body),
		};
	}
	return null;
}

/**
 * POST `{verification_id, vehicle_number}` to Cashfree.
 *
 * `verificationId` defaults to a unique `vm-{VEHICLE}-{timestamp}` value
 * (Cashfree returns 409 on reuse). Throws `CashfreeError` for missing
 * credentials, `INVALID` RCs (as 404), provider rejections and exhausted
 * retries. Retry contract mirrors APIExpress: 429 honors Retry-After,
 * 5xx/network use exponential backoff with jitter; 4xx throw immediately.
 */
export async function verifyRc(
	vehicleNumber: string,
	verificationId?: string,
): Promise<RcVerifySuccess> {
	const verificationIdValue = (
		verificationId ?? buildVerificationId(vehicleNumber)
	).slice(0, 50);
	const payload = {
		vehicle_number: vehicleNumber,
		verification_id: verificationIdValue,
	};
	// Read credentials and endpoint outside the network try/catch so a
	// missing-credential config error keeps its own code instead of being
	// wrapped as a timeout.
	const { clientId, clientSecret } = getCashfreeCredentials();
	const url = getCashfreeEndpoint();
	return postJsonWithRetry({
		describeErrorBody: errorShapeOf,
		endpointPath: CASHFREE_ENDPOINT_PATH,
		headers: { "x-client-id": clientId, "x-client-secret": clientSecret },
		isProviderError: (body) => {
			if (typeof body.status === "string" && body.status !== "VALID") {
				const reference = referenceOf(body);
				const code = body.status === "INVALID" ? "INVALID_RC" : body.status;
				const suffix = reference ? ` ref=${reference}` : "";
				return {
					code,
					message: `Cashfree RC lookup found no record for "${vehicleNumber}".${suffix}`,
					requestId: reference,
				};
			}
			return errorShapeOf(body, 200);
		},
		logPrefix: CASHFREE_LOG_PREFIX,
		makeError: (message, code, httpStatus, details) => {
			// Cashfree signals "no record" as 200 + INVALID; surface it as 404
			// so callers map it to NOT_FOUND instead of a 200-shaped error.
			const mappedStatus =
				code === "INVALID_RC" && httpStatus === 200 ? 404 : httpStatus;
			return new CashfreeError(message, code, mappedStatus, details);
		},
		payload,
		tag: `vehicle_number=${vehicleNumber} verification_id=${verificationIdValue}`,
		url,
	});
}
