import { isRcProviderError, RcProviderError } from "#/lib/rc/errors";

export class CashfreeError extends RcProviderError {
	constructor(
		message: string,
		code: string,
		httpStatus: number,
		details?: unknown,
	) {
		super({ code, details, httpStatus, message, provider: "cashfree" });
		this.name = "CashfreeError";
	}
}

/**
 * Structural type guard — deliberately not `instanceof`, so it keeps
 * working across module-registry boundaries (dynamic `import()` in
 * procedures, bundled server output).
 */
export function isCashfreeError(err: unknown): err is CashfreeError {
	return (
		isRcProviderError(err) &&
		(err as { name?: unknown }).name === "CashfreeError" &&
		typeof (err as { code?: unknown }).code === "string" &&
		typeof (err as { httpStatus?: unknown }).httpStatus === "number"
	);
}
