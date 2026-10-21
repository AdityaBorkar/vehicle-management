import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { readArtifactCompat } from "#/browser-automation/artifact-compat";
import { getWorkflowRun, listWorkflowRuns } from "#/browser-automation/engine";
import {
	browserAutomationSteps,
	debugLogs,
	llmRequests,
	workflowDebugs,
} from "#/db-schema";
import { db } from "#/lib/db";
import { protectedProcedure } from "../base";

const runIdSchema = z.object({ id: z.number().int() });

async function requireRun(id: number, userId: string) {
	const run = await getWorkflowRun(id, userId);
	if (!run) {
		throw new ORPCError("NOT_FOUND", {
			message: `Workflow run #${id} not found.`,
		});
	}
	return run;
}

export const getRunDetail = protectedProcedure
	.input(runIdSchema)
	.handler(async ({ context, input }) => {
		const run = await requireRun(input.id, context.user.id);
		const [debug] = await db
			.select()
			.from(workflowDebugs)
			.where(eq(workflowDebugs.runId, run.id));
		const steps = await db
			.select()
			.from(browserAutomationSteps)
			.where(
				and(
					eq(browserAutomationSteps.runId, run.id),
					eq(browserAutomationSteps.userId, context.user.id),
				),
			)
			.orderBy(browserAutomationSteps.seq);
		const logs = await db
			.select()
			.from(debugLogs)
			.where(
				and(eq(debugLogs.runId, run.id), eq(debugLogs.userId, context.user.id)),
			)
			.orderBy(debugLogs.id)
			.limit(500);
		const llm = await db
			.select({
				confidence: llmRequests.confidence,
				createdAt: llmRequests.createdAt,
				error: llmRequests.error,
				id: llmRequests.id,
				imageKey: llmRequests.imageKey,
				latencyMs: llmRequests.latencyMs,
				model: llmRequests.model,
				parsedCode: llmRequests.parsedCode,
				prompt: llmRequests.prompt,
				provider: llmRequests.provider,
				purpose: llmRequests.purpose,
				request: llmRequests.request,
				response: llmRequests.response,
				status: llmRequests.status,
			})
			.from(llmRequests)
			.where(
				and(
					eq(llmRequests.runId, run.id),
					eq(llmRequests.userId, context.user.id),
				),
			)
			.orderBy(desc(llmRequests.id))
			.limit(50);
		return {
			debug: debug ?? null,
			llm,
			logs,
			run,
			steps,
		};
	});

export const listSteps = protectedProcedure
	.input(z.object({ runId: z.number().int() }))
	.handler(async ({ context, input }) => {
		await requireRun(input.runId, context.user.id);
		return db
			.select()
			.from(browserAutomationSteps)
			.where(
				and(
					eq(browserAutomationSteps.runId, input.runId),
					eq(browserAutomationSteps.userId, context.user.id),
				),
			)
			.orderBy(browserAutomationSteps.seq);
	});

export const listLogs = protectedProcedure
	.input(
		z.object({
			level: z.enum(["debug", "info", "warn", "error"]).optional(),
			runId: z.number().int(),
			source: z.string().optional(),
		}),
	)
	.handler(async ({ context, input }) => {
		await requireRun(input.runId, context.user.id);
		const filters = [eq(debugLogs.runId, input.runId)];
		filters.push(eq(debugLogs.userId, context.user.id));
		if (input.level) filters.push(eq(debugLogs.level, input.level));
		if (input.source) filters.push(eq(debugLogs.source, input.source));
		return db
			.select()
			.from(debugLogs)
			.where(and(...filters))
			.orderBy(debugLogs.id)
			.limit(1000);
	});

export const listLlmRequests = protectedProcedure
	.input(z.object({ runId: z.number().int() }))
	.handler(async ({ context, input }) => {
		await requireRun(input.runId, context.user.id);
		return db
			.select()
			.from(llmRequests)
			.where(
				and(
					eq(llmRequests.runId, input.runId),
					eq(llmRequests.userId, context.user.id),
				),
			)
			.orderBy(desc(llmRequests.id))
			.limit(50);
	});

export const getArtifactUrl = protectedProcedure
	.input(
		z.object({
			kind: z.enum(["video", "console", "screenshot", "artifact", "llm-image"]),
			runId: z.number().int(),
			stepId: z.number().int().optional(),
		}),
	)
	.handler(async ({ context, input }) => {
		const run = await requireRun(input.runId, context.user.id);
		const [debug] = await db
			.select()
			.from(workflowDebugs)
			.where(eq(workflowDebugs.runId, run.id));
		let key: string | null = null;
		if (input.kind === "video") {
			key = debug?.videoKey ?? null;
		} else if (input.kind === "console") {
			key = debug?.consoleLogKey ?? null;
		} else if (input.kind === "artifact") {
			key = run.artifactPath;
		} else if (input.kind === "llm-image") {
			if (input.stepId === undefined) {
				throw new ORPCError("BAD_REQUEST", {
					message: "stepId (llm request id) is required for llm-image.",
				});
			}
			const [llm] = await db
				.select()
				.from(llmRequests)
				.where(
					and(
						eq(llmRequests.id, input.stepId),
						eq(llmRequests.userId, context.user.id),
					),
				);
			key = llm?.imageKey ?? null;
		} else {
			if (input.stepId === undefined) {
				throw new ORPCError("BAD_REQUEST", {
					message: "stepId is required for screenshots.",
				});
			}
			const [step] = await db
				.select()
				.from(browserAutomationSteps)
				.where(
					and(
						eq(browserAutomationSteps.id, input.stepId),
						eq(browserAutomationSteps.userId, context.user.id),
					),
				);
			key = step?.screenshotKey ?? null;
		}
		if (!key) {
			throw new ORPCError("NOT_FOUND", {
				message: `No ${input.kind} artifact for run #${run.id}.`,
			});
		}
		if (input.kind !== "screenshot") {
			// Verify ownership of the debug row / run (already checked via run).
			if (debug && debug.userId !== context.user.id) {
				throw new ORPCError("NOT_FOUND", {
					message: `Workflow run #${run.id} not found.`,
				});
			}
		}
		let size: number | null = null;
		try {
			const data = await readArtifactCompat(key);
			size = data.length;
		} catch {
			throw new ORPCError("NOT_FOUND", {
				message: "Artifact no longer available in storage.",
			});
		}
		// The browser fetches bytes via /api/debug-artifact (auth-checked);
		// this returns the routing info, not the bytes.
		return { key, kind: input.kind, runId: run.id, size };
	});

export const listRecent = protectedProcedure
	.input(
		z.object({
			limit: z.number().int().min(1).max(100).optional(),
			workflowName: z.string().optional(),
		}),
	)
	.handler(async ({ context, input }) => {
		const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
		const runs = await listWorkflowRuns(context.user.id, {
			...(input.workflowName ? { workflowName: input.workflowName } : {}),
			limit,
		});
		if (runs.length === 0) return [];
		const ids = runs.map((r) => r.id);
		const debugs = await db
			.select()
			.from(workflowDebugs)
			.where(inArray(workflowDebugs.runId, ids));
		const byRun = new Map(debugs.map((d) => [d.runId, d]));
		return runs.map((run) => {
			const d = byRun.get(run.id);
			return {
				debug: d ?? null,
				errorCount: d?.errorCount ?? 0,
				hasArtifact: Boolean(run.artifactPath),
				hasConsole: Boolean(d?.consoleLogKey),
				hasVideo: Boolean(d?.videoKey),
				run,
				warningCount: d?.warningCount ?? 0,
			};
		});
	});
