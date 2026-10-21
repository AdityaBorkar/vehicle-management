import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { enqueueWorkflowRun } from "#/browser-automation/engine";
import {
	normalizeRegistrationNumber,
	VAHAN_TRANSACTION_HISTORY_WORKFLOW_NAME,
} from "#/browser-automation/workflows/vahan-transaction-history";
import "#/browser-automation/workflows/vahan-transaction-history";
import { vehicles, vehicleTransactions } from "#/db-schema";
import { db } from "#/lib/db";
import { protectedProcedure } from "../base";

/**
 * Stored Vahan "Know Your Application Status" snapshot for a vehicle.
 * Rows are replaced on every refresh, so this always reflects the latest
 * successful fetch; see `refresh` below.
 */
export const list = protectedProcedure
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
		return db
			.select()
			.from(vehicleTransactions)
			.where(
				and(
					eq(vehicleTransactions.vehicleId, vehicle.id),
					eq(vehicleTransactions.userId, context.user.id),
				),
			)
			.orderBy(desc(vehicleTransactions.id));
	});

const refreshSchema = z.object({
	maxCaptchaAttempts: z.number().int().min(1).max(10).optional(),
	registrationNumber: z.string().min(1).max(20),
	vehicleId: z.number().int(),
});

/**
 * Enqueue a background Transaction History refresh. Returns immediately
 * with the `queued` run — poll `workflow.getRun` until `succeeded` /
 * `failed`, then re-read `vehicleTransaction.list`. Browser work happens
 * in the background via the workflows engine (concurrency 1).
 *
 * Steps performed by the worker: Vahan login → Status → Know Your
 * Application Status → Vehicle Number radio → registration number →
 * CAPTCHA solve → Submit → extract + store in `vehicle_transactions`.
 */
export const refresh = protectedProcedure
	.input(refreshSchema)
	.handler(async ({ context, input }) => {
		let registrationNumber: string;
		try {
			registrationNumber = normalizeRegistrationNumber(
				input.registrationNumber,
			);
		} catch (err) {
			throw new ORPCError("BAD_REQUEST", {
				message: err instanceof Error ? err.message : "Invalid input.",
			});
		}

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

		try {
			return await enqueueWorkflowRun({
				input: {
					registrationNumber,
					...(input.maxCaptchaAttempts !== undefined
						? { maxCaptchaAttempts: input.maxCaptchaAttempts }
						: {}),
					vehicleId: vehicle.id,
				},
				userId: context.user.id,
				vehicleId: vehicle.id,
				workflowName: VAHAN_TRANSACTION_HISTORY_WORKFLOW_NAME,
			});
		} catch (err) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message:
					err instanceof Error
						? err.message
						: "Failed to enqueue transaction-history run.",
			});
		}
	});
