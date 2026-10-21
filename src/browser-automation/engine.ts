/**
 * Async workflows engine.
 *
 * Browser automations (PUCC fetch, challan scrape, …) are slow, flaky and
 * CAPTCHA-gated, so they must never block an RPC request. The engine gives
 * them a durable home:
 *
 * 1. Callers `enqueueWorkflowRun()` — inserts a `workflow_runs` row with
 *    status `queued` and kicks the in-process pump (fire-and-forget).
 * 2. `pumpQueue()` claims the oldest `queued` row atomically, flips it to
 *    `running`, executes the registered definition, then records
 *    `succeeded` (+ output/artifact) or `failed` (+ error).
 * 3. Callers poll `getWorkflowRun()` / `listWorkflowRuns()` (via the
 *    `workflow` oRPC namespace) until terminal state.
 *
 * Concurrency is 1: the PUC portal actively blocks multiple tabs via
 * BroadcastChannel, and a single persistent Chrome profile cannot safely
 * run parallel automations. If parallel browsers are ever needed, shard by
 * profile dir instead of raising this limit.
 *
 * Single-process note: `pumpQueue()` runs in this Node process. A restart
 * leaves `running` rows stuck — call `requeueStaleRunning()` on boot/CLI
 * to move them back to `queued`. A future BullMQ/SQS backend can replace
 * the pump without changing definitions.
 */

import { and, desc, eq } from "drizzle-orm";

import { workflowRuns } from "#/db-schema";
import { db } from "#/lib/db";
import type { ArtifactStore } from "./artifact-store";
import { artifactStore } from "./artifact-store";
import type { CaptchaSolver } from "./captcha";
import { solveCaptchaWithMetaAi } from "./captcha";

export type WorkflowStatus = "queued" | "running" | "succeeded" | "failed";

export interface WorkflowRunRecord {
	artifactPath: string | null;
	attempts: number;
	createdAt: Date | null;
	error: string | null;
	finishedAt: Date | null;
	id: number;
	input: Record<string, unknown>;
	output: Record<string, unknown> | null;
	startedAt: Date | null;
	status: WorkflowStatus;
	userId: string;
	vehicleId: number | null;
	workflowName: string;
}

export interface WorkflowContext<I = Record<string, unknown>> {
	artifactStore: ArtifactStore;
	captchaSolver: CaptchaSolver;
	input: I;
	log: (...args: unknown[]) => void;
	runId: number;
	userId: string;
	vehicleId: number | null;
}

export interface WorkflowSuccess {
	artifactPath?: string | null;
	output?: Record<string, unknown>;
}

export interface WorkflowDefinition<
	I extends Record<string, unknown> = Record<string, unknown>,
> {
	name: string;
	run: (ctx: WorkflowContext<I>) => Promise<WorkflowSuccess>;
}

const registry = new Map<string, WorkflowDefinition>();

export function registerWorkflow(def: WorkflowDefinition): void {
	registry.set(def.name, def);
}

export function getWorkflowDefinition(
	name: string,
): WorkflowDefinition | undefined {
	return registry.get(name);
}

export function listWorkflowDefinitions(): string[] {
	return [...registry.keys()];
}

function toRecord(row: typeof workflowRuns.$inferSelect): WorkflowRunRecord {
	return {
		artifactPath: row.artifactPath,
		attempts: row.attempts,
		createdAt: row.createdAt,
		error: row.error,
		finishedAt: row.finishedAt,
		id: row.id,
		input: row.input,
		output: row.output,
		startedAt: row.startedAt,
		status: (row.status ?? "queued") as WorkflowStatus,
		userId: row.userId,
		vehicleId: row.vehicleId,
		workflowName: row.workflowName,
	};
}

export async function enqueueWorkflowRun(input: {
	input: Record<string, unknown>;
	userId: string;
	vehicleId?: number | null;
	workflowName: string;
}): Promise<WorkflowRunRecord> {
	if (!registry.has(input.workflowName)) {
		throw new Error(`Unknown workflow "${input.workflowName}".`);
	}
	const [row] = await db
		.insert(workflowRuns)
		.values({
			attempts: 0,
			input: input.input,
			status: "queued",
			userId: input.userId,
			vehicleId: input.vehicleId ?? null,
			workflowName: input.workflowName,
		})
		.returning();
	if (!row) throw new Error("Failed to enqueue workflow run.");
	// Fire-and-forget: the RPC response must not wait for the browser.
	void pumpQueue().catch((err) => {
		console.error(`[workflows] pump failed after enqueue #${row.id}:`, err);
	});
	return toRecord(row);
}

async function claimNextQueued(): Promise<
	typeof workflowRuns.$inferSelect | null
