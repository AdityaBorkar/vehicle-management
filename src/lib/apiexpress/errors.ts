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

/**
 * Structural type guard — deliberately not `instanceof`, so it keeps
 * working across module-registry boundaries (dynamic `import()` in
 * procedures, bundled server output).
 */
export function isApiExpressError(err: unknown): err is ApiExpressError {
	return (
		isRcProviderError(err) &&
		(err as { name?: unknown }).name === "ApiExpressError" &&
		typeof (err as { code?: unknown }).code === "string" &&
		typeof (err as { httpStatus?: unknown }).httpStatus === "number"
	);
}
