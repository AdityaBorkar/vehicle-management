import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { externalApiCalls, vehicles } from "#/db-schema";
import {
	CASHFREE_ENDPOINT_PATH,
	isCashfreeError,
	mapRcResponseToLookup,
	verifyRc,
} from "#/lib/cashfree/server";
import { db } from "#/lib/db";
import { formatVin } from "#/lib/utils";
import { protectedProcedure } from "../base";
import { snapshotSupersededDocument } from "./document-history";

const vehicleFields = {
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
};

const vehicleInputSchema = z.object({
	...vehicleFields,
	registrationNumber: z.string().min(1),
});

const vehicleUpdateSchema = z.object({
	...vehicleFields,
	fitnessValidTill: z.coerce.date().optional().nullable(),
	id: z.number().int(),
	insuranceValidTill: z.coerce.date().optional().nullable(),
	pollutionValidTill: z.coerce.date().optional().nullable(),
	registrationDate: z.coerce.date().optional().nullable(),
	registrationNumber: z.string().min(1).optional(),
	vin: z.string().optional().nullable(),
});

export const list = protectedProcedure.handler(async ({ context }) => {
	return db
		.select()
		.from(vehicles)
		.where(eq(vehicles.userId, context.user.id))
		.orderBy(vehicles.createdAt);
});

export const getById = protectedProcedure
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

export const create = protectedProcedure
	.input(vehicleInputSchema)
	.handler(async ({ context, input }) => {
		let registrationNumber: string;
		try {
			registrationNumber = formatVin(input.registrationNumber);
		} catch (err) {
			throw new ORPCError("BAD_REQUEST", {
				message: err instanceof Error ? err.message : "Invalid VIN.",
			});
		}
		if (!/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/.test(registrationNumber)) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					'Invalid registration number. Expected format like "MH01CR7464".',
			});
		}
		try {
			const [vehicle] = await db
				.insert(vehicles)
				.values({
					...input,
					registrationNumber,
					userId: context.user.id,
				})
				.returning();
			return vehicle;
		} catch (err) {
			const code =
				typeof err === "object" && err !== null && "code" in err
					? String((err as { code: unknown }).code)
					: null;
			const message = err instanceof Error ? err.message : "";
			if (code === "23505" || /duplicate|unique/i.test(message)) {
				throw new ORPCError("CONFLICT", {
					message: `Vehicle "${registrationNumber}" already exists.`,
				});
			}
			throw err;
		}
	});

export const update = protectedProcedure
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

export const remove = protectedProcedure
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

const FUEL_MAP: Record<string, "Diesel" | "Petrol" | "CNG" | "EV" | "Other"> = {
	battery: "EV",
	cng: "CNG",
	diesel: "Diesel",
	electric: "EV",
	ev: "EV",
	gasoline: "Petrol",
	lng: "CNG",
	lpg: "Other",
	petrol: "Petrol",
};

function normalizeFuelType(
	value: string | null | undefined,
): "Diesel" | "Petrol" | "CNG" | "EV" | "Other" | null {
	if (!value) return null;
	const v = value.trim().toLowerCase();
	const direct = FUEL_MAP[v];
	if (direct) return direct;
	if (v.includes("diesel")) return "Diesel";
	if (v.includes("petrol") || v.includes("gasoline")) return "Petrol";
	if (v.includes("cng") || v.includes("lng")) return "CNG";
	if (v.includes("electric") || v.includes("battery") || v.includes(" ev"))
		return "EV";
	// Hybrid maps to Other: no dedicated hybrid fuel type in the schema.
	if (v.includes("hybrid") || v.includes("lpg")) return "Other";
	if (v === "other") return "Other";
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
type ProviderErrorCode =
	| "BAD_GATEWAY"
	| "BAD_REQUEST"
	| "FORBIDDEN"
	| "GATEWAY_TIMEOUT"
	| "INTERNAL_SERVER_ERROR"
	| "NOT_FOUND"
	| "SERVICE_UNAVAILABLE"
	| "TOO_MANY_REQUESTS"
	| "UNAUTHORIZED";

const CODE_BY_STATUS: Record<number, ProviderErrorCode> = {
	401: "UNAUTHORIZED",
	403: "FORBIDDEN",
	404: "NOT_FOUND",
	429: "TOO_MANY_REQUESTS",
	502: "BAD_GATEWAY",
	503: "SERVICE_UNAVAILABLE",
	504: "GATEWAY_TIMEOUT",
};

function orpcCodeForProviderStatus(httpStatus: number): ProviderErrorCode {
	return (
		CODE_BY_STATUS[httpStatus] ??
		(httpStatus >= 500 ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST")
	);
}

/**
 * Live Cashfree RC lookup with caching.
 *
 * Cashfree is the mandatory provider for Add-vehicle autofill.
 * Every call is stored in `external_api_calls` with the VIN, request
 * payload and full response. Returns the mapped lookup on success and
 * throws for anything else (missing credentials, provider rejection,
 * provider outage) — there is no browser-automation fallback on this path.
 *
 * NOTE: the APIExpress client in `#/lib/apiexpress/` is kept intact but
 * intentionally unused for now.
 */
async function fetchAndStoreRc(normalized: string) {
	const payload = { vehicle_number: normalized };
	try {
		const { body, httpStatus } = await verifyRc(normalized);
		await db.insert(externalApiCalls).values({
			endpoint: CASHFREE_ENDPOINT_PATH,
			provider: "cashfree",
			request: payload,
			response: body,
			status: "success",
			statusCode: httpStatus,
			vin: normalized,
		});
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
			source: "cashfree" as const,
			vin: fields.vin,
			year: fields.year,
		};
	} catch (err) {
		if (!isCashfreeError(err)) throw err;
		// No credentials configured — autofill cannot run without Cashfree.
		if (err.code === "MISSING_CREDENTIALS" || err.code === "INVALID_ENV") {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message:
					"Autofill needs Cashfree: CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET are not configured on the server.",
			});
		}
		// Store the full provider error body — it carries request_id and
		// field/details needed when contacting support.
		const errorBody = asErrorRecord(err.details) ?? {
			code: err.code,
			message: err.message,
		};
		try {
			await db.insert(externalApiCalls).values({
				endpoint: CASHFREE_ENDPOINT_PATH,
				provider: "cashfree",
				request: payload,
				response: errorBody,
				status: "error",
				statusCode: err.httpStatus,
				vin: normalized,
			});
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
 * Autofill source for the Add Vehicle UI. Cashfree is mandatory here.
 *
 * Takes only the vehicle number, formats it to the standard form, then
 * resolves details in order:
 *   1. the user's own `vehicles` table,
 *   2. the shared `external_api_calls` cache (either provider — the
 *      Cashfree mapper accepts both response shapes),
 *   3. a live Cashfree call (stored with request/response/VIN).
 * Nothing is saved to `vehicles` — the caller still goes through `create`.
 */
export const lookup = protectedProcedure
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

		// 3. Cached RC response (either provider — mapper handles both)?
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

		// 4. Live Cashfree call (stored with request/response/VIN).
		// This is the mandatory provider for Add-vehicle autofill.
		return fetchAndStoreRc(normalized);
	});
