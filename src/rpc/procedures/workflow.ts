import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
	enqueueWorkflowRun,
	getLatestSucceededRun,
	getWorkflowDefinition,
	getWorkflowMetadata,
	getWorkflowRun,
	listWorkflowRuns,
} from "#/browser-automation/engine";
import { vehicles } from "#/db-schema";
import { db } from "#/lib/db";
import "#/browser-automation/workflows/pucc";
import "#/browser-automation/workflows/vahan-transaction-history";
import {
	normalizeChassisLast5,
	normalizePuccRegistrationNumber,
	PUCC_WORKFLOW_NAME,
} from "#/browser-automation/workflows/pucc";
import { protectedProcedure } from "../base";

const startPuccSchema = z.object({
	chassisLast5: z.string().min(1).max(10),
	maxCaptchaAttempts: z.number().int().min(1).max(10).optional(),
	registrationNumber: z.string().min(1).max(20),
	vehicleId: z.number().int().optional(),
});

/**
 * Enqueue an async PUCC fetch. Returns immediately with the `queued` run —
 * poll `getRun` until `succeeded` / `failed`. Browser work happens in the
 * background via the workflows engine (concurrency 1).
 */
export const startPucc = protectedProcedure
	.input(startPuccSchema)
	.handler(async ({ context, input }) => {
		let registrationNumber: string;
		let chassisLast5: string;
		try {
			registrationNumber = normalizePuccRegistrationNumber(
				input.registrationNumber,
			);
			chassisLast5 = normalizeChassisLast5(input.chassisLast5);
		} catch (err) {
			throw new ORPCError("BAD_REQUEST", {
				message: err instanceof Error ? err.message : "Invalid input.",
			});
		}

		let vehicleId: number | null = null;
		if (input.vehicleId !== undefined) {
			const [vehicle] = await db
				.select({ id: vehicles.id })
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
			vehicleId = vehicle.id;
		}

		try {
			return await enqueueWorkflowRun({
				input: {
					chassisLast5,
					registrationNumber,
					...(input.maxCaptchaAttempts !== undefined
						? { maxCaptchaAttempts: input.maxCaptchaAttempts }
						: {}),
					...(vehicleId !== null ? { vehicleId } : {}),
				},
				userId: context.user.id,
				vehicleId,
				workflowName: PUCC_WORKFLOW_NAME,
			});
		} catch (err) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message:
					err instanceof Error ? err.message : "Failed to enqueue PUCC run.",
			});
		}
	});

export const getRun = protectedProcedure
	.input(z.object({ id: z.number().int() }))
	.handler(async ({ context, input }) => {
		const run = await getWorkflowRun(input.id, context.user.id);
		if (!run) {
			throw new ORPCError("NOT_FOUND", {
				message: `Workflow run #${input.id} not found.`,
			});
		}
		return run;
	});

export const listRuns = protectedProcedure
	.input(
		z.object({
			limit: z.number().int().min(1).max(100).optional(),
			workflowName: z.string().optional(),
		}),
	)
	.handler(async ({ context, input }) => {
		return listWorkflowRuns(context.user.id, {
			...(input.limit !== undefined ? { limit: input.limit } : {}),
			...(input.workflowName !== undefined
				? { workflowName: input.workflowName }
				: {}),
		});
	});

/**
 * Latest stored PUCC certificate for a vehicle (newest `succeeded`
 * `pucc-fetch` run with an artifact). Returns null when nothing is stored —
 * the UI then enqueues `startPucc` and polls `getRun` instead.
 */
export const getLatestPucc = protectedProcedure
	.input(z.object({ vehicleId: z.number().int() }))
	.handler(async ({ context, input }) => {
		const [vehicle] = await db
			.select({ id: vehicles.id })
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
		return getLatestSucceededRun(
			context.user.id,
			PUCC_WORKFLOW_NAME,
			vehicle.id,
		);
	});

export const listDefinitions = protectedProcedure.handler(() => {
	return getWorkflowMetadata();
});

const startRunSchema = z.object({
	input: z.record(z.string(), z.unknown()),
	workflowName: z.string().min(1),
});

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

