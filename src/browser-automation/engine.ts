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
 * Observability (Spec 02): every run mirrors into `debug.workflows`,
 * per-action trail into `debug.browser_automation_steps`, console/engine
 * lines into `debug.logs`, and CAPTCHA AI calls into `debug.llm_requests`.
 * All writes are best-effort and never fail the run.
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

import { workflowDebugs, workflowRuns } from "#/db-schema";
import { db } from "#/lib/db";
import type { ArtifactStore } from "./artifact-store";
import { getArtifactStore } from "./artifact-store";
import type { CaptchaSolver } from "./captcha";
import { MIN_CAPTCHA_CONFIDENCE, solveCaptchaWithMetaAi } from "./captcha";
import { markLatestLlmRejected, recordLlmRequest } from "./captcha-ledger";
import {
	clearRunSeq,
	finalizeVideo,
	recordLog,
	recordStep,
	recordWarning,
	runStep,
} from "./observability";

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

export interface WorkflowEventHelpers {
	/** Record an info line to debug.logs + console. */
	log: (message: string, meta?: Record<string, unknown>) => void;
	/** Wrap an action as an auditable ok/error step. */
	step: <T>(
		kind: string,
		label: string,
		fn: () => Promise<T>,
		opts?: { attempt?: number | undefined },
	) => Promise<T>;
	/** Record a warn step (re-performed event that may later succeed). */
	warn: (
		label: string,
		message: string,
		opts?: { attempt?: number | undefined; kind?: string | undefined },
	) => void;
}

