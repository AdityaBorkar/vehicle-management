import { isRcProviderError, RcProviderError } from "#/lib/rc/errors";

export class ApiExpressError extends RcProviderError {
	constructor(
		message: string,
		code: string,
		httpStatus: number,
		details?: unknown,
	) {
		super({ code, details, httpStatus, message, provider: "apiexpress" });
		this.name = "ApiExpressError";
	}
}

export function isApiExpressError(err: unknown): err is ApiExpressError {
	return isRcProviderError(err) && err.provider === "apiexpress";
}
