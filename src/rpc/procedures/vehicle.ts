import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { externalApiCalls, vehicles } from "#/db-schema";
import {
	buildVerificationId,
	CASHFREE_ENDPOINT_PATH,
	isCashfreeError,
	mapEnrichedRcResponse,
	verifyRc,
} from "#/lib/cashfree/server";
import { db } from "#/lib/db";
import { normalizeRegistrationNumber } from "#/lib/vehicle-registration";
import { protectedProcedure } from "../base";
import { snapshotSupersededDocument } from "./document-history";

const rcTextField = z.string().optional();
const rcDateField = z.coerce.date().optional();

const vehicleFields = {
	bodyType: rcTextField,
	color: z.string().optional(),
	cubicCapacity: rcTextField,
	emissionNorms: rcTextField,
	fatherName: rcTextField,
	financer: rcTextField,
	fitnessNumber: rcTextField,
	fitnessValidFrom: rcDateField,
	fitnessValidTill: z.coerce.date().optional(),
	fuelType: z.enum(["Diesel", "Petrol", "CNG", "EV", "Other"]).optional(),
	fuelTypeRaw: rcTextField,
	grossVehicleWeightKg: rcTextField,
	hypothecatedTo: rcTextField,
	hypothecation: rcTextField,
	insuranceCompany: rcTextField,
	insurancePolicyNo: rcTextField,
	insuranceValidFrom: rcDateField,
	insuranceValidTill: z.coerce.date().optional(),
	make: z.string().optional(),
	manufacturerModel: rcTextField,
	manufacturingMonthYear: rcTextField,
	mobileNumber: rcTextField,
	model: z.string().optional(),
	officeCode: rcTextField,
	ownerName: rcTextField,
	ownershipSrNo: rcTextField,
	ownershipType: rcTextField,
	permanentAddress: rcTextField,
	permitNumber: rcTextField,
	permitType: rcTextField,
	permitValidFrom: rcDateField,
	permitValidTill: rcDateField,
	pollutionValidTill: z.coerce.date().optional(),
	presentAddress: rcTextField,
	pucNumber: rcTextField,
	registrationAuthority: rcTextField,
	registrationDate: z.coerce.date().optional(),
	registrationNumber: z.string().min(1),
	rtoCode: rcTextField,
	rtoName: rcTextField,
	seatingCapacity: rcTextField,
	taxValidTill: rcDateField,
	unladenWeightKg: rcTextField,
	vehicleClass: rcTextField,
	vin: z.string().optional(),
	wheelbase: rcTextField,
	year: z.number().int().min(1900).max(2100).optional(),
};

const vehicleInputSchema = z.object({
	...vehicleFields,
	registrationNumber: z.string().min(1),
});

