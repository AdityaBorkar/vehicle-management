import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { externalApiCalls, vehicles } from "#/db-schema";
import { db } from "#/lib/db";
import { formatVin } from "#/lib/utils";
import { authorized } from "../base";

const vehicleInputSchema = z.object({
	color: z.string().optional(),
	fitnessValidTill: z.coerce.date().optional(),
	fuelType: z.enum(["Diesel", "Petrol", "CNG", "EV", "Other"]).optional(),
	insuranceValidTill: z.coerce.date().optional(),
	make: z.string().optional(),
	model: z.string().optional(),
	pollutionValidTill: z.coerce.date().optional(),
	registrationDate: z.coerce.date().optional(),
	registrationNumber: z.string().min(1),
	vin: z.string().optional(),
	year: z.number().int().min(1900).max(2100).optional(),
});

const vehicleUpdateSchema = z.object({
	color: z.string().optional(),
	fitnessValidTill: z.coerce.date().optional().nullable(),
	fuelType: z.enum(["Diesel", "Petrol", "CNG", "EV", "Other"]).optional(),
	id: z.number().int(),
	insuranceValidTill: z.coerce.date().optional().nullable(),
	make: z.string().optional(),
	model: z.string().optional(),
	pollutionValidTill: z.coerce.date().optional().nullable(),
	registrationDate: z.coerce.date().optional().nullable(),
	registrationNumber: z.string().min(1).optional(),
	vin: z.string().optional().nullable(),
	year: z.number().int().min(1900).max(2100).optional(),
});

export const list = authorized.handler(async ({ context }) => {
	return db
		.select()
		.from(vehicles)
		.where(eq(vehicles.userId, context.user.id))
		.orderBy(vehicles.createdAt);
});

export const getById = authorized
	.input(z.object({ id: z.number().int() }))
	.handler(async ({ context, input }) => {
		const [vehicle] = await db
			.select()
			.from(vehicles)
			.where(
				and(eq(vehicles.id, input.id), eq(vehicles.userId, context.user.id)),
			);
		return vehicle ?? null;
	});

export const create = authorized
	.input(vehicleInputSchema)
	.handler(async ({ context, input }) => {
		const [vehicle] = await db
			.insert(vehicles)
			.values({
				...input,
				userId: context.user.id,
			})
			.returning();
		return vehicle;
	});

export const update = authorized
	.input(vehicleUpdateSchema)
	.handler(async ({ context, input }) => {
		const { id, ...data } = input;
		const [existing] = await db
			.select()
			.from(vehicles)
			.where(and(eq(vehicles.id, id), eq(vehicles.userId, context.user.id)));
		if (!existing) return null;

		// Preserve replaced validity dates in the documents vault so old
		// documents are never lost when a renewal overwrites the live row.
		const snapshots: {
			kind: string;
			documentName: string;
			old: Date | null;
			next: Date | undefined | null;
		}[] = [
			{
				documentName: "Insurance",
				kind: "insurance",
				next: data.insuranceValidTill,
				old: existing.insuranceValidTill,
			},
			{
				documentName: "Fitness Certificate",
				kind: "fitness",
				next: data.fitnessValidTill,
				old: existing.fitnessValidTill,
			},
			{
				documentName: "Pollution (PUC)",
				kind: "pollution",
				next: data.pollutionValidTill,
				old: existing.pollutionValidTill,
			},
		];
		for (const s of snapshots) {
			if (
				s.old &&
				s.next instanceof Date &&
				s.next.getTime() !== s.old.getTime()
			) {
				const { snapshotSupersededDocument } = await import(
					"./document-history"
				);
				await snapshotSupersededDocument({
					documentName: s.documentName,
					expiryDate: s.old,
					kind: s.kind,
					userId: context.user.id,
					vehicleId: existing.id,
					vehicleRegistration: existing.registrationNumber,
					vin: existing.vin,
				});
			}
		}

		const [vehicle] = await db
			.update(vehicles)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(vehicles.id, id), eq(vehicles.userId, context.user.id)))
			.returning();
		return vehicle ?? null;
	});

export const remove = authorized
	.input(z.object({ id: z.number().int() }))
	.handler(async ({ context, input }) => {
		const [vehicle] = await db
			.delete(vehicles)
			.where(
				and(eq(vehicles.id, input.id), eq(vehicles.userId, context.user.id)),
			)
			.returning();
		return vehicle ?? null;
	});

const lookupInputSchema = z.object({
	registrationNumber: z.string().min(1).max(20),
});

