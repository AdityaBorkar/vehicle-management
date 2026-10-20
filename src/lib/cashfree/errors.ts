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

export function isCashfreeError(err: unknown): err is CashfreeError {
	return isRcProviderError(err) && err.provider === "cashfree";
}
