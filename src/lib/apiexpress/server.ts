/**
 * Server-only APIExpress client (RC verification).
 *
 * Never import this module from client components — it reads the secret
 * API key from the server environment.
 */

export const APIEXPRESS_RC_VERIFY_ENDPOINT =
	"https://api.apiexpress.in/v1/rc/verify";

const REQUEST_TIMEOUT_MS = 10_000;
// Docs recommend up to 3 attempts for 429 and 3-5 for 5xx; 3 total keeps
// the worst case bounded for an interactive autofill flow.
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 5_000;
const MAX_RETRY_AFTER_MS = 30_000;

export class ApiExpressError extends Error {
	code: string;
	/** Raw provider response body (error payloads carry request_id etc). */
	details?: unknown;
	httpStatus: number;
	retryable: boolean;

	constructor(
		message: string,
		code: string,
		httpStatus: number,
		details?: unknown,
	) {
		super(message);
		this.name = "ApiExpressError";
		this.code = code;
		this.httpStatus = httpStatus;
		this.details = details;
		// Per docs: retry 429 and 5xx only. Never retry 400/401/403/404/422.
		this.retryable =
			httpStatus === 429 || (httpStatus >= 500 && httpStatus <= 599);
	}
}

/**
 * Structural type guard — deliberately not `instanceof`, so it keeps
 * working across module-registry boundaries (dynamic `import()` in
 * procedures, bundled server output).
 */
export function isApiExpressError(err: unknown): err is ApiExpressError {
	return (
		err instanceof Error &&
		(err as { name?: unknown }).name === "ApiExpressError" &&
		typeof (err as { code?: unknown }).code === "string" &&
		typeof (err as { httpStatus?: unknown }).httpStatus === "number"
	);
}

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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Honor the provider's Retry-After (seconds or HTTP date), capped. */
function retryAfterMs(res: Response): number | undefined {
	const raw = res.headers.get("retry-after");
	if (!raw) return undefined;
	const seconds = Number(raw);
	if (Number.isFinite(seconds) && seconds >= 0) {
		return Math.min(seconds * 1_000, MAX_RETRY_AFTER_MS);
	}
	const date = Date.parse(raw);
	if (!Number.isNaN(date)) {
		return Math.min(Math.max(date - Date.now(), 0), MAX_RETRY_AFTER_MS);
	}
	return undefined;
}

/** Exponential backoff with jitter, preferring the provider's Retry-After. */
function backoffDelayMs(attempt: number, retryAfter?: number): number {
	if (retryAfter !== undefined) return retryAfter;
	const exp = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
	return exp + Math.floor(Math.random() * 500);
}

/**
 * Sleep for the backoff window, or rethrow when the error is terminal
 * or attempts are exhausted.
 */