function normalizeFuelType(
	value: string | null | undefined,
): "Diesel" | "Petrol" | "CNG" | "EV" | "Other" | null {
	if (!value) return null;
	const v = value.toLowerCase();
	if (v.includes("diesel")) return "Diesel";
	if (v.includes("petrol") || v.includes("gasoline")) return "Petrol";
	if (v.includes("cng") || v.includes("lng")) return "CNG";
	if (
		v.includes("electric") ||
		v.includes(" ev") ||
		v === "ev" ||
		v.includes("battery")
	)
		return "EV";
	if (v.includes("hybrid") || v.includes("lpg")) return "Other";
	if (["diesel", "petrol", "cng", "ev", "other"].includes(v)) {
		return (v === "ev" ? "EV" : `${v[0]?.toUpperCase()}${v.slice(1)}`) as
			| "Diesel"
			| "Petrol"
			| "CNG"
			| "EV"
			| "Other";
	}
	return null;
}

function toISODate(value: Date | null | undefined): string | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString().slice(0, 10);
}

function asErrorRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

/** Map a provider HTTP status to the closest standard oRPC error code. */
function orpcCodeForProviderStatus(
	httpStatus: number,
):
	| "BAD_GATEWAY"
	| "BAD_REQUEST"
	| "FORBIDDEN"
	| "GATEWAY_TIMEOUT"
	| "INTERNAL_SERVER_ERROR"
	| "NOT_FOUND"
	| "SERVICE_UNAVAILABLE"
	| "TOO_MANY_REQUESTS"
	| "UNAUTHORIZED" {
	if (httpStatus === 401) return "UNAUTHORIZED";
	if (httpStatus === 403) return "FORBIDDEN";
	if (httpStatus === 404) return "NOT_FOUND";
	if (httpStatus === 429) return "TOO_MANY_REQUESTS";
	if (httpStatus === 502) return "BAD_GATEWAY";
	if (httpStatus === 503) return "SERVICE_UNAVAILABLE";
	if (httpStatus === 504) return "GATEWAY_TIMEOUT";
	if (httpStatus >= 500) return "INTERNAL_SERVER_ERROR";
	return "BAD_REQUEST";
}

/**
 * Live APIExpress RC lookup with caching.
 *
 * APIExpress is the mandatory provider for Add-vehicle autofill.
 * Every call is stored in `external_api_calls` with the VIN, request
 * payload and full response. Returns the mapped lookup on success and
 * throws for anything else (missing key, provider rejection, provider
 * outage) — there is no browser-automation fallback on this path.
 */
async function fetchAndStoreRc(normalized: string) {
	const { isApiExpressError, mapRcResponseToLookup, verifyRc } = await import(
		"#/lib/apiexpress/server"
	);
	const payload = { rc_number: normalized };
	try {
		const { body, httpStatus } = await verifyRc(normalized);
		const [row] = await db
			.insert(externalApiCalls)
			.values({
				endpoint: "/v1/rc/verify",
				provider: "apiexpress",
				request: payload,
				response: body,
				status: "success",
				statusCode: httpStatus,
				vin: normalized,
			})
			.returning({ id: externalApiCalls.id });
		console.log(
			`[vehicle.lookup] live APIExpress success vin=${normalized} external_api_calls.id=${row?.id} HTTP ${httpStatus}`,
		);
		const fields = mapRcResponseToLookup(body);
		return {
			color: fields.color,
			fetchedAt: new Date().toISOString(),
			fitnessValidTill: fields.fitnessValidTill,
			fuelType: normalizeFuelType(fields.fuelType),
			insuranceValidTill: fields.insuranceValidTill,
			make: fields.make,
			model: fields.model,
			pollutionValidTill: fields.pollutionValidTill,
			registrationDate: fields.registrationDate,
			registrationNumber: normalized,
			source: "apiexpress" as const,
			vin: fields.vin,
			year: fields.year,
		};
	} catch (err) {
		if (!isApiExpressError(err)) throw err;
		// No key configured — autofill cannot run without APIExpress.
		if (err.code === "MISSING_API_KEY") {
			console.log(
				`[vehicle.lookup] APIExpress key missing, lookup aborted vin=${normalized}`,
			);
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message:
					"Autofill needs APIExpress: APIEXPRESS_API_KEY is not configured on the server.",
			});
		}
		// Store the full provider error body — it carries request_id and
		// field/details needed when contacting support.
		const errorBody = asErrorRecord(err.details) ?? {
			code: err.code,
			message: err.message,
		};
		const reqId =
			typeof errorBody.request_id === "string" ? errorBody.request_id : null;
		try {
			const [row] = await db
				.insert(externalApiCalls)
				.values({
					endpoint: "/v1/rc/verify",
					provider: "apiexpress",
					request: payload,
					response: errorBody,
					status: "error",
					statusCode: err.httpStatus,
					vin: normalized,
				})
				.returning({ id: externalApiCalls.id });
			console.log(
				`[vehicle.lookup] live APIExpress error vin=${normalized} external_api_calls.id=${row?.id} code=${err.code} HTTP ${err.httpStatus}${reqId ? ` req_id=${reqId}` : ""}`,
			);
		} catch (dbErr) {
			console.error("Failed to log external_api_calls row:", dbErr);
		}
		if (!err.retryable) {
			throw new ORPCError(orpcCodeForProviderStatus(err.httpStatus), {
				message: `RC lookup rejected: ${err.message}`,
			});
		}
		// Rate-limited or provider down after retries — surface it,
		// do not fall back.
		throw new ORPCError(orpcCodeForProviderStatus(err.httpStatus), {
			message: `Autofill failed for "${normalized}": ${err.message}. Retry in a bit or enter details manually.`,
		});
	}
}

