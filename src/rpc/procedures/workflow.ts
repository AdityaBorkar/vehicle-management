import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
	enqueueWorkflowRun,
	getLatestSucceededRun,
	getWorkflowRun,
	listWorkflowRuns,
} from "#/browser-automation/engine";
import { vehicles } from "#/db-schema";
import { db } from "#/lib/db";
import "#/browser-automation/workflows/pucc";
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