const vehicleUpdateSchema = z.object({
	...vehicleFields,
	fitnessValidFrom: z.coerce.date().optional().nullable(),
	fitnessValidTill: z.coerce.date().optional().nullable(),
	id: z.number().int(),
	insuranceValidFrom: z.coerce.date().optional().nullable(),
	insuranceValidTill: z.coerce.date().optional().nullable(),
	permitValidFrom: z.coerce.date().optional().nullable(),
	permitValidTill: z.coerce.date().optional().nullable(),
	pollutionValidTill: z.coerce.date().optional().nullable(),
	registrationDate: z.coerce.date().optional().nullable(),
	registrationNumber: z.string().min(1).optional(),
	taxValidTill: z.coerce.date().optional().nullable(),
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
			registrationNumber = normalizeRegistrationNumber(
				input.registrationNumber,
			);
		} catch (err) {
			throw new ORPCError("BAD_REQUEST", {
				message: err instanceof Error ? err.message : "Invalid VIN.",
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

function toDbDateOnly(value: string | null | undefined): Date | null {
	if (!value) return null;
	const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
	return Number.isNaN(d.getTime()) ? null : d;
}

function toLookupResponse(
	normalized: string,
	fields: ReturnType<typeof mapEnrichedRcResponse>,
	source: "cashfree" | "cache",
) {
	return {
		bodyType: fields.bodyType,
		color: fields.color,
		cubicCapacity: fields.cubicCapacity,
		emissionNorms: fields.emissionNorms,
		fatherName: fields.fatherName,
		fetchedAt: new Date().toISOString(),
		financer: fields.financer,
		fitnessNumber: fields.fitnessNumber,
		fitnessValidFrom: fields.fitnessValidFrom,
		fitnessValidTill: fields.fitnessValidTill,
		fuelType: normalizeFuelType(fields.fuelType),
		fuelTypeRaw: fields.fuelTypeRaw,
		grossVehicleWeightKg: fields.grossVehicleWeightKg,
		hypothecatedTo: fields.hypothecatedTo,
		hypothecation: fields.hypothecation,
		insuranceCompany: fields.insuranceCompany,
		insurancePolicyNo: fields.insurancePolicyNo,
		insuranceValidFrom: fields.insuranceValidFrom,
		insuranceValidTill: fields.insuranceValidTill,
		make: fields.make,
		manufacturerModel: fields.manufacturerModel,
		manufacturingMonthYear: fields.manufacturingMonthYear,
		mobileNumber: fields.mobileNumber,
		model: fields.model,
		officeCode: fields.officeCode,
		ownerName: fields.ownerName,
		ownershipSrNo: fields.ownershipSrNo,
		ownershipType: fields.ownershipType,
		permanentAddress: fields.permanentAddress,
		permitNumber: fields.permitNumber,
		permitType: fields.permitType,
		permitValidFrom: fields.permitValidFrom,
		permitValidTill: fields.permitValidTill,
		pollutionValidTill: fields.pollutionValidTill,
		presentAddress: fields.presentAddress,
		pucNumber: fields.pucNumber,
		rcRaw: fields.rcRaw,
		rcStatus: fields.rcStatus,
		registrationAuthority: fields.registrationAuthority,
		registrationDate: fields.registrationDate,
		registrationNumber: normalized,
		rtoCode: fields.rtoCode,
		rtoName: fields.rtoName,
		seatingCapacity: fields.seatingCapacity,
		source,
		taxValidTill: fields.taxValidTill,
		unladenWeightKg: fields.unladenWeightKg,
		vehicleClass: fields.vehicleClass,
		verificationId: fields.verificationId,
		vin: fields.vin,
		wheelbase: fields.wheelbase,
		year: fields.year,
	};
}

function toVehicleColumns(
	fields: ReturnType<typeof mapEnrichedRcResponse>,
	verificationId: string | null,
) {
	return {
		bodyType: fields.bodyType,
		color: fields.color,
		cubicCapacity: fields.cubicCapacity,
		emissionNorms: fields.emissionNorms,
		fatherName: fields.fatherName,
		financer: fields.financer,
		fitnessNumber: fields.fitnessNumber,
		fitnessValidFrom: toDbDateOnly(fields.fitnessValidFrom),
		fitnessValidTill: toDbDateOnly(fields.fitnessValidTill),
		fuelTypeRaw: fields.fuelTypeRaw,
		grossVehicleWeightKg: fields.grossVehicleWeightKg,
		hypothecatedTo: fields.hypothecatedTo,
		hypothecation: fields.hypothecation,
		insuranceCompany: fields.insuranceCompany,
		insurancePolicyNo: fields.insurancePolicyNo,
		insuranceValidFrom: toDbDateOnly(fields.insuranceValidFrom),
		insuranceValidTill: toDbDateOnly(fields.insuranceValidTill),
		make: fields.make,
		manufacturerModel: fields.manufacturerModel,
		manufacturingMonthYear: fields.manufacturingMonthYear,
		mobileNumber: fields.mobileNumber,
		model: fields.model,
		officeCode: fields.officeCode,
		ownerName: fields.ownerName,
		ownershipSrNo: fields.ownershipSrNo,
		ownershipType: fields.ownershipType,
		permanentAddress: fields.permanentAddress,
		permitNumber: fields.permitNumber,
		permitType: fields.permitType,
		permitValidFrom: toDbDateOnly(fields.permitValidFrom),
		permitValidTill: toDbDateOnly(fields.permitValidTill),
		pollutionValidTill: toDbDateOnly(fields.pollutionValidTill),
		presentAddress: fields.presentAddress,
		pucNumber: fields.pucNumber,
		rcFetchedAt: new Date(),
		rcProvider: "cashfree",
		rcRaw: fields.rcRaw,
		rcStatus: fields.rcStatus,
		registrationAuthority: fields.registrationAuthority,
		registrationDate: toDbDateOnly(fields.registrationDate),
		rtoCode: fields.rtoCode,
		rtoName: fields.rtoName,
		seatingCapacity: fields.seatingCapacity,
		taxValidTill: toDbDateOnly(fields.taxValidTill),
		unladenWeightKg: fields.unladenWeightKg,
		updatedAt: new Date(),
		vehicleClass: fields.vehicleClass,
		verificationId,
		vin: fields.vin,
		wheelbase: fields.wheelbase,
		year: fields.year,
	};
}

/**
 * Live Cashfree RC lookup with logging.
 *
 * Cashfree is the mandatory provider for Add-vehicle autofill.
 * Every call is stored in `external_api_calls` with the VIN, full request
 * (including `verification_id`) and full response. Returns the enriched
 * mapped fields on success and throws an ORPCError for anything else
 * (missing credentials, provider rejection, provider outage) — there is
 * no browser-automation fallback on this path.
 *
 * NOTE: the APIExpress client in `#/lib/apiexpress/` is kept intact but
 * intentionally unused for now.
 */
async function invokeCashfreeRc(normalized: string): Promise<{
	fields: ReturnType<typeof mapEnrichedRcResponse>;
	verificationId: string | null;
}> {
	const verificationId = buildVerificationId(normalized);
	const payload = {
		vehicle_number: normalized,
		verification_id: verificationId,
	};
	try {
		const { body, httpStatus } = await verifyRc(normalized, verificationId);
		await db.insert(externalApiCalls).values({
			endpoint: CASHFREE_ENDPOINT_PATH,
			provider: "cashfree",
			request: payload,
			response: body,
			status: "success",
			statusCode: httpStatus,
			vin: normalized,
		});
		return { fields: mapEnrichedRcResponse(body), verificationId };
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
		let normalized: string;
		try {
			normalized = normalizeRegistrationNumber(input.registrationNumber);
		} catch (err) {
			throw new ORPCError("BAD_REQUEST", {
				message: err instanceof Error ? err.message : "Invalid VIN.",
			});
		}

		// 2. Already in the user's own database?
		const [existing] = await db
			.select()
			.from(vehicles)
			.where(
				and(
					eq(vehicles.userId, context.user.id),
					eq(vehicles.registrationNumber, normalized),
				),
			)
			.limit(1);
		if (existing) {
			console.log(
				`[vehicle.lookup] served from vehicles table vin=${normalized} vehicleId=${existing.id}`,
			);
			return {
				bodyType: existing.bodyType ?? null,
				color: existing.color,
				cubicCapacity: existing.cubicCapacity ?? null,
				emissionNorms: existing.emissionNorms ?? null,
				fatherName: existing.fatherName ?? null,
				fetchedAt: new Date().toISOString(),
				financer: existing.financer ?? null,
				fitnessNumber: existing.fitnessNumber ?? null,
				fitnessValidFrom: toISODate(existing.fitnessValidFrom),
				fitnessValidTill: toISODate(existing.fitnessValidTill),
				fuelType: normalizeFuelType(existing.fuelType),
				fuelTypeRaw: existing.fuelTypeRaw ?? null,
				grossVehicleWeightKg: existing.grossVehicleWeightKg ?? null,
				hypothecatedTo: existing.hypothecatedTo ?? null,
				hypothecation: existing.hypothecation ?? null,
				insuranceCompany: existing.insuranceCompany ?? null,
				insurancePolicyNo: existing.insurancePolicyNo ?? null,
				insuranceValidFrom: toISODate(existing.insuranceValidFrom),
				insuranceValidTill: toISODate(existing.insuranceValidTill),
				make: existing.make,
				manufacturerModel: existing.manufacturerModel ?? null,
				manufacturingMonthYear: existing.manufacturingMonthYear ?? null,
				mobileNumber: existing.mobileNumber ?? null,
				model: existing.model,
				officeCode: existing.officeCode ?? null,
				ownerName: existing.ownerName ?? null,
				ownershipSrNo: existing.ownershipSrNo ?? null,
				ownershipType: existing.ownershipType ?? null,
				permanentAddress: existing.permanentAddress ?? null,
				permitNumber: existing.permitNumber ?? null,
				permitType: existing.permitType ?? null,
				permitValidFrom: toISODate(existing.permitValidFrom),
				permitValidTill: toISODate(existing.permitValidTill),
				pollutionValidTill: toISODate(existing.pollutionValidTill),
				presentAddress: existing.presentAddress ?? null,
				pucNumber: existing.pucNumber ?? null,
				rcRaw: (existing.rcRaw as Record<string, unknown> | null) ?? {},
				rcStatus: existing.rcStatus ?? null,
				registrationAuthority: existing.registrationAuthority ?? null,
				registrationDate: toISODate(existing.registrationDate),
				registrationNumber: normalized,
				rtoCode: existing.rtoCode ?? null,
				rtoName: existing.rtoName ?? null,
				seatingCapacity: existing.seatingCapacity ?? null,
				source: "database" as const,
				taxValidTill: toISODate(existing.taxValidTill),
				unladenWeightKg: existing.unladenWeightKg ?? null,
				vehicleClass: existing.vehicleClass ?? null,
				verificationId: existing.verificationId ?? null,
				vin: existing.vin,
				wheelbase: existing.wheelbase ?? null,
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
			const fields = mapEnrichedRcResponse(cached.response);
			return toLookupResponse(normalized, fields, "cache");
		}

		// 4. Live Cashfree call (stored with request/response/VIN).
		// This is the mandatory provider for Add-vehicle autofill.
		const { fields } = await invokeCashfreeRc(normalized);
		return toLookupResponse(normalized, fields, "cashfree");
	});

/**
 * Re-run the Cashfree RC lookup for an owned vehicle and write every
 * mapped field back to the `vehicles` row (plus full `rc_raw`).
 * Explicit user action — never implicit overwrite.
 */
export const syncRc = protectedProcedure
	.input(z.object({ vehicleId: z.number().int() }))
	.handler(async ({ context, input }) => {
		const [vehicle] = await db
			.select()
			.from(vehicles)
			.where(
				and(
					eq(vehicles.id, input.vehicleId),
					eq(vehicles.userId, context.user.id),
				),
			);
		if (!vehicle) {
			throw new ORPCError("NOT_FOUND", {
				message: `Vehicle #${input.vehicleId} not found.`,
			});
		}
		let normalized: string;
		try {
			normalized = normalizeRegistrationNumber(vehicle.registrationNumber);
		} catch (err) {
			throw new ORPCError("BAD_REQUEST", {
				message: err instanceof Error ? err.message : "Invalid VIN.",
			});
		}
		const { fields, verificationId } = await invokeCashfreeRc(normalized);
		const columns = toVehicleColumns(fields, verificationId);
		const [updated] = await db
			.update(vehicles)
			.set({
				...columns,
				fuelType: normalizeFuelType(fields.fuelType) ?? vehicle.fuelType,
			})
			.where(
				and(eq(vehicles.id, vehicle.id), eq(vehicles.userId, context.user.id)),
			)
			.returning();
		return updated ?? null;
	});