/**
 * Autofill source for the Add Vehicle UI. APIExpress is mandatory here.
 *
 * Takes only the vehicle number, formats it to the standard form, then
 * resolves details in order:
 *   1. the user's own `vehicles` table,
 *   2. the shared `external_api_calls` cache,
 *   3. a live APIExpress call (stored with request/response/VIN).
 * Nothing is saved to `vehicles` — the caller still goes through `create`.
 */
export const lookup = authorized
	.input(lookupInputSchema)
	.handler(async ({ context, input }) => {
		// 1. Standard format.
		let normalized: string;
		try {
			normalized = formatVin(input.registrationNumber);
		} catch (err) {
			throw new ORPCError("BAD_REQUEST", {
				message: err instanceof Error ? err.message : "Invalid VIN.",
			});
		}
		if (!/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/.test(normalized)) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					'Invalid registration number. Expected format like "MH01CR7464".',
			});
		}

		// 2. Already in the user's own database?
		const owned = await db
			.select()
			.from(vehicles)
			.where(eq(vehicles.userId, context.user.id));
		const existing = owned.find((v) => {
			try {
				return formatVin(v.registrationNumber) === normalized;
			} catch {
				return false;
			}
		});
		if (existing) {
			console.log(
				`[vehicle.lookup] served from vehicles table vin=${normalized} vehicleId=${existing.id}`,
			);
			return {
				color: existing.color,
				fetchedAt: new Date().toISOString(),
				fitnessValidTill: toISODate(existing.fitnessValidTill),
				fuelType: normalizeFuelType(existing.fuelType),
				insuranceValidTill: toISODate(existing.insuranceValidTill),
				make: existing.make,
				model: existing.model,
				pollutionValidTill: toISODate(existing.pollutionValidTill),
				registrationDate: toISODate(existing.registrationDate),
				registrationNumber: normalized,
				source: "database" as const,
				vin: existing.vin,
				year: existing.year,
			};
		}

		// 3. Cached APIExpress response?
		const [cached] = await db
			.select()
			.from(externalApiCalls)
			.where(
				and(
					eq(externalApiCalls.vin, normalized),
					eq(externalApiCalls.status, "success"),
				),
			)
			.orderBy(desc(externalApiCalls.id))
			.limit(1);
		if (cached?.response) {
			console.log(
				`[vehicle.lookup] served from external_api_calls cache vin=${normalized} external_api_calls.id=${cached.id}`,
			);
			const { mapRcResponseToLookup } = await import("#/lib/apiexpress/server");
			const fields = mapRcResponseToLookup(cached.response);
			return {
				color: fields.color,
				fetchedAt: new Date().toISOString(),
				fitnessValidTill: fields.fitnessValidTill,
				fuelType: normalizeFuelType(fields.fuelType),
				insuranceValidTill: fields.insuranceValidTill,
				make: fields.make,
				model: fields.model,
				pollutionValidTill: fields.pollutionValidTill,
				registrationDate: fields.registrationDate,
				registrationNumber: normalized,
				source: "cache" as const,
				vin: fields.vin,
				year: fields.year,
			};
		}

		// 4. Live APIExpress call (stored with request/response/VIN).
		// This is the mandatory provider for Add-vehicle autofill.
		return fetchAndStoreRc(normalized);
	});