async function maybeRetry(
	err: ApiExpressError,
	attempt: number,
	tag: string,
	retryAfter?: number,
): Promise<void> {
	if (!err.retryable || attempt >= MAX_ATTEMPTS) throw err;
	const delayMs = backoffDelayMs(attempt, retryAfter);
	console.log(
		`[apiexpress] ${err.code} ${tag}: ${err.message} — retrying in ${delayMs}ms`,
	);
	await sleep(delayMs);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requestIdOf(body: Record<string, unknown>): string | null {
	return typeof body.request_id === "string" && body.request_id
		? body.request_id
		: null;
}

export interface RcVerifySuccess {
	body: Record<string, unknown>;
	httpStatus: number;
}

/**
 * POST { rc_number } to the RC verification endpoint.
 *
 * Retries per docs: 429 honors Retry-After, 5xx/network use exponential
 * backoff with jitter, up to MAX_ATTEMPTS total. 4xx (except 429) throw
 * immediately. Throws ApiExpressError when exhausted.
 */
export async function verifyRc(rcNumber: string): Promise<RcVerifySuccess> {
	const payload = { rc_number: rcNumber };
	// Read the key outside the network try/catch so a missing-key config
	// error keeps its own code instead of being wrapped as a timeout.
	const apiKey = getApiKey();
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		const startedAt = Date.now();
		const tag = `rc_number=${rcNumber} attempt=${attempt}/${MAX_ATTEMPTS}`;
		// The key itself is never logged — only the endpoint and lookup key.
		console.log(`[apiexpress] POST /v1/rc/verify ${tag}`);
		let res: Response;
		try {
			res = await fetch(APIEXPRESS_RC_VERIFY_ENDPOINT, {
				body: JSON.stringify(payload),
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				method: "POST",
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Network request failed";
			console.log(
				`[apiexpress] network failure in ${Date.now() - startedAt}ms ${tag}: ${message}`,
			);
			await maybeRetry(
				new ApiExpressError(message, "TIMEOUT", 503),
				attempt,
				tag,
			);
			continue;
		}

		let parsed: unknown;
		try {
			parsed = (await res.json()) as unknown;
		} catch {
			const apiErr = new ApiExpressError(
				`APIExpress returned non-JSON (HTTP ${res.status}).`,
				"UPSTREAM_ERROR",
				res.status,
			);
			console.log(
				`[apiexpress] non-JSON response HTTP ${res.status} in ${Date.now() - startedAt}ms ${tag}`,
			);
			await maybeRetry(apiErr, attempt, tag);
			continue;
		}
		if (!isRecord(parsed)) {
			const apiErr = new ApiExpressError(
				`APIExpress returned unexpected JSON shape (HTTP ${res.status}).`,
				"UPSTREAM_ERROR",
				res.status,
			);
			console.log(
				`[apiexpress] unexpected JSON shape HTTP ${res.status} in ${Date.now() - startedAt}ms ${tag}`,
			);
			await maybeRetry(apiErr, attempt, tag);
			continue;
		}
		const body = parsed;

		if (!res.ok || body.status === "error") {
			const code =
				typeof body.code === "string" ? body.code : `HTTP_${res.status}`;
			const message =
				typeof body.message === "string"
					? body.message
					: `RC verification failed (HTTP ${res.status}).`;
			const reqId = requestIdOf(body);
			const apiErr = new ApiExpressError(message, code, res.status, body);
			console.log(
				`[apiexpress] error ${code} HTTP ${res.status} in ${Date.now() - startedAt}ms ${tag}: ${message}${reqId ? ` req_id=${reqId}` : ""}`,
			);
			await maybeRetry(apiErr, attempt, tag, retryAfterMs(res));
			continue;
		}

		console.log(
			`[apiexpress] success HTTP ${res.status} in ${Date.now() - startedAt}ms ${tag}`,
		);
		return { body, httpStatus: res.status };
	}
	throw new ApiExpressError(
		"RC verification failed after retries.",
		"UPSTREAM_ERROR",
		503,
	);
}

function pick(body: Record<string, unknown>, ...keys: string[]): unknown {
	const lower = new Map(
		Object.entries(body).map(([k, v]) => [k.toLowerCase(), v]),
	);
	for (const key of keys) {
		const hit = lower.get(key);
		if (hit !== undefined && hit !== null && hit !== "") return hit;
	}
	return null;
}

function asText(value: unknown): string | null {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}
	return null;
}

function parseApiDate(value: unknown): string | null {
	const text = asText(value);
	if (!text) return null;
	const first = (text.trim().split(" ")[0] ?? "").split("T")[0] ?? "";
	if (/^\d{4}-\d{2}-\d{2}$/.test(first)) return first;
	const m = first.match(/^(\d{1,2})[-/](\d{1,2}|[A-Za-z]{3})[-/](\d{2,4})$/);
	if (m) {
		const months: Record<string, string> = {
			apr: "04",
			aug: "08",
			dec: "12",
			feb: "02",
			jan: "01",
			jul: "07",
			jun: "06",
			mar: "03",
			may: "05",
			nov: "11",
			oct: "10",
			sep: "09",
		};
		let month = m[2] ?? "";
		if (/[A-Za-z]/.test(month)) {
			month = months[month.toLowerCase().slice(0, 3)] ?? "";
		} else {
			month = month.padStart(2, "0");
		}
		if (!month) return null;
		let year = m[3] ?? "";
		if (year.length === 2) year = `20${year}`;
		const day = (m[1] ?? "").padStart(2, "0");
		const iso = `${year}-${month}-${day}`;
		if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso))) {
			return iso;
		}
		return null;
	}
	const parsed = Date.parse(first);
	if (!Number.isNaN(parsed)) {
		return new Date(parsed).toISOString().slice(0, 10);
	}
	return null;
}

function parseApiYear(value: unknown): number | null {
	const text = asText(value);
	if (!text) return null;
	const m = text.match(/(19|20)\d{2}/);
	if (!m) return null;
	const year = Number(m[0]);
	return year >= 1900 && year <= 2100 ? year : null;
}

export interface RcLookupFields {
	color: string | null;
	fitnessValidTill: string | null;
	fuelType: string | null;
	insuranceValidTill: string | null;
	make: string | null;
	model: string | null;
	pollutionValidTill: string | null;
	registrationDate: string | null;
	vin: string | null;
	year: number | null;
}

/**
 * Map an APIExpress RC response to vehicle lookup fields.
 * Unknown / missing fields stay null — never throws on shape drift.
 */
export function mapRcResponseToLookup(
	body: Record<string, unknown>,
): RcLookupFields {
	let make = asText(pick(body, "maker", "manufacturer", "make", "brand"));
	let model = asText(pick(body, "model", "model_name", "variant"));
	const combined = asText(pick(body, "vehicle"));
	if ((!make || !model) && combined) {
		const [first, ...rest] = combined.split(" ");
		if (!make && first) make = first;
		if (!model && rest.length > 0) model = rest.join(" ");
	}

	const registrationDate = parseApiDate(
		pick(
			body,
			"registration_date",
			"regn_date",
			"reg_date",
			"date_of_registration",
			"regndate",
		),
	);

	return {
		color: asText(pick(body, "color", "colour")),
		fitnessValidTill: parseApiDate(
			pick(
				body,
				"fitness_valid",
				"fitness_upto",
				"fitness_validity",
				"fit_upto",
				"fitness",
			),
		),
		fuelType: asText(pick(body, "fuel", "fuel_type")),
		insuranceValidTill: parseApiDate(
			pick(
				body,
				"insurance_valid",
				"insurance_upto",
				"insurance_validity",
				"insurance_expiry",
				"insurance",
			),
		),
		make,
		model,
		pollutionValidTill: parseApiDate(
			pick(
				body,
				"puc_valid",
				"puc_upto",
				"pucc_validity",
				"pollution_upto",
				"emission_valid",
				"puc",
			),
		),
		registrationDate,
		vin: asText(pick(body, "chassis_number", "chassis_no", "chassis", "vin")),
		year:
			parseApiYear(
				pick(
					body,
					"manufacture_year",
					"mfg_year",
					"year_of_manufacture",
					"model_year",
					"year",
				),
			) ?? (registrationDate ? Number(registrationDate.slice(0, 4)) : null),
	};
}
