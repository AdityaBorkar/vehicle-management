/**
 * Shared base error for RC verification providers (APIExpress, Cashfree).
 *
 * Shape mirrors the original `ApiExpressError` so existing callers keep
 * working: `code`, `httpStatus`, optional provider `details`, and a
 * `retryable` flag derived per docs (retry 429 and 5xx only).
 */
export class RcProviderError extends Error {
	code: string;
	details?: unknown;
	httpStatus: number;
	provider: string;
	retryable: boolean;

	constructor(options: {
		code: string;
		details?: unknown;
		httpStatus: number;
		message: string;
		provider: string;
	}) {
		super(options.message);
		this.name = "RcProviderError";
		this.code = options.code;
		this.httpStatus = options.httpStatus;
		this.details = options.details;
		this.provider = options.provider;
		// Per provider docs: retry 429 and 5xx only. Never retry
		// 400/401/403/404/409/422.
		this.retryable =
			options.httpStatus === 429 ||
			(options.httpStatus >= 500 && options.httpStatus <= 599);
	}
}

/**
 * Structural type guard — deliberately not `instanceof`, so it keeps
 * working across module-registry boundaries (dynamic `import()` in
 * procedures, bundled server output).
 */
export function isRcProviderError(err: unknown): err is RcProviderError {
	return (
		err instanceof Error &&
		(err as { name?: unknown }).name !== undefined &&
		typeof (err as { name?: unknown }).name === "string" &&
		["RcProviderError", "ApiExpressError", "CashfreeError"].includes(
			(err as { name: string }).name,
		) &&
		typeof (err as { code?: unknown }).code === "string" &&
		typeof (err as { httpStatus?: unknown }).httpStatus === "number"
	);
}