/**
 * Generic workflow trigger (Spec 03): validates `workflowName` against the
 * registry, runs the workflow's zod `inputSchema` when present, verifies
 * `vehicleId` ownership, then enqueues. Per-workflow starters remain.
 */
export const startRun = protectedProcedure
	.input(startRunSchema)
	.handler(async ({ context, input }) => {
		const def = getWorkflowDefinition(input.workflowName);
		if (!def) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Unknown workflow "${input.workflowName}".`,
			});
		}
		// Coerce numeric-string vehicleId/number fields (the generic debug form
		// posts everything as strings) before zod validation so the server
		// schema is authoritative, not the client cast.
		const rawInput = asRecord(input.input);
		const fields = def.meta?.fields ?? [];
		const coerced: Record<string, unknown> = { ...rawInput };
		for (const f of fields) {
			if (
				(f.type === "vehicleId" || f.type === "number") &&
				typeof coerced[f.name] === "string"
			) {
				const trimmed = (coerced[f.name] as string).trim();
				if (trimmed !== "" && /^\d+$/.test(trimmed)) {
					coerced[f.name] = Number(trimmed);
				}
			}
			if (
				typeof f.validate === "function" &&
				typeof coerced[f.name] === "string"
			) {
				const err = f.validate(coerced[f.name] as string);
				if (err) {
					throw new ORPCError("BAD_REQUEST", {
						data: { fieldErrors: { [f.name]: err } },
						message: `Invalid ${f.label}: ${err}`,
					});
				}
			}
		}
		let parsed: Record<string, unknown> = coerced;
		const schema = def.inputSchema as unknown as
			| {
					safeParse: (v: unknown) => {
						success: boolean;
						data?: unknown;
						error?: {
							issues?: { message: string; path: (string | number)[] }[];
						};
					};
			  }
			| undefined;
		if (schema && typeof schema.safeParse === "function") {
			const result = schema.safeParse(coerced);
			if (!result.success) {
				const issues = result.error?.issues ?? [];
				const fieldErrors: Record<string, string> = {};
				for (const issue of issues) {
					const key = issue.path.length > 0 ? String(issue.path[0]) : "_form";
					fieldErrors[key] ??= issue.message;
				}
				const detail =
					issues.length > 0
						? `: ${issues.map((i) => `${String(i.path[0] ?? "_form")}: ${i.message}`).join("; ")}`
						: "";
				throw new ORPCError("BAD_REQUEST", {
					data: { fieldErrors },
					message: `Invalid input for "${input.workflowName}"${detail}`,
				});
			}
			parsed = asRecord(result.data);
		}
		let vehicleId: number | null = null;
		const rawVehicleId = parsed["vehicleId"];
		const numericVehicleId =
			typeof rawVehicleId === "number"
				? rawVehicleId
				: typeof rawVehicleId === "string" && /^\d+$/.test(rawVehicleId.trim())
					? Number(rawVehicleId.trim())
					: null;
		if (rawVehicleId !== undefined && numericVehicleId === null) {
			throw new ORPCError("BAD_REQUEST", {
				data: { fieldErrors: { vehicleId: "Enter a numeric vehicle ID." } },
				message: "Invalid vehicleId: Enter a numeric vehicle ID.",
			});
		}
		if (numericVehicleId !== null) {
			const [vehicle] = await db
				.select({ id: vehicles.id })
				.from(vehicles)
				.where(
					and(
						eq(vehicles.id, numericVehicleId),
						eq(vehicles.userId, context.user.id),
					),
				);
			if (!vehicle) {
				throw new ORPCError("NOT_FOUND", {
					message: `Vehicle #${numericVehicleId} not found.`,
				});
			}
			vehicleId = vehicle.id;
			parsed = { ...parsed, vehicleId };
		}
		try {
			return await enqueueWorkflowRun({
				input: parsed,
				userId: context.user.id,
				vehicleId,
				workflowName: input.workflowName,
			});
		} catch (err) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message:
					err instanceof Error
						? err.message
						: `Failed to enqueue ${input.workflowName} run.`,
			});
		}
	});