export interface WorkflowContext<I = Record<string, unknown>> {
	artifactStore: ArtifactStore;
	captchaSolver: CaptchaSolver;
	events: WorkflowEventHelpers;
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

export type WorkflowInputFieldType =
	| "registrationNumber"
	| "chassisLast5"
	| "vehicleId"
	| "text"
	| "number";

export interface WorkflowInputField {
	help?: string | undefined;
	label: string;
	name: string;
	placeholder?: string | undefined;
	required: boolean;
	type: WorkflowInputFieldType;
	validate?: ((v: string) => string | null) | undefined;
}

export interface WorkflowDefinitionMeta {
	description: string;
	displayName: string;
	fields: WorkflowInputField[];
}

export interface ZodSafeParseSchema {
	safeParse: (v: unknown) => {
		success: boolean;
		data?: unknown;
		error?: unknown;
	};
}

/**
 * Validate raw workflow input against the definition's zod schema and
 * return the parsed (typed) value. Definitions with no schema pass the raw
 * record through. Throws on validation failure — callers (engine `run`,
 * `startRun`) share this instead of hand-rolling coercion.
 */
export function parseWorkflowInput<T>(
	schema: ZodSafeParseSchema | unknown,
	raw: Record<string, unknown>,
): T {
	if (
		typeof schema === "object" &&
		schema !== null &&
		"safeParse" in schema &&
		typeof (schema as ZodSafeParseSchema).safeParse === "function"
	) {
		const result = (schema as ZodSafeParseSchema).safeParse(raw);
		if (!result.success) {
			const err = result.error as
				| { issues?: { message: string; path: (string | number)[] }[] }
				| undefined;
			const detail = (err?.issues ?? [])
				.map((i) => `${String(i.path[0] ?? "_form")}: ${i.message}`)
				.join("; ");
			throw new Error(`Invalid workflow input${detail ? `: ${detail}` : ""}`);
		}
		return result.data as T;
	}
	return raw as unknown as T;
}

export interface WorkflowDefinition<
	I extends Record<string, unknown> = Record<string, unknown>,
> {
	inputSchema?: ZodSafeParseSchema | unknown;
	meta?: WorkflowDefinitionMeta | undefined;
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

export function getWorkflowMetadata(): (WorkflowDefinitionMeta & {
	name: string;
})[] {
	return [...registry.values()].map((def) => ({
		description: def.meta?.description ?? `Run ${def.name}`,
		displayName: def.meta?.displayName ?? def.name,
		// Strip `validate` fns: the client gets fields + required flags only;
		// canonical validation lives server-side in `startRun` + zod schemas.
		fields: (def.meta?.fields ?? []).map((f) => ({
			help: f.help,
			label: f.label,
			name: f.name,
			placeholder: f.placeholder,
			required: f.required,
			type: f.type,
		})),
		name: def.name,
	}));
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

async function insertDebugWorkflow(input: {
	runId: number;
	userId: string;
	vehicleId: number | null;
	workflowName: string;
}): Promise<void> {
	try {
		await db.insert(workflowDebugs).values({
			runId: input.runId,
			status: "queued",
			userId: input.userId,
			vehicleId: input.vehicleId,
			workflowName: input.workflowName,
		});
	} catch (err) {
		console.error("[workflows] insertDebugWorkflow failed:", err);
	}
}

async function updateDebugWorkflow(
	runId: number,
	patch: Partial<typeof workflowDebugs.$inferInsert>,
): Promise<void> {
	try {
		await db
			.update(workflowDebugs)
			.set(patch)
			.where(eq(workflowDebugs.runId, runId));
	} catch (err) {
		console.error("[workflows] updateDebugWorkflow failed:", err);
	}
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
	void insertDebugWorkflow({
		runId: row.id,
		userId: input.userId,
		vehicleId: input.vehicleId ?? null,
		workflowName: input.workflowName,
	});
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
	if (claimed) {
		void updateDebugWorkflow(claimed.id, {
			startedAt: new Date(),
			status: "running",
		});
	}
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

/** Per-run CAPTCHA solver that ledgers every AI call into debug.llm_requests. */
function createObservedCaptchaSolver(input: {
	base?: CaptchaSolver | undefined;
	runId: number;
	userId: string;
}): CaptchaSolver {
	const base = input.base ?? solveCaptchaWithMetaAi;
	return async (image, opts) => {
		const startedAt = Date.now();
		try {
			const solution = await base(image, opts);
			const lowConfidence =
				typeof solution.confidence === "number" &&
				solution.confidence < MIN_CAPTCHA_CONFIDENCE;
			void recordLlmRequest({
				image,
				latencyMs: Date.now() - startedAt,
				parsedCode: solution.code,
				parsedConfidence: solution.confidence,
				rawText: solution.raw,
				runId: input.runId,
				status: lowConfidence ? "low-confidence" : "success",
				userId: input.userId,
			});
			return solution;
		} catch (err) {
			void recordLlmRequest({
				error: err instanceof Error ? err.message : String(err),
				image,
				latencyMs: Date.now() - startedAt,
				runId: input.runId,
				status: "error",
				userId: input.userId,
			});
			throw err;
		}
	};
}

async function executeRun(runId: number): Promise<void> {
	const [row] = await db
		.select()
		.from(workflowRuns)
		.where(eq(workflowRuns.id, runId));
	if (!row) return;
	const def = registry.get(row.workflowName);
	if (!def) {
		const message = `Unknown workflow "${row.workflowName}".`;
		await db
			.update(workflowRuns)
			.set({
				error: message,
				finishedAt: new Date(),
				status: "failed",
				updatedAt: new Date(),
			})
			.where(eq(workflowRuns.id, runId));
		void updateDebugWorkflow(runId, {
			completedAt: new Date(),
			status: "failed",
		});
		void recordStep({
			kind: "error",
			label: "Unknown workflow",
			message,
			runId,
			status: "error",
			userId: row.userId,
		});
		return;
	}
	const attempts = (row.attempts ?? 0) + 1;
	await db
		.update(workflowRuns)
		.set({ attempts, updatedAt: new Date() })
		.where(eq(workflowRuns.id, runId));

	const logRecord = (
		message: string,
		meta?: Record<string, unknown> | undefined,
	) => {
		console.log(`[workflows] ${row.workflowName} #${runId}`, message);
		void recordLog({
			level: "info",
			message,
			meta,
			runId,
			source: "workflow",
			userId: row.userId,
		});
	};

	const events: WorkflowEventHelpers = {
		log: (message, meta) => {
			logRecord(message, meta);
		},
		step: (kind, label, fn, opts) =>
			runStep({
				attempt: opts?.attempt ?? 1,
				fn,
				kind,
				label,
				runId,
				userId: row.userId,
			}),
		warn: (label, message, opts) => {
			logRecord(`WARN ${label}: ${message}`);
			void recordWarning({
				attempt: opts?.attempt ?? 1,
				kind: opts?.kind ?? "retry",
				label,
				message,
				runId,
				userId: row.userId,
			});
			if (opts?.kind === "captcha_rejected") {
				void markLatestLlmRejected({ message, runId, userId: row.userId });
			}
		},
	};

	const logFn = (...args: unknown[]) => {
		const message = args
			.map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
			.join(" ");
		logRecord(message.slice(0, 8000));
	};

	const ctx: WorkflowContext = {
		artifactStore: getArtifactStore(),
		captchaSolver: createObservedCaptchaSolver({
			runId,
			userId: row.userId,
		}),
		events,
		input: row.input,
		log: logFn,
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
		void updateDebugWorkflow(runId, {
			completedAt: new Date(),
			status: "succeeded",
		});
		// Best-effort video finalization (Spec 02).
		try {
			await finalizeVideo(runId, row.userId);
		} catch (err) {
			console.error("[workflows] finalizeVideo failed:", err);
		}
		clearRunSeq(runId);
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
		void updateDebugWorkflow(runId, {
			completedAt: new Date(),
			status: "failed",
		});
		void recordStepLikeFailure(runId, row.userId, message);
		try {
			await finalizeVideo(runId, row.userId);
		} catch {
			// ignore
		}
		clearRunSeq(runId);
	}
}

async function recordStepLikeFailure(
	runId: number,
	userId: string,
	message: string,
): Promise<void> {
	try {
		await recordStep({
			kind: "error",
			label: "Run failed",
			message: message.slice(0, 4000),
			runId,
			status: "error",
			userId,
		});
	} catch (err) {
		console.error("[workflows] failure step persist failed:", err);
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
		void updateDebugWorkflow(r.id, { status: "queued" });
	}
	return stuck.length;
}