> {
	const [next] = await db
		.select()
		.from(workflowRuns)
		.where(eq(workflowRuns.status, "queued"))
		.orderBy(workflowRuns.id)
		.limit(1);
	if (!next) return null;
	// Atomic claim: only flip when still queued (multi-process safe).
	const [claimed] = await db
		.update(workflowRuns)
		.set({ startedAt: new Date(), status: "running", updatedAt: new Date() })
		.where(and(eq(workflowRuns.id, next.id), eq(workflowRuns.status, "queued")))
		.returning();
	return claimed ?? null;
}

let pumping = false;

export async function pumpQueue(): Promise<void> {
	if (pumping) return;
	pumping = true;
	try {
		for (;;) {
			const claimed = await claimNextQueued();
			if (!claimed) return;
			await executeRun(claimed.id);
		}
	} finally {
		pumping = false;
	}
}

async function executeRun(runId: number): Promise<void> {
	const [row] = await db
		.select()
		.from(workflowRuns)
		.where(eq(workflowRuns.id, runId));
	if (!row) return;
	const def = registry.get(row.workflowName);
	if (!def) {
		await db
			.update(workflowRuns)
			.set({
				error: `Unknown workflow "${row.workflowName}".`,
				finishedAt: new Date(),
				status: "failed",
				updatedAt: new Date(),
			})
			.where(eq(workflowRuns.id, runId));
		return;
	}
	const attempts = (row.attempts ?? 0) + 1;
	await db
		.update(workflowRuns)
		.set({ attempts, updatedAt: new Date() })
		.where(eq(workflowRuns.id, runId));

	const ctx: WorkflowContext = {
		artifactStore,
		captchaSolver: solveCaptchaWithMetaAi,
		input: row.input,
		log: (...args: unknown[]) => {
			console.log(`[workflows] ${row.workflowName} #${runId}`, ...args);
		},
		runId,
		userId: row.userId,
		vehicleId: row.vehicleId,
	};
	try {
		const result = await def.run(ctx);
		await db
			.update(workflowRuns)
			.set({
				artifactPath: result.artifactPath ?? null,
				error: null,
				finishedAt: new Date(),
				output: result.output ?? null,
				status: "succeeded",
				updatedAt: new Date(),
			})
			.where(eq(workflowRuns.id, runId));
		ctx.log("succeeded");
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`[workflows] ${row.workflowName} #${runId} failed:`, err);
		await db
			.update(workflowRuns)
			.set({
				error: message.slice(0, 2000),
				finishedAt: new Date(),
				status: "failed",
				updatedAt: new Date(),
			})
			.where(eq(workflowRuns.id, runId));
	}
}

export async function getWorkflowRun(
	id: number,
	userId: string,
): Promise<WorkflowRunRecord | null> {
	const [row] = await db
		.select()
		.from(workflowRuns)
		.where(and(eq(workflowRuns.id, id), eq(workflowRuns.userId, userId)));
	return row ? toRecord(row) : null;
}

export async function listWorkflowRuns(
	userId: string,
	opts?: { limit?: number | undefined; workflowName?: string | undefined },
): Promise<WorkflowRunRecord[]> {
	const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 100);
	const filters = opts?.workflowName
		? and(
				eq(workflowRuns.userId, userId),
				eq(workflowRuns.workflowName, opts.workflowName),
			)
		: eq(workflowRuns.userId, userId);
	const rows = await db
		.select()
		.from(workflowRuns)
		.where(filters)
		.orderBy(desc(workflowRuns.id))
		.limit(limit);
	return rows.map(toRecord);
}

/**
 * Latest `succeeded` run of a workflow for a vehicle that still has its
 * artifact on disk — i.e. the "stored PUCC certificate". Returns null when
 * nothing usable is stored, so callers know to enqueue a fresh run.
 */
export async function getLatestSucceededRun(
	userId: string,
	workflowName: string,
	vehicleId: number,
): Promise<WorkflowRunRecord | null> {
	const [row] = await db
		.select()
		.from(workflowRuns)
		.where(
			and(
				eq(workflowRuns.userId, userId),
				eq(workflowRuns.workflowName, workflowName),
				eq(workflowRuns.vehicleId, vehicleId),
				eq(workflowRuns.status, "succeeded"),
			),
		)
		.orderBy(desc(workflowRuns.id))
		.limit(1);
	if (!row?.artifactPath) return null;
	return toRecord(row);
}

/**
 * Move `running` rows back to `queued` (e.g. after a deploy/restart).
 * Returns the number of runs requeued.
 */
export async function requeueStaleRunning(): Promise<number> {
	const stuck = await db
		.select({ id: workflowRuns.id })
		.from(workflowRuns)
		.where(eq(workflowRuns.status, "running"));
	for (const r of stuck) {
		await db
			.update(workflowRuns)
			.set({ startedAt: null, status: "queued", updatedAt: new Date() })
			.where(eq(workflowRuns.id, r.id));
	}
	return stuck.length;
}
