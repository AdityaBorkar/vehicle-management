/**
 * Server-only APIExpress RC verification transport.
 *
 * Never import this module from client components — it reads the secret
 * API key from the server environment.
 */

import { postJsonWithRetry } from "#/lib/rc/http";
import type { RcVerifySuccess } from "#/lib/rc/types";
import {
	APIEXPRESS_ENDPOINT_PATH,
	APIEXPRESS_LOG_PREFIX,
	APIEXPRESS_RC_VERIFY_ENDPOINT,
} from "./config";
import { ApiExpressError } from "./errors";

function getApiKey(): string {
	// Trim: trailing whitespace/newlines in env files otherwise surface as
	// a confusing INVALID_API_KEY rejection from the provider.
	const key = process.env.APIEXPRESS_API_KEY?.trim();
	if (!key) {
		throw new ApiExpressError(
			"APIEXPRESS_API_KEY is not configured on the server.",
			"MISSING_API_KEY",
			500,
		);
	}
	return key;
}

function requestIdOf(body: Record<string, unknown>): string | null {
	return typeof body.request_id === "string" && body.request_id
		? body.request_id
		: null;
}

/**
 * POST { rc_number } to the RC verification endpoint.
 *
 * Retries per docs: 429 honors Retry-After, 5xx/network use exponential
 * backoff with jitter, up to 3 total. 4xx (except 429) throw
 * immediately. Throws ApiExpressError when exhausted.
 */
export async function verifyRc(rcNumber: string): Promise<RcVerifySuccess> {
	const payload = { rc_number: rcNumber };
	// Read the key outside the network try/catch so a missing-key config
	// error keeps its own code instead of being wrapped as a timeout.
	const apiKey = getApiKey();
	return postJsonWithRetry({
		describeErrorBody: (body) => ({
			code: typeof body.code === "string" ? body.code : "UPSTREAM_ERROR",
			message:
				typeof body.message === "string"
					? body.message
					: "RC verification failed.",
			requestId: requestIdOf(body),
		}),
		endpointPath: APIEXPRESS_ENDPOINT_PATH,
		headers: { Authorization: `Bearer ${apiKey}` },
		isProviderError: (body) =>
			body.status === "error"
				? {
						code: typeof body.code === "string" ? body.code : "UPSTREAM_ERROR",
						message:
							typeof body.message === "string"
								? body.message
								: "RC verification failed.",
						requestId: requestIdOf(body),
					}
				: null,
		logPrefix: APIEXPRESS_LOG_PREFIX,
		makeError: (message, code, httpStatus, details) =>
			new ApiExpressError(message, code, httpStatus, details),
		payload,
		tag: `rc_number=${rcNumber}`,
		url: APIEXPRESS_RC_VERIFY_ENDPOINT,
	});
}
