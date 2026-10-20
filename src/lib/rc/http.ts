import type { RcProviderError } from "./errors";

export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
// Docs recommend up to 3 attempts for 429 and 3-5 for 5xx; 3 total keeps
// the worst case bounded for an interactive autofill flow.
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_BASE_BACKOFF_MS = 1_000;
export const DEFAULT_MAX_BACKOFF_MS = 5_000;
export const DEFAULT_MAX_RETRY_AFTER_MS = 30_000;

export interface RetryPolicy {
	baseBackoffMs?: number;
	maxAttempts?: number;
	maxBackoffMs?: number;
	maxRetryAfterMs?: number;
	timeoutMs?: number;
}

export type RcErrorFactory = (
	message: string,
	code: string,
	httpStatus: number,
	details?: unknown,
) => RcProviderError;

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Honor the provider's Retry-After (seconds or HTTP date), capped. */
export function retryAfterMs(
	res: Response,
	maxRetryAfterMs = DEFAULT_MAX_RETRY_AFTER_MS,
): number | undefined {
	const raw = res.headers.get("retry-after");
	if (!raw) return undefined;
	const seconds = Number(raw);
	if (Number.isFinite(seconds) && seconds >= 0) {
		return Math.min(seconds * 1_000, maxRetryAfterMs);
	}
	const date = Date.parse(raw);
	if (!Number.isNaN(date)) {
		return Math.min(Math.max(date - Date.now(), 0), maxRetryAfterMs);
	}
	return undefined;
}

/** Exponential backoff with jitter, preferring the provider's Retry-After. */
export function backoffDelayMs(
	attempt: number,
	retryAfter?: number,
	baseBackoffMs = DEFAULT_BASE_BACKOFF_MS,
	maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
): number {
	if (retryAfter !== undefined) return retryAfter;
	const exp = Math.min(baseBackoffMs * 2 ** (attempt - 1), maxBackoffMs);
	return exp + Math.floor(Math.random() * 500);
}

/**
 * Sleep for the backoff window, or rethrow when the error is terminal
 * or attempts are exhausted.
 */
export async function maybeRetry(
	err: RcProviderError,
	attempt: number,
	tag: string,
	logPrefix: string,
	options?: {
		maxAttempts?: number;
		retryAfter?: number | undefined;
	},
): Promise<void> {
	const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
	if (!err.retryable || attempt >= maxAttempts) throw err;
	const delayMs = backoffDelayMs(attempt, options?.retryAfter);
	console.log(
		`[${logPrefix}] ${err.code} ${tag}: ${err.message} — retrying in ${delayMs}ms`,
	);
	await sleep(delayMs);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface ProviderErrorShape {
	code: string;
	message: string;
	requestId?: string | null;
}

export interface PostJsonOptions {
	/** Extra per-provider error detail extraction from an error body. */
	describeErrorBody?: (
		body: Record<string, unknown>,
		httpStatus: number,
	) => ProviderErrorShape | null;
	endpointPath: string;
	headers: Record<string, string>;
	/** Detect a provider-level failure on HTTP 200 (e.g. status flags). */
	isProviderError?: (
		body: Record<string, unknown>,
	) => ProviderErrorShape | null;
	logPrefix: string;
	makeError: RcErrorFactory;
	maxAttempts?: number;
	payload: unknown;
	retryAfterCapMs?: number;
	tag: string;
	timeoutMs?: number;
	url: string;
}

/**
 * POST JSON with the shared retry contract: 429 honors Retry-After, 5xx and
 * network failures use exponential backoff with jitter, up to `maxAttempts`
 * total. 4xx (except 429) throw immediately. Throws `RcProviderError` when
 * exhausted.
 */
export async function postJsonWithRetry({
	describeErrorBody,
	endpointPath,
	headers,
	isProviderError,
	logPrefix,
	makeError,
	maxAttempts = DEFAULT_MAX_ATTEMPTS,
	payload,
	retryAfterCapMs = DEFAULT_MAX_RETRY_AFTER_MS,
	tag,
	timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
	url,
}: PostJsonOptions): Promise<{
	body: Record<string, unknown>;
	httpStatus: number;
}> {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const startedAt = Date.now();
		const attemptTag = `${tag} attempt=${attempt}/${maxAttempts}`;
		// Secret headers/keys are never logged — only the endpoint and lookup key.
		console.log(`[${logPrefix}] POST ${endpointPath} ${attemptTag}`);
		let res: Response;
		try {
			res = await fetch(url, {
				body: JSON.stringify(payload),
				headers: { "Content-Type": "application/json", ...headers },
				method: "POST",
				signal: AbortSignal.timeout(timeoutMs),
			});
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Network request failed";
			console.log(
				`[${logPrefix}] network failure in ${Date.now() - startedAt}ms ${attemptTag}: ${message}`,
			);
			await maybeRetry(
				makeError(message, "TIMEOUT", 503),
				attempt,
				attemptTag,
				logPrefix,
				{
					maxAttempts,
				},
			);
			continue;
		}

		let parsed: unknown;
		try {
			parsed = (await res.json()) as unknown;
		} catch {
			const apiErr = makeError(
				`${logPrefix} returned non-JSON (HTTP ${res.status}).`,
				"UPSTREAM_ERROR",
				res.status,
			);
			console.log(
				`[${logPrefix}] non-JSON response HTTP ${res.status} in ${Date.now() - startedAt}ms ${attemptTag}`,
			);
			await maybeRetry(apiErr, attempt, attemptTag, logPrefix, { maxAttempts });
			continue;
		}
		if (!isRecord(parsed)) {
			const apiErr = makeError(
				`${logPrefix} returned unexpected JSON shape (HTTP ${res.status}).`,
				"UPSTREAM_ERROR",
				res.status,
			);
			console.log(
				`[${logPrefix}] unexpected JSON shape HTTP ${res.status} in ${Date.now() - startedAt}ms ${attemptTag}`,
			);
			await maybeRetry(apiErr, attempt, attemptTag, logPrefix, { maxAttempts });
			continue;
		}
		const body = parsed;

		const providerError = isProviderError?.(body) ?? null;
		if (!res.ok || providerError) {
			const described = describeErrorBody?.(body, res.status) ?? null;
			const shape = providerError ?? described;
			const code =
				shape?.code ??
				(typeof body.code === "string" ? body.code : `HTTP_${res.status}`);
			const message =
				shape?.message ??
				(typeof body.message === "string"
					? body.message
					: `RC verification failed (HTTP ${res.status}).`);
			const requestId = shape?.requestId ?? null;
			const apiErr = makeError(message, code, res.status, body);
			console.log(
				`[${logPrefix}] error ${code} HTTP ${res.status} in ${Date.now() - startedAt}ms ${attemptTag}: ${message}${requestId ? ` req_id=${requestId}` : ""}`,
			);
			await maybeRetry(apiErr, attempt, attemptTag, logPrefix, {
				maxAttempts,
				retryAfter: retryAfterMs(res, retryAfterCapMs),
			});
			continue;
		}

		console.log(
			`[${logPrefix}] success HTTP ${res.status} in ${Date.now() - startedAt}ms ${attemptTag}`,
		);
		return { body, httpStatus: res.status };
	}
	throw makeError(
		"RC verification failed after retries.",
		"UPSTREAM_ERROR",
		503,
	);
}
